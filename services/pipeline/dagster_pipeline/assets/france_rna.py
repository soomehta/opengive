from __future__ import annotations

import asyncio
import json
import traceback
from typing import Any

import httpx
import pandas as pd
import structlog
from dagster import asset

from dagster_pipeline.resources.supabase import SupabaseResource
from dagster_pipeline.utils.normalize import (
    compute_content_hash,
    generate_slug,
    map_org_type,
    normalize_country,
)
from dagster_pipeline.utils.tracking import (
    complete_scrape_run,
    fail_scrape_run,
    start_scrape_run,
)

logger = structlog.get_logger()

# Répertoire National des Associations (RNA) — French national associations registry.
# Exposed via the French government data API (api.gouv.fr / data.gouv.fr).
RNA_BASE = "https://entreprise.data.gouv.fr/api/rna/v1"

# Fallback: data.gouv.fr bulk open-data endpoint.
RNA_SEARCH_URL = f"{RNA_BASE}/associations"

REGISTRY_SOURCE = "fr_rna"

# Politeness delay (seconds).
_REQUEST_DELAY_SECONDS = 2.0

# Records per page (API max is 100).
_PAGE_SIZE = 100

# Maximum pages in one materialisation (None = exhaustive).
_MAX_PAGES: int | None = 5  # ~500 associations in dev/demo mode


async def _fetch_associations_page(
    client: httpx.AsyncClient,
    page: int,
) -> tuple[list[dict[str, Any]], bool]:
    """Fetch one page of French associations from the RNA API.

    The RNA API accepts ``page`` (1-based) and ``per_page`` query parameters
    and returns a JSON object with an ``associations`` array.

    Args:
        client: Shared async HTTP client.
        page: 1-based page index.

    Returns:
        Tuple of (list of raw association dicts, has_more: bool).
    """
    try:
        resp = await client.get(
            RNA_SEARCH_URL,
            params={
                "page": page,
                "per_page": _PAGE_SIZE,
            },
            headers={
                "Accept": "application/json",
                "User-Agent": "OpenGive/0.1 (+https://opengive.org) httpx",
            },
        )
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()

        # The API returns {"associations": [...], "total_results": N}
        associations: list[dict[str, Any]] = (
            data.get("associations")
            or data.get("results")
            or data.get("data")
            or []
        )
        total: int = int(data.get("total_results", data.get("total", 0)))
        has_more = (page * _PAGE_SIZE) < total

        logger.debug(
            "rna_page_fetched",
            page=page,
            count=len(associations),
            total=total,
            has_more=has_more,
        )
        return associations, has_more

    except httpx.HTTPStatusError as exc:
        logger.warning(
            "rna_http_error",
            page=page,
            status=exc.response.status_code,
            error=str(exc),
        )
        return [], False
    except Exception as exc:
        logger.warning("rna_fetch_error", page=page, error=str(exc))
        return [], False


async def _run_fetch(context: Any) -> list[dict[str, Any]]:
    """Paginate through the French RNA API with politeness delays.

    Args:
        context: Dagster asset execution context.

    Returns:
        Flat list of raw RNA association dicts.
    """
    all_associations: list[dict[str, Any]] = []
    page = 1

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        while True:
            await asyncio.sleep(_REQUEST_DELAY_SECONDS)
            associations, has_more = await _fetch_associations_page(client, page)
            all_associations.extend(associations)

            context.log.debug(
                f"RNA page {page}: {len(associations)} associations, "
                f"total so far: {len(all_associations)}"
            )

            if not associations or not has_more:
                break

            if _MAX_PAGES is not None and page >= _MAX_PAGES:
                context.log.info(
                    f"Reached _MAX_PAGES={_MAX_PAGES}, stopping pagination"
                )
                break

            page += 1

    context.log.info(
        f"France RNA fetch complete: {len(all_associations)} associations "
        f"across {page} page(s)"
    )
    return all_associations


@asset(
    name="france_rna_raw",
    description="Fetch French association data from the RNA (Répertoire National des Associations) API",
    group_name="ingestion",
)
def fetch_france_rna(context) -> pd.DataFrame:  # noqa: ANN001 — Dagster resolves context type at runtime
    """Fetch registered associations from the French RNA API.

    Paginates through the ``/associations`` endpoint, applying a mandatory
    ``_REQUEST_DELAY_SECONDS`` delay between requests.

    Args:
        context: Dagster asset execution context.

    Returns:
        DataFrame of raw RNA association records.  May be empty if all
        requests fail.
    """
    associations = asyncio.run(_run_fetch(context))

    if not associations:
        context.log.warning("france_rna_raw: no data fetched")
        return pd.DataFrame()

    df = pd.DataFrame(associations)
    context.log.info(
        f"france_rna_raw: {len(df)} rows, columns={list(df.columns)}"
    )
    return df


@asset(
    name="france_rna_normalized",
    description="Normalize France RNA association data to OpenGive organizations schema",
    group_name="normalization",
    deps=["france_rna_raw"],
)
def normalize_france_rna(
    context,  # noqa: ANN001 — Dagster resolves context type at runtime
    france_rna_raw: pd.DataFrame,
) -> pd.DataFrame:
    """Map French RNA API fields to the OpenGive organizations table schema.

    Field mapping (RNA API v1):
        id / rna / identifiant         -> registry_id
        titre / nom                    -> name
        objet                          -> mission
        adresse.commune / ville        -> city
        adresse.code_postal            -> postal_code
        adresse.region                 -> state_province / jurisdiction
        date_creation / date_pub_jo    -> registration_date
        regime                         -> org_type (via map_org_type)
        'fr_rna'                       -> registry_source
        'FR'                           -> country_code

    Args:
        context: Dagster asset execution context.
        france_rna_raw: Raw DataFrame from ``fetch_france_rna``.

    Returns:
        Normalized DataFrame ready for upsert into the organizations table.
    """
    if france_rna_raw.empty:
        context.log.warning("normalize_france_rna: empty DataFrame, skipping")
        return pd.DataFrame()

    def _pick(row: dict[str, Any], *keys: str, default: str = "") -> str:
        for k in keys:
            v = str(row.get(k, "") or "").strip()
            if v and v.lower() not in {"nan", "none", "n/a", "null", ""}:
                return v
        return default

    def _pick_nested(obj: Any, *keys: str, default: str = "") -> str:
        """Navigate a nested dict with dot-separated keys."""
        for k in keys:
            parts = k.split(".")
            cur: Any = obj
            try:
                for part in parts:
                    cur = cur[part]
                v = str(cur or "").strip()
                if v and v.lower() not in {"nan", "none", "n/a", "null", ""}:
                    return v
            except (KeyError, TypeError):
                continue
        return default

    rows: list[dict[str, Any]] = []

    for _, row_s in france_rna_raw.iterrows():
        raw: dict[str, Any] = row_s.to_dict()

        registry_id = _pick(raw, "id", "rna", "identifiant", "numero_rna")
        if not registry_id:
            logger.warning("rna_missing_id", row=raw)
            continue

        name = _pick(
            raw,
            "titre",
            "nom",
            "title",
            "name",
            default=f"Unnamed Association {registry_id}",
        )

        slug = generate_slug(name)
        mission: str | None = _pick(raw, "objet", "object", "description") or None

        # Address — may be nested under "adresse" dict
        adresse: dict[str, Any] = raw.get("adresse", {}) or {}
        if not isinstance(adresse, dict):
            adresse = {}

        city = (
            str(adresse.get("commune", adresse.get("ville", "")) or "").strip()
            or _pick(raw, "commune", "ville", "city")
        )
        postal_code: str | None = (
            str(adresse.get("code_postal", "") or "").strip()
            or _pick(raw, "code_postal", "postal_code")
            or None
        )
        region = (
            str(adresse.get("region", adresse.get("departement", "")) or "").strip()
            or _pick(raw, "region", "departement")
        )

        raw_type = _pick(raw, "regime", "type", "categorie", "statut_juridique")
        org_type = map_org_type(raw_type, REGISTRY_SOURCE)

        registration_date: str | None = (
            _pick(raw, "date_creation", "date_pub_jo", "date_declaration", "created_at")
            or None
        )

        # Status
        raw_status = _pick(raw, "statut", "status", "etat").lower()
        if raw_status in {"actif", "active", "en activite"}:
            status = "active"
        elif raw_status in {"dissous", "dissolved", "radiee"}:
            status = "dissolved"
        else:
            status = "active"

        website: str | None = _pick(raw, "site_web", "website", "url") or None

        content_hash = compute_content_hash(
            json.dumps(raw, sort_keys=True, default=str).encode()
        )

        normalized: dict[str, Any] = {
            "name": name,
            "slug": slug,
            "org_type": org_type,
            "mission": mission,
            "country_code": normalize_country("FR"),
            "jurisdiction": region or None,
            "registry_source": REGISTRY_SOURCE,
            "registry_id": registry_id,
            "registration_date": registration_date,
            "status": status,
            "website": website,
            "city": city or None,
            "state_province": region or None,
            "postal_code": postal_code,
            "_content_hash": content_hash,
        }
        rows.append(normalized)

    df = pd.DataFrame(rows)
    context.log.info(
        f"france_rna_normalized: {len(df)} rows normalized from "
        f"{len(france_rna_raw)} raw rows"
    )
    return df


@asset(
    name="france_rna_loaded",
    description="Upsert normalized France RNA associations into organizations table",
    group_name="loading",
    deps=["france_rna_normalized"],
)
def load_france_rna(
    context,  # noqa: ANN001 — Dagster resolves context type at runtime
    supabase: SupabaseResource,
    france_rna_normalized: pd.DataFrame,
) -> int:
    """Upsert normalized RNA associations into the Supabase organizations table.

    Uses ON CONFLICT (registry_source, registry_id) for idempotency.
    Records progress in the scrape_runs audit table.

    Args:
        context: Dagster asset execution context.
        france_rna_normalized: Normalized DataFrame from ``normalize_france_rna``.

    Returns:
        Total number of rows upserted.
    """
    client = supabase.get_client()

    run_id = start_scrape_run(
        client,
        source=REGISTRY_SOURCE,
        spider_name="france_rna_loaded",
        metadata={"row_count": len(france_rna_normalized)},
    )

    if france_rna_normalized.empty:
        context.log.warning("load_france_rna: empty DataFrame, nothing to load")
        complete_scrape_run(
            client,
            run_id=run_id,
            records_found=0,
            records_new=0,
            records_updated=0,
        )
        return 0

    records_found = len(france_rna_normalized)
    records_new = 0
    records_updated = 0
    records_failed = 0

    try:
        _internal_cols = {"_content_hash"}
        rows_to_upsert: list[dict[str, Any]] = []

        for _, row in france_rna_normalized.iterrows():
            record = {
                k: (None if pd.isna(v) else v)
                for k, v in row.to_dict().items()
                if k not in _internal_cols
            }
            rows_to_upsert.append(record)

        batch_size = 100
        for batch_start in range(0, len(rows_to_upsert), batch_size):
            batch = rows_to_upsert[batch_start : batch_start + batch_size]
            response = (
                client.table("organizations")
                .upsert(
                    batch,
                    on_conflict="registry_source,registry_id",
                    ignore_duplicates=False,
                )
                .execute()
            )

            returned = len(response.data) if response.data else 0
            records_new += returned
            context.log.debug(
                f"Upserted batch {batch_start // batch_size + 1}: {returned} rows"
            )

        context.log.info(
            f"load_france_rna: upserted {records_new} rows "
            f"({records_failed} failed) from {records_found} records"
        )

        complete_scrape_run(
            client,
            run_id=run_id,
            records_found=records_found,
            records_new=records_new,
            records_updated=records_updated,
            records_failed=records_failed,
        )

    except Exception as exc:
        error_msg = f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}"
        logger.error("load_france_rna_failed", error=error_msg)
        fail_scrape_run(
            client,
            run_id=run_id,
            error=error_msg,
            records_found=records_found,
            records_new=records_new,
            records_updated=records_updated,
        )
        raise

    return records_new
