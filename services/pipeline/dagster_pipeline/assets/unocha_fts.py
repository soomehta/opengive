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
    normalize_country,
)
from dagster_pipeline.utils.tracking import (
    complete_scrape_run,
    fail_scrape_run,
    start_scrape_run,
)

logger = structlog.get_logger()

# UN OCHA Financial Tracking Service (FTS) public REST API.
FTS_BASE = "https://api.hpc.tools/v2/public"

REGISTRY_SOURCE = "unocha_fts"

# Politeness delay (seconds).
_REQUEST_DELAY_SECONDS = 2.0

# Records per page.
_PAGE_SIZE = 100

# Maximum pages to fetch in one materialisation (None = exhaustive).
_MAX_PAGES: int | None = 5  # ~500 flows in dev/demo mode

# FTS flows endpoint — covers humanitarian funding flows.
_FLOWS_ENDPOINT = f"{FTS_BASE}/fts/flow"


async def _fetch_flows_page(
    client: httpx.AsyncClient,
    page: int,
) -> tuple[list[dict[str, Any]], bool]:
    """Fetch one page of humanitarian funding flows from the FTS API.

    Args:
        client: Shared async HTTP client.
        page: 1-based page index.

    Returns:
        Tuple of (list of raw flow dicts, has_more: bool).
    """
    try:
        resp = await client.get(
            _FLOWS_ENDPOINT,
            params={
                "limit": _PAGE_SIZE,
                "page": page,
            },
            headers={
                "Accept": "application/json",
                "User-Agent": "OpenGive/0.1 (+https://opengive.org) httpx",
            },
        )
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()

        # FTS API v2 shape: {"status": "ok", "data": {"flows": [...], "total": N}}
        payload: dict[str, Any] = data.get("data", {}) or {}
        flows: list[dict[str, Any]] = payload.get("flows", []) or []
        total: int = int(payload.get("total", payload.get("count", 0)))
        has_more = (page * _PAGE_SIZE) < total

        logger.debug(
            "fts_page_fetched",
            page=page,
            count=len(flows),
            total=total,
            has_more=has_more,
        )
        return flows, has_more

    except httpx.HTTPStatusError as exc:
        logger.warning(
            "fts_http_error",
            page=page,
            status=exc.response.status_code,
            error=str(exc),
        )
        return [], False
    except Exception as exc:
        logger.warning("fts_fetch_error", page=page, error=str(exc))
        return [], False


async def _run_fetch(context: Any) -> list[dict[str, Any]]:
    """Paginate through the UN OCHA FTS flows endpoint with politeness delays.

    Args:
        context: Dagster asset execution context.

    Returns:
        Flat list of raw FTS flow dicts.
    """
    all_flows: list[dict[str, Any]] = []
    page = 1

    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        while True:
            await asyncio.sleep(_REQUEST_DELAY_SECONDS)
            flows, has_more = await _fetch_flows_page(client, page)
            all_flows.extend(flows)

            context.log.debug(
                f"FTS page {page}: {len(flows)} flows, "
                f"total so far: {len(all_flows)}"
            )

            if not flows or not has_more:
                break

            if _MAX_PAGES is not None and page >= _MAX_PAGES:
                context.log.info(
                    f"Reached _MAX_PAGES={_MAX_PAGES}, stopping pagination"
                )
                break

            page += 1

    context.log.info(
        f"UN OCHA FTS fetch complete: {len(all_flows)} flows across {page} page(s)"
    )
    return all_flows


@asset(
    name="unocha_fts_raw",
    description="Fetch humanitarian funding flows from the UN OCHA FTS API",
    group_name="ingestion",
)
def fetch_unocha_fts(context) -> pd.DataFrame:  # noqa: ANN001 — Dagster resolves context type at runtime
    """Fetch humanitarian funding flows from the UN OCHA FTS public API.

    Paginates through the ``/fts/flow`` endpoint, applying a mandatory
    ``_REQUEST_DELAY_SECONDS`` delay between requests.

    Args:
        context: Dagster asset execution context.

    Returns:
        DataFrame of raw FTS flow records.  May be empty if all requests fail.
    """
    flows = asyncio.run(_run_fetch(context))

    if not flows:
        context.log.warning("unocha_fts_raw: no flows fetched")
        return pd.DataFrame()

    df = pd.DataFrame(flows)
    context.log.info(
        f"unocha_fts_raw: {len(df)} rows, columns={list(df.columns)}"
    )
    return df


@asset(
    name="unocha_fts_normalized",
    description="Normalize UN OCHA FTS flow data to OpenGive grants schema",
    group_name="normalization",
    deps=["unocha_fts_raw"],
)
def normalize_unocha_fts(
    context,  # noqa: ANN001 — Dagster resolves context type at runtime
    unocha_fts_raw: pd.DataFrame,
) -> pd.DataFrame:
    """Map UN OCHA FTS API fields to the OpenGive grants table schema.

    Field mapping (FTS API v2):
        id                            -> registry_grant_id
        description / name            -> title
        sourceObjects[type=Organization].name -> funder_name
        destinationObjects[type=Organization].name -> recipient_name
        amountUSD                     -> amount_usd
        originalAmount / originalCurrency -> amount_local / currency
        date                          -> award_date
        destinationObjects[type=Location].name -> country_code (resolved)
        boundary                      -> purpose (IN / OUT direction)
        'unocha_fts'                  -> registry_source

    Args:
        context: Dagster asset execution context.
        unocha_fts_raw: Raw DataFrame produced by ``fetch_unocha_fts``.

    Returns:
        Normalized DataFrame ready for upsert into the grants table.
    """
    if unocha_fts_raw.empty:
        context.log.warning("normalize_unocha_fts: received empty DataFrame, skipping")
        return pd.DataFrame()

    def _extract_org_from_objects(
        objects: list[Any],
        obj_type: str,
    ) -> tuple[str | None, str | None]:
        """Extract the first name and id from a list of FTS source/destination objects.

        Args:
            objects: Raw list of FTS object dicts.
            obj_type: The object type to search for, e.g. 'Organization'.

        Returns:
            Tuple of (name, id) or (None, None) if not found.
        """
        if not isinstance(objects, list):
            return None, None
        for obj in objects:
            if not isinstance(obj, dict):
                continue
            if str(obj.get("type", "") or "").strip() == obj_type:
                name: str | None = str(obj.get("name", "") or "").strip() or None
                obj_id: str | None = str(obj.get("id", "") or "").strip() or None
                return name, obj_id
        return None, None

    def _extract_country_from_objects(objects: list[Any]) -> str | None:
        """Extract a country code from FTS destination objects."""
        if not isinstance(objects, list):
            return None
        for obj in objects:
            if not isinstance(obj, dict):
                continue
            if str(obj.get("type", "") or "").strip() == "Location":
                iso_code = str(obj.get("isoCode", obj.get("iso_code", "")) or "").strip()
                if iso_code:
                    return normalize_country(iso_code)
        return None

    rows: list[dict[str, Any]] = []

    for _, row_s in unocha_fts_raw.iterrows():
        raw: dict[str, Any] = row_s.to_dict()

        flow_id: str = str(raw.get("id", "") or "").strip()
        if not flow_id:
            logger.warning("fts_missing_flow_id", row=raw)
            continue

        title: str = (
            str(raw.get("description", raw.get("name", "")) or "").strip()
            or f"FTS Flow {flow_id}"
        )

        # Source = funder, destination = recipient
        source_objs: list[Any] = raw.get("sourceObjects", []) or []
        dest_objs: list[Any] = raw.get("destinationObjects", []) or []

        funder_name, funder_id = _extract_org_from_objects(source_objs, "Organization")
        recipient_name, recipient_id = _extract_org_from_objects(dest_objs, "Organization")
        country_code = _extract_country_from_objects(dest_objs)

        # Amounts
        try:
            amount_usd = float(raw.get("amountUSD", 0) or 0)
        except (TypeError, ValueError):
            amount_usd = 0.0

        currency: str = str(raw.get("originalCurrency", "USD") or "USD").strip().upper()
        try:
            amount_local = float(raw.get("originalAmount", amount_usd) or amount_usd)
        except (TypeError, ValueError):
            amount_local = amount_usd

        # Date
        award_date: str | None = str(raw.get("date", raw.get("flowDate", "")) or "").strip() or None

        # Purpose / boundary
        purpose: str | None = str(raw.get("boundary", raw.get("flowType", "")) or "").strip() or None

        content_hash = compute_content_hash(
            json.dumps(raw, sort_keys=True, default=str).encode()
        )

        normalized: dict[str, Any] = {
            "registry_grant_id": flow_id,
            "title": title,
            "funder_name": funder_name,
            "funder_registry_id": funder_id,
            "funder_slug": generate_slug(funder_name) if funder_name else None,
            "recipient_name": recipient_name,
            "recipient_registry_id": recipient_id,
            "currency": currency,
            "amount_local": amount_local,
            "amount_usd": amount_usd,
            "award_date": award_date,
            "purpose": purpose,
            "country_code": country_code,
            "registry_source": REGISTRY_SOURCE,
            "_content_hash": content_hash,
        }
        rows.append(normalized)

    df = pd.DataFrame(rows)
    context.log.info(
        f"unocha_fts_normalized: {len(df)} rows normalized from "
        f"{len(unocha_fts_raw)} raw rows"
    )
    return df


@asset(
    name="unocha_fts_loaded",
    description="Upsert normalized UN OCHA FTS humanitarian flows into the grants table",
    group_name="loading",
    deps=["unocha_fts_normalized"],
)
def load_unocha_fts(
    context,  # noqa: ANN001 — Dagster resolves context type at runtime
    supabase: SupabaseResource,
    unocha_fts_normalized: pd.DataFrame,
) -> int:
    """Upsert normalized FTS flows into the Supabase grants table.

    Uses ON CONFLICT (registry_source, registry_grant_id) for idempotency.
    Records progress in the scrape_runs audit table.

    Args:
        context: Dagster asset execution context.
        unocha_fts_normalized: Normalized DataFrame from ``normalize_unocha_fts``.

    Returns:
        Total number of rows upserted.
    """
    client = supabase.get_client()

    run_id = start_scrape_run(
        client,
        source=REGISTRY_SOURCE,
        spider_name="unocha_fts_loaded",
        metadata={"row_count": len(unocha_fts_normalized)},
    )

    if unocha_fts_normalized.empty:
        context.log.warning("load_unocha_fts: empty DataFrame, nothing to load")
        complete_scrape_run(
            client,
            run_id=run_id,
            records_found=0,
            records_new=0,
            records_updated=0,
        )
        return 0

    records_found = len(unocha_fts_normalized)
    records_new = 0
    records_updated = 0
    records_failed = 0

    try:
        _internal_cols = {"_content_hash"}
        rows_to_upsert: list[dict[str, Any]] = []

        for _, row in unocha_fts_normalized.iterrows():
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
                client.table("grants")
                .upsert(
                    batch,
                    on_conflict="registry_source,registry_grant_id",
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
            f"load_unocha_fts: upserted {records_new} rows "
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
        logger.error("load_unocha_fts_failed", error=error_msg)
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
