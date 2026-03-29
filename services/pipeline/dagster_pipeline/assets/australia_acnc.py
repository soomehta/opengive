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

# Australian Charities and Not-for-profits Commission data via data.gov.au CKAN.
CKAN_BASE = "https://data.gov.au/data/api/3"

# ACNC dataset resource ID on data.gov.au.
ACNC_RESOURCE_ID = "b050b242-4487-4306-abf5-07ca073e5594"

REGISTRY_SOURCE = "au_acnc"

# Politeness delay (seconds).
_REQUEST_DELAY_SECONDS = 2.0

# Records per page for the CKAN datastore API.
_PAGE_SIZE = 100

# Maximum pages to fetch in one materialisation (None = exhaustive, ~60k charities).
_MAX_PAGES: int | None = 5  # ~500 charities in dev/demo mode


async def _fetch_acnc_page(
    client: httpx.AsyncClient,
    offset: int,
) -> tuple[list[dict[str, Any]], int]:
    """Fetch one page of ACNC charities from the CKAN datastore API.

    Args:
        client: Shared async HTTP client.
        offset: Number of records to skip (CKAN uses offset-based pagination).

    Returns:
        Tuple of (list of record dicts, total record count from CKAN).
    """
    try:
        resp = await client.get(
            f"{CKAN_BASE}/action/datastore_search",
            params={
                "resource_id": ACNC_RESOURCE_ID,
                "limit": _PAGE_SIZE,
                "offset": offset,
            },
            headers={
                "Accept": "application/json",
                "User-Agent": "OpenGive/0.1 (+https://opengive.org) httpx",
            },
        )
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()

        if not data.get("success"):
            logger.warning("acnc_ckan_error", response=data.get("error"))
            return [], 0

        result: dict[str, Any] = data.get("result", {})
        records: list[dict[str, Any]] = result.get("records", [])
        total: int = int(result.get("total", 0))

        logger.debug(
            "acnc_page_fetched",
            offset=offset,
            count=len(records),
            total=total,
        )
        return records, total

    except httpx.HTTPStatusError as exc:
        logger.warning(
            "acnc_http_error",
            offset=offset,
            status=exc.response.status_code,
            error=str(exc),
        )
        return [], 0
    except Exception as exc:
        logger.warning("acnc_fetch_error", offset=offset, error=str(exc))
        return [], 0


async def _run_fetch(context: Any) -> list[dict[str, Any]]:
    """Paginate through the ACNC CKAN dataset with politeness delays.

    Args:
        context: Dagster asset execution context.

    Returns:
        Flat list of raw ACNC charity dicts.
    """
    all_charities: list[dict[str, Any]] = []
    page = 0

    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        while True:
            offset = page * _PAGE_SIZE
            await asyncio.sleep(_REQUEST_DELAY_SECONDS)
            records, total = await _fetch_acnc_page(client, offset)
            all_charities.extend(records)

            context.log.debug(
                f"ACNC page {page + 1}: {len(records)} records, "
                f"total so far: {len(all_charities)} / {total}"
            )

            if not records or len(all_charities) >= total:
                break

            if _MAX_PAGES is not None and (page + 1) >= _MAX_PAGES:
                context.log.info(
                    f"Reached _MAX_PAGES={_MAX_PAGES}, stopping pagination"
                )
                break

            page += 1

    context.log.info(
        f"ACNC fetch complete: {len(all_charities)} charities across "
        f"{page + 1} page(s)"
    )
    return all_charities


@asset(
    name="australia_acnc_raw",
    description="Fetch Australian ACNC charity data from data.gov.au CKAN API",
    group_name="ingestion",
)
def fetch_australia_acnc(context) -> pd.DataFrame:  # noqa: ANN001 — Dagster resolves context type at runtime
    """Fetch registered charities from the Australian ACNC via data.gov.au.

    Queries the CKAN datastore API using the ACNC dataset resource ID,
    applying a mandatory ``_REQUEST_DELAY_SECONDS`` delay between requests.
    The full dataset contains approximately 60,000 charities.

    Args:
        context: Dagster asset execution context.

    Returns:
        DataFrame of raw ACNC charity records.  May be empty if all
        requests fail.
    """
    charities = asyncio.run(_run_fetch(context))

    if not charities:
        context.log.warning("australia_acnc_raw: no data fetched")
        return pd.DataFrame()

    df = pd.DataFrame(charities)
    # Normalise column names
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    context.log.info(
        f"australia_acnc_raw: {len(df)} rows, columns={list(df.columns)}"
    )
    return df


@asset(
    name="australia_acnc_normalized",
    description="Normalize Australia ACNC charity data to OpenGive organizations schema",
    group_name="normalization",
    deps=["australia_acnc_raw"],
)
def normalize_australia_acnc(
    context,  # noqa: ANN001 — Dagster resolves context type at runtime
    australia_acnc_raw: pd.DataFrame,
) -> pd.DataFrame:
    """Map ACNC CKAN fields to the OpenGive organizations table schema.

    Field mapping (ACNC dataset columns):
        abn                     -> registry_id
        charity_legal_name      -> name
        charity_city / town_city -> city
        charity_state           -> state_province / jurisdiction
        charity_postcode        -> postal_code
        charity_type            -> org_type (via map_org_type)
        date_registered         -> registration_date
        charity_status          -> status
        main_activity           -> sector
        'au_acnc'               -> registry_source
        'AU'                    -> country_code

    Args:
        context: Dagster asset execution context.
        australia_acnc_raw: Raw DataFrame from ``fetch_australia_acnc``.

    Returns:
        Normalized DataFrame ready for upsert into the organizations table.
    """
    if australia_acnc_raw.empty:
        context.log.warning("normalize_australia_acnc: empty DataFrame, skipping")
        return pd.DataFrame()

    def _pick(row: dict[str, Any], *keys: str, default: str = "") -> str:
        for k in keys:
            v = str(row.get(k, "") or "").strip()
            if v and v.lower() not in {"nan", "none", "n/a", ""}:
                return v
        return default

    rows: list[dict[str, Any]] = []

    for _, row_s in australia_acnc_raw.iterrows():
        raw: dict[str, Any] = row_s.to_dict()

        registry_id = _pick(raw, "abn", "charity_abn", "id")
        if not registry_id:
            logger.warning("acnc_missing_abn", row=raw)
            continue

        name = _pick(
            raw,
            "charity_legal_name",
            "legal_name",
            "charity_name",
            "name",
            default=f"Unnamed Charity {registry_id}",
        )

        slug = generate_slug(name)

        raw_type = _pick(
            raw,
            "charity_type",
            "organisation_type",
            "type",
        )
        org_type = map_org_type(raw_type, REGISTRY_SOURCE)

        raw_status = _pick(raw, "charity_status", "status").lower()
        if raw_status in {"registered", "active"}:
            status = "active"
        elif raw_status in {"revoked", "cancelled", "deregistered"}:
            status = "inactive"
        else:
            status = "active"

        state = _pick(raw, "charity_state", "state", "state_territory")
        city = _pick(raw, "charity_city", "town_city", "city", "suburb")
        postal_code: str | None = _pick(raw, "charity_postcode", "postcode", "postal_code") or None
        registration_date: str | None = _pick(raw, "date_registered", "registration_date") or None
        mission: str | None = _pick(raw, "charity_purpose", "purpose", "activities") or None
        sector: str | None = _pick(raw, "main_activity", "activity", "sector") or None

        content_hash = compute_content_hash(
            json.dumps(raw, sort_keys=True, default=str).encode()
        )

        normalized: dict[str, Any] = {
            "name": name,
            "slug": slug,
            "org_type": org_type,
            "mission": mission,
            "sector": sector,
            "country_code": normalize_country("AU"),
            "jurisdiction": state or None,
            "registry_source": REGISTRY_SOURCE,
            "registry_id": registry_id,
            "registration_date": registration_date,
            "status": status,
            "city": city or None,
            "state_province": state or None,
            "postal_code": postal_code,
            "_content_hash": content_hash,
        }
        rows.append(normalized)

    df = pd.DataFrame(rows)
    context.log.info(
        f"australia_acnc_normalized: {len(df)} rows normalized from "
        f"{len(australia_acnc_raw)} raw rows"
    )
    return df


@asset(
    name="australia_acnc_loaded",
    description="Upsert normalized Australia ACNC charities into organizations table",
    group_name="loading",
    deps=["australia_acnc_normalized"],
)
def load_australia_acnc(
    context,  # noqa: ANN001 — Dagster resolves context type at runtime
    supabase: SupabaseResource,
    australia_acnc_normalized: pd.DataFrame,
) -> int:
    """Upsert normalized ACNC charities into the Supabase organizations table.

    Uses ON CONFLICT (registry_source, registry_id) for idempotency.
    Records progress in the scrape_runs audit table.

    Args:
        context: Dagster asset execution context.
        australia_acnc_normalized: Normalized DataFrame from
            ``normalize_australia_acnc``.

    Returns:
        Total number of rows upserted.
    """
    client = supabase.get_client()

    run_id = start_scrape_run(
        client,
        source=REGISTRY_SOURCE,
        spider_name="australia_acnc_loaded",
        metadata={"row_count": len(australia_acnc_normalized)},
    )

    if australia_acnc_normalized.empty:
        context.log.warning("load_australia_acnc: empty DataFrame, nothing to load")
        complete_scrape_run(
            client,
            run_id=run_id,
            records_found=0,
            records_new=0,
            records_updated=0,
        )
        return 0

    records_found = len(australia_acnc_normalized)
    records_new = 0
    records_updated = 0
    records_failed = 0

    try:
        _internal_cols = {"_content_hash"}
        rows_to_upsert: list[dict[str, Any]] = []

        for _, row in australia_acnc_normalized.iterrows():
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
            f"load_australia_acnc: upserted {records_new} rows "
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
        logger.error("load_australia_acnc_failed", error=error_msg)
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
