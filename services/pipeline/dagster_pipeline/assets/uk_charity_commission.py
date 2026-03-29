from __future__ import annotations

import asyncio
import json
import os
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

UK_CC_BASE = "https://api.charitycommission.gov.uk/register/api"
REGISTRY_SOURCE = "uk_charity_commission"

# Politeness: minimum delay between consecutive outbound requests (seconds).
_REQUEST_DELAY_SECONDS = 2.0

# Number of records to request per paginated API call.
_PAGE_SIZE = 20

# Maximum pages to fetch in a single asset materialisation.
# Set to None to paginate exhaustively (production mode).
_MAX_PAGES: int | None = 5  # ~100 orgs in dev/demo mode

# Charity statuses to retrieve (mapped to OpenGive 'status').
_STATUS_MAP: dict[str, str] = {
    "registered": "active",
    "removed": "inactive",
    "removed - voluntary": "inactive",
    "removed - regulatory": "suspended",
    "removed - amalgamated": "dissolved",
    "removed - dissolved": "dissolved",
}


def _get_api_key() -> str:
    """Read the UK Charity Commission API key from the environment.

    Returns:
        The API key string.

    Raises:
        RuntimeError: If ``UK_CHARITY_COMMISSION_API_KEY`` is not set.
    """
    key = os.environ.get("UK_CHARITY_COMMISSION_API_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "UK_CHARITY_COMMISSION_API_KEY environment variable is not set. "
            "Obtain an API key from https://register-of-charities.charitycommission.gov.uk/"
        )
    return key


async def _fetch_charity_page(
    client: httpx.AsyncClient,
    api_key: str,
    page_number: int,
) -> tuple[list[dict[str, Any]], bool]:
    """Fetch one page of charities from the UK Charity Commission register API.

    The API accepts ``pageNumber`` (1-based) and ``pageSize`` query parameters.

    Args:
        client: Shared async HTTP client.
        api_key: UK Charity Commission API key.
        page_number: 1-based page index.

    Returns:
        Tuple of (list of raw charity dicts, has_more: bool).
        ``has_more`` is True when the page was full, indicating more data.
    """
    try:
        resp = await client.get(
            f"{UK_CC_BASE}/charities",
            params={
                "pageNumber": page_number,
                "pageSize": _PAGE_SIZE,
                "status": "registered",  # Active charities only
            },
            headers={
                "Ocp-Apim-Subscription-Key": api_key,
                "Accept": "application/json",
                "User-Agent": "OpenGive/0.1 (+https://opengive.org) httpx",
            },
        )
        resp.raise_for_status()
        data: Any = resp.json()

        # The API returns either a list directly or a paginated wrapper object.
        if isinstance(data, list):
            charities: list[dict[str, Any]] = data
        elif isinstance(data, dict):
            # Possible wrapper shapes: {"charities": [...]} or {"data": [...]}
            charities = (
                data.get("charities")
                or data.get("data")
                or data.get("results")
                or []
            )
        else:
            charities = []

        has_more = len(charities) >= _PAGE_SIZE
        logger.debug(
            "uk_cc_page_fetched",
            page=page_number,
            count=len(charities),
            has_more=has_more,
        )
        return charities, has_more

    except httpx.HTTPStatusError as exc:
        logger.warning(
            "uk_cc_http_error",
            page=page_number,
            status=exc.response.status_code,
            error=str(exc),
        )
        return [], False
    except Exception as exc:
        logger.warning(
            "uk_cc_fetch_error",
            page=page_number,
            error=str(exc),
        )
        return [], False


async def _fetch_charity_detail(
    client: httpx.AsyncClient,
    api_key: str,
    charity_number: str,
) -> dict[str, Any]:
    """Fetch full detail for a single charity by its registered number.

    Args:
        client: Shared async HTTP client.
        api_key: UK Charity Commission API key.
        charity_number: The charity's registration number.

    Returns:
        Full charity detail dict, or empty dict on failure.
    """
    try:
        resp = await client.get(
            f"{UK_CC_BASE}/charities/{charity_number}",
            headers={
                "Ocp-Apim-Subscription-Key": api_key,
                "Accept": "application/json",
                "User-Agent": "OpenGive/0.1 (+https://opengive.org) httpx",
            },
        )
        resp.raise_for_status()
        data: Any = resp.json()
        return data if isinstance(data, dict) else {}
    except Exception as exc:
        logger.warning(
            "uk_cc_detail_error",
            charity_number=charity_number,
            error=str(exc),
        )
        return {}


async def _run_fetch(context: Any) -> list[dict[str, Any]]:
    """Paginate through the UK Charity Commission register with politeness delays.

    Fetches up to ``_MAX_PAGES`` pages (or all pages if ``_MAX_PAGES`` is None).
    Inserts a ``_REQUEST_DELAY_SECONDS`` sleep between every HTTP request.

    Args:
        context: Dagster asset execution context for logging.

    Returns:
        Flat list of raw charity dicts from the API.
    """
    api_key = _get_api_key()
    all_charities: list[dict[str, Any]] = []
    page = 1

    async with httpx.AsyncClient(
        timeout=30,
        follow_redirects=True,
    ) as client:
        while True:
            await asyncio.sleep(_REQUEST_DELAY_SECONDS)
            charities, has_more = await _fetch_charity_page(client, api_key, page)
            all_charities.extend(charities)

            context.log.debug(
                f"UK CC page {page}: {len(charities)} records, "
                f"total so far: {len(all_charities)}"
            )

            if not has_more:
                break

            if _MAX_PAGES is not None and page >= _MAX_PAGES:
                context.log.info(
                    f"Reached _MAX_PAGES={_MAX_PAGES}, stopping pagination"
                )
                break

            page += 1

    context.log.info(
        f"UK Charity Commission fetch complete: {len(all_charities)} charities "
        f"across {page} page(s)"
    )
    return all_charities


@asset(
    name="uk_charity_commission_raw",
    description="Fetch UK charity data from the Charity Commission register API",
    group_name="ingestion",
)
def fetch_uk_charity_commission(context) -> pd.DataFrame:  # noqa: ANN001 — Dagster resolves context type at runtime
    """Fetch registered charities from the UK Charity Commission API.

    Paginates through the ``/charities`` endpoint, applying a mandatory
    ``_REQUEST_DELAY_SECONDS`` delay between requests.  Requires the
    ``UK_CHARITY_COMMISSION_API_KEY`` environment variable to be set.

    Args:
        context: Dagster asset execution context.

    Returns:
        DataFrame of raw UK Charity Commission records.  May be empty if
        the API key is missing or all requests fail.
    """
    try:
        charities = asyncio.run(_run_fetch(context))
    except RuntimeError as exc:
        # API key missing — log and return empty rather than crashing Dagster.
        context.log.error(f"uk_charity_commission_raw: {exc}")
        return pd.DataFrame()

    if not charities:
        context.log.warning("No charities fetched from UK Charity Commission")
        return pd.DataFrame()

    df = pd.DataFrame(charities)
    context.log.info(
        f"uk_charity_commission_raw: {len(df)} rows, columns={list(df.columns)}"
    )
    return df


@asset(
    name="uk_charity_commission_normalized",
    description="Normalize UK Charity Commission data to OpenGive organizations schema",
    group_name="normalization",
    deps=["uk_charity_commission_raw"],
)
def normalize_uk_charity_commission(
    context,  # noqa: ANN001 — Dagster resolves context type at runtime
    uk_charity_commission_raw: pd.DataFrame,
) -> pd.DataFrame:
    """Map UK Charity Commission API fields to the OpenGive organizations schema.

    Field mapping:
        registeredCharityNumber  -> registry_id
        charityName              -> name
        charityType              -> org_type (via map_org_type)
        charityActivities        -> mission
        charityWebsite           -> website
        contact.address*         -> address fields
        registrationDate         -> registration_date
        removalDate              -> dissolution_date
        status                   -> status (via _STATUS_MAP)
        'uk_charity_commission'  -> registry_source
        'GB'                     -> country_code

    Args:
        context: Dagster asset execution context.
        uk_charity_commission_raw: Raw DataFrame from ``fetch_uk_charity_commission``.

    Returns:
        Normalized DataFrame ready for upsert into the organizations table.
    """
    if uk_charity_commission_raw.empty:
        context.log.warning(
            "normalize_uk_charity_commission: empty DataFrame, skipping"
        )
        return pd.DataFrame()

    rows: list[dict[str, Any]] = []

    for _, row in uk_charity_commission_raw.iterrows():
        raw: dict[str, Any] = row.to_dict()

        # Charity number — primary registry identifier
        charity_number = str(
            raw.get("registeredCharityNumber")
            or raw.get("charity_number")
            or raw.get("charityNumber")
            or ""
        ).strip()

        if not charity_number:
            logger.warning("uk_cc_missing_charity_number", row=raw)
            continue

        # Name
        name: str = str(
            raw.get("charityName")
            or raw.get("name")
            or ""
        ).strip()
        if not name:
            name = f"Unnamed Charity {charity_number}"

        slug = generate_slug(name)

        # Org type
        raw_type: str = str(
            raw.get("charityType")
            or raw.get("type")
            or ""
        ).strip()
        org_type = map_org_type(raw_type, REGISTRY_SOURCE)

        # Status
        raw_status: str = str(raw.get("status", "registered") or "").strip().lower()
        status = _STATUS_MAP.get(raw_status, "active")

        # Mission / activities
        mission: str | None = (
            str(raw.get("charityActivities") or raw.get("activities") or "").strip()
            or None
        )

        # Website
        website: str | None = (
            str(raw.get("charityWebsite") or raw.get("website") or "").strip()
            or None
        )

        # Registration / dissolution dates
        registration_date: str | None = (
            str(raw.get("registrationDate") or raw.get("date_of_registration") or "")
            .strip()
            or None
        )
        dissolution_date: str | None = (
            str(raw.get("removalDate") or raw.get("date_of_removal") or "").strip()
            or None
        )

        # Address fields — the CC API nests these under a 'contact' sub-object
        contact: dict[str, Any] = {}
        if isinstance(raw.get("contact"), dict):
            contact = raw["contact"]
        elif isinstance(raw.get("mainAddress"), dict):
            contact = raw["mainAddress"]

        city: str | None = (
            str(contact.get("town") or contact.get("city") or raw.get("city") or "")
            .strip()
            or None
        )
        postal_code: str | None = (
            str(
                contact.get("postcode")
                or contact.get("postal_code")
                or raw.get("postcode")
                or ""
            )
            .strip()
            or None
        )
        address_line1: str | None = (
            str(contact.get("address1") or contact.get("line1") or "").strip() or None
        )

        # Content hash for change detection
        content_hash = compute_content_hash(
            json.dumps(raw, sort_keys=True, default=str).encode()
        )

        normalized: dict[str, Any] = {
            # Identity
            "name": name,
            "slug": slug,
            # Classification
            "org_type": org_type,
            "mission": mission,
            # Registration
            "country_code": normalize_country("GB"),
            "jurisdiction": "England and Wales",
            "registry_source": REGISTRY_SOURCE,
            "registry_id": charity_number,
            "registration_date": registration_date,
            "dissolution_date": dissolution_date,
            "status": status,
            # Contact & location
            "website": website,
            "city": city,
            "postal_code": postal_code,
            "address_line1": address_line1,
            # Internal metadata
            "_content_hash": content_hash,
        }
        rows.append(normalized)

    df = pd.DataFrame(rows)
    context.log.info(
        f"uk_charity_commission_normalized: {len(df)} rows normalized from "
        f"{len(uk_charity_commission_raw)} raw rows"
    )
    return df


@asset(
    name="uk_charity_commission_loaded",
    description="Upsert normalized UK charity orgs into organizations table",
    group_name="loading",
    deps=["uk_charity_commission_normalized"],
)
def load_uk_charity_commission(
    context,  # noqa: ANN001 — Dagster resolves context type at runtime
    supabase: SupabaseResource,
    uk_charity_commission_normalized: pd.DataFrame,
) -> int:
    """Upsert normalized UK charities into the Supabase organizations table.

    Uses ON CONFLICT (registry_source, registry_id) for idempotency.
    Records progress in the scrape_runs audit table.

    Args:
        context: Dagster asset execution context.  Provides ``resources.supabase``.
        uk_charity_commission_normalized: Normalized DataFrame from
            ``normalize_uk_charity_commission``.

    Returns:
        Total number of rows upserted.
    """
    client = supabase.get_client()

    run_id = start_scrape_run(
        client,
        source=REGISTRY_SOURCE,
        spider_name="uk_charity_commission_loaded",
        metadata={"row_count": len(uk_charity_commission_normalized)},
    )

    if uk_charity_commission_normalized.empty:
        context.log.warning(
            "load_uk_charity_commission: empty DataFrame, nothing to load"
        )
        complete_scrape_run(
            client,
            run_id=run_id,
            records_found=0,
            records_new=0,
            records_updated=0,
        )
        return 0

    records_found = len(uk_charity_commission_normalized)
    records_new = 0
    records_updated = 0
    records_failed = 0

    try:
        _internal_cols = {"_content_hash"}
        rows_to_upsert: list[dict[str, Any]] = []

        for _, row in uk_charity_commission_normalized.iterrows():
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
            f"load_uk_charity_commission: upserted {records_new} rows "
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
        logger.error("load_uk_charity_commission_failed", error=error_msg)
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
