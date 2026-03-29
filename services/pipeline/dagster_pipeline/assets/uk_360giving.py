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

GRANTNAV_BASE = "https://grantnav.threesixtygiving.org/api"
REGISTRY_SOURCE = "uk_360giving"

# Politeness delay between outbound requests (seconds).
_REQUEST_DELAY_SECONDS = 2.0

# Records per page for the GrantNav API.
_PAGE_SIZE = 100

# Maximum pages to fetch in one materialisation (None = exhaustive).
_MAX_PAGES: int | None = 5  # ~500 grants in dev/demo mode

# Approximate GBP -> USD conversion rate.  Production should pull from a live
# exchange-rate feed; this constant is used as a fallback only.
_GBP_TO_USD: float = 1.27


async def _fetch_grants_page(
    client: httpx.AsyncClient,
    page: int,
) -> tuple[list[dict[str, Any]], bool]:
    """Fetch one page of grants from the GrantNav search API.

    Args:
        client: Shared async HTTP client.
        page: 1-based page index.

    Returns:
        Tuple of (list of raw grant dicts, has_more: bool).
    """
    try:
        resp = await client.get(
            f"{GRANTNAV_BASE}/grants/",
            params={
                "limit": _PAGE_SIZE,
                "offset": (page - 1) * _PAGE_SIZE,
                "status": "Actual",
            },
            headers={
                "Accept": "application/json",
                "User-Agent": "OpenGive/0.1 (+https://opengive.org) httpx",
            },
        )
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()

        # GrantNav paginates via {"grants": [...], "count": N, "next": url}
        grants: list[dict[str, Any]] = data.get("grants", []) or data.get("results", [])
        total: int = int(data.get("count", 0))
        offset_used = (page - 1) * _PAGE_SIZE
        has_more = (offset_used + len(grants)) < total

        logger.debug(
            "grantnav_page_fetched",
            page=page,
            count=len(grants),
            total=total,
            has_more=has_more,
        )
        return grants, has_more

    except httpx.HTTPStatusError as exc:
        logger.warning(
            "grantnav_http_error",
            page=page,
            status=exc.response.status_code,
            error=str(exc),
        )
        return [], False
    except Exception as exc:
        logger.warning("grantnav_fetch_error", page=page, error=str(exc))
        return [], False


async def _run_fetch(context: Any) -> list[dict[str, Any]]:
    """Paginate through the GrantNav grants API with politeness delays.

    Args:
        context: Dagster asset execution context for logging.

    Returns:
        Flat list of raw grant dicts from the API.
    """
    all_grants: list[dict[str, Any]] = []
    page = 1

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        while True:
            await asyncio.sleep(_REQUEST_DELAY_SECONDS)
            grants, has_more = await _fetch_grants_page(client, page)
            all_grants.extend(grants)

            context.log.debug(
                f"360Giving page {page}: {len(grants)} grants, "
                f"total so far: {len(all_grants)}"
            )

            if not grants or not has_more:
                break

            if _MAX_PAGES is not None and page >= _MAX_PAGES:
                context.log.info(
                    f"Reached _MAX_PAGES={_MAX_PAGES}, stopping pagination"
                )
                break

            page += 1

    context.log.info(
        f"360Giving fetch complete: {len(all_grants)} grants across {page} page(s)"
    )
    return all_grants


@asset(
    name="uk_360giving_raw",
    description="Fetch UK grant data from the 360Giving GrantNav API",
    group_name="ingestion",
)
def fetch_360giving(context) -> pd.DataFrame:  # noqa: ANN001 — Dagster resolves context type at runtime
    """Fetch grant records from the 360Giving GrantNav API.

    Paginates through all available grants, applying a mandatory
    ``_REQUEST_DELAY_SECONDS`` delay between requests.

    Args:
        context: Dagster asset execution context.

    Returns:
        DataFrame of raw 360Giving grant records.  May be empty if all
        requests fail.
    """
    grants = asyncio.run(_run_fetch(context))

    if not grants:
        context.log.warning("No grants fetched from 360Giving GrantNav")
        return pd.DataFrame()

    df = pd.DataFrame(grants)
    context.log.info(f"uk_360giving_raw: {len(df)} rows, columns={list(df.columns)}")
    return df


@asset(
    name="uk_360giving_normalized",
    description="Normalize 360Giving grant data to OpenGive grants schema",
    group_name="normalization",
    deps=["uk_360giving_raw"],
)
def normalize_360giving(
    context,  # noqa: ANN001 — Dagster resolves context type at runtime
    uk_360giving_raw: pd.DataFrame,
) -> pd.DataFrame:
    """Map 360Giving GrantNav fields to the OpenGive grants table schema.

    Field mapping (GrantNav uses 360G data standard):
        id                        -> registry_grant_id
        title                     -> title
        description               -> description
        fundingOrganization[0].name  -> funder_name
        recipientOrganization[0].name -> recipient_name
        currency                  -> currency (expect GBP)
        amountAwarded             -> amount_local
        amountAwarded * _GBP_TO_USD  -> amount_usd
        awardDate                 -> award_date
        plannedDates[0].endDate   -> end_date
        grantProgramme[0].title   -> purpose
        'uk_360giving'            -> registry_source
        'GB'                      -> country_code

    Args:
        context: Dagster asset execution context.
        uk_360giving_raw: Raw DataFrame produced by ``fetch_360giving``.

    Returns:
        Normalized DataFrame ready for upsert into the grants table.
    """
    if uk_360giving_raw.empty:
        context.log.warning("normalize_360giving: received empty DataFrame, skipping")
        return pd.DataFrame()

    rows: list[dict[str, Any]] = []

    for _, row in uk_360giving_raw.iterrows():
        raw: dict[str, Any] = row.to_dict()

        grant_id: str = str(raw.get("id", "") or "").strip()
        if not grant_id:
            logger.warning("360giving_missing_grant_id", row=raw)
            continue

        title: str = str(raw.get("title", "") or "").strip() or f"Grant {grant_id}"
        description: str | None = str(raw.get("description", "") or "").strip() or None

        # Funder — can be a list or dict
        funder_org = raw.get("fundingOrganization", raw.get("funding_org")) or {}
        if isinstance(funder_org, list) and funder_org:
            funder_org = funder_org[0]
        funder_name: str | None = (
            str(funder_org.get("name", "") or "").strip() or None
            if isinstance(funder_org, dict)
            else None
        )
        funder_id: str | None = (
            str(funder_org.get("id", "") or "").strip() or None
            if isinstance(funder_org, dict)
            else None
        )

        # Recipient
        recipient_org = raw.get("recipientOrganization", raw.get("recipient_org")) or {}
        if isinstance(recipient_org, list) and recipient_org:
            recipient_org = recipient_org[0]
        recipient_name: str | None = (
            str(recipient_org.get("name", "") or "").strip() or None
            if isinstance(recipient_org, dict)
            else None
        )
        recipient_id: str | None = (
            str(recipient_org.get("id", "") or "").strip() or None
            if isinstance(recipient_org, dict)
            else None
        )

        # Amount
        try:
            amount_local = float(raw.get("amountAwarded", raw.get("amount_awarded", 0)) or 0)
        except (TypeError, ValueError):
            amount_local = 0.0

        currency: str = str(raw.get("currency", "GBP") or "GBP").strip().upper()
        amount_usd: float = amount_local * _GBP_TO_USD if currency == "GBP" else amount_local

        # Dates
        award_date: str | None = str(raw.get("awardDate", raw.get("award_date", "")) or "").strip() or None

        planned_dates = raw.get("plannedDates") or []
        end_date: str | None = None
        if isinstance(planned_dates, list) and planned_dates:
            end_date = str(planned_dates[0].get("endDate", "") or "").strip() or None

        # Purpose / programme
        programmes = raw.get("grantProgramme") or []
        purpose: str | None = None
        if isinstance(programmes, list) and programmes:
            purpose = str(programmes[0].get("title", "") or "").strip() or None

        # Slug for the funder org (used for potential org linkage)
        funder_slug: str | None = generate_slug(funder_name) if funder_name else None

        content_hash = compute_content_hash(
            json.dumps(raw, sort_keys=True, default=str).encode()
        )

        normalized: dict[str, Any] = {
            "registry_grant_id": grant_id,
            "title": title,
            "description": description,
            "funder_name": funder_name,
            "funder_registry_id": funder_id,
            "funder_slug": funder_slug,
            "recipient_name": recipient_name,
            "recipient_registry_id": recipient_id,
            "currency": currency,
            "amount_local": amount_local,
            "amount_usd": amount_usd,
            "award_date": award_date,
            "end_date": end_date,
            "purpose": purpose,
            "country_code": normalize_country("GB"),
            "registry_source": REGISTRY_SOURCE,
            "_content_hash": content_hash,
        }
        rows.append(normalized)

    df = pd.DataFrame(rows)
    context.log.info(
        f"uk_360giving_normalized: {len(df)} rows normalized from "
        f"{len(uk_360giving_raw)} raw rows"
    )
    return df


@asset(
    name="uk_360giving_loaded",
    description="Upsert normalized 360Giving grants into the grants table",
    group_name="loading",
    deps=["uk_360giving_normalized"],
)
def load_360giving(
    context,  # noqa: ANN001 — Dagster resolves context type at runtime
    supabase: SupabaseResource,
    uk_360giving_normalized: pd.DataFrame,
) -> int:
    """Upsert normalized grant records into the Supabase grants table.

    Uses ON CONFLICT (registry_source, registry_grant_id) for idempotency.
    Records progress in the scrape_runs audit table.

    Args:
        context: Dagster asset execution context.
        uk_360giving_normalized: Normalized DataFrame from ``normalize_360giving``.

    Returns:
        Total number of rows upserted.
    """
    client = supabase.get_client()

    run_id = start_scrape_run(
        client,
        source=REGISTRY_SOURCE,
        spider_name="uk_360giving_loaded",
        metadata={"row_count": len(uk_360giving_normalized)},
    )

    if uk_360giving_normalized.empty:
        context.log.warning("load_360giving: empty DataFrame, nothing to load")
        complete_scrape_run(
            client,
            run_id=run_id,
            records_found=0,
            records_new=0,
            records_updated=0,
        )
        return 0

    records_found = len(uk_360giving_normalized)
    records_new = 0
    records_updated = 0
    records_failed = 0

    try:
        _internal_cols = {"_content_hash"}
        rows_to_upsert: list[dict[str, Any]] = []

        for _, row in uk_360giving_normalized.iterrows():
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
            f"load_360giving: upserted {records_new} rows "
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
        logger.error("load_360giving_failed", error=error_msg)
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
