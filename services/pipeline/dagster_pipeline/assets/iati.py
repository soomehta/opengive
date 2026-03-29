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

IATI_BASE = "https://api.iatistandard.org/datastore"
REGISTRY_SOURCE = "iati"

# Politeness delay between outbound requests (seconds).
_REQUEST_DELAY_SECONDS = 2.0

# Records per page.
_PAGE_SIZE = 100

# Maximum pages to fetch in one materialisation (None = exhaustive).
_MAX_PAGES: int | None = 5  # ~500 activities in dev/demo mode

# IATI transaction type codes that represent outgoing aid flows.
# Type 3 = Disbursement, Type 4 = Expenditure, Type 2 = Commitment.
_RELEVANT_TRANSACTION_TYPES: frozenset[str] = frozenset({"2", "3", "4"})


async def _fetch_activities_page(
    client: httpx.AsyncClient,
    page: int,
) -> tuple[list[dict[str, Any]], bool]:
    """Fetch one page of IATI activities from the IATI Datastore API.

    Uses the ``/activity`` endpoint with Solr-style pagination.

    Args:
        client: Shared async HTTP client.
        page: 1-based page index.

    Returns:
        Tuple of (list of raw activity dicts, has_more: bool).
    """
    try:
        resp = await client.get(
            f"{IATI_BASE}/activity/",
            params={
                "format": "json",
                "page_size": _PAGE_SIZE,
                "page": page,
            },
            headers={
                "Accept": "application/json",
                "User-Agent": "OpenGive/0.1 (+https://opengive.org) httpx",
            },
        )
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()

        # IATI Datastore wraps results under 'results' with 'iati-activity' key.
        results: dict[str, Any] | list[Any] = data.get("results", {})
        if isinstance(results, dict):
            activities: list[dict[str, Any]] = results.get("iati-activity", [])
        elif isinstance(results, list):
            activities = results
        else:
            activities = []

        total: int = int(data.get("count", 0))
        has_more = (page * _PAGE_SIZE) < total

        logger.debug(
            "iati_page_fetched",
            page=page,
            count=len(activities),
            total=total,
            has_more=has_more,
        )
        return activities, has_more

    except httpx.HTTPStatusError as exc:
        logger.warning(
            "iati_http_error",
            page=page,
            status=exc.response.status_code,
            error=str(exc),
        )
        return [], False
    except Exception as exc:
        logger.warning("iati_fetch_error", page=page, error=str(exc))
        return [], False


async def _run_fetch(context: Any) -> list[dict[str, Any]]:
    """Paginate through the IATI Datastore with politeness delays.

    Args:
        context: Dagster asset execution context for logging.

    Returns:
        Flat list of raw IATI activity dicts.
    """
    all_activities: list[dict[str, Any]] = []
    page = 1

    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        while True:
            await asyncio.sleep(_REQUEST_DELAY_SECONDS)
            activities, has_more = await _fetch_activities_page(client, page)
            all_activities.extend(activities)

            context.log.debug(
                f"IATI page {page}: {len(activities)} activities, "
                f"total so far: {len(all_activities)}"
            )

            if not activities or not has_more:
                break

            if _MAX_PAGES is not None and page >= _MAX_PAGES:
                context.log.info(
                    f"Reached _MAX_PAGES={_MAX_PAGES}, stopping pagination"
                )
                break

            page += 1

    context.log.info(
        f"IATI fetch complete: {len(all_activities)} activities across {page} page(s)"
    )
    return all_activities


@asset(
    name="iati_raw",
    description="Fetch international aid activities from the IATI Datastore API",
    group_name="ingestion",
)
def fetch_iati(context) -> pd.DataFrame:  # noqa: ANN001 — Dagster resolves context type at runtime
    """Fetch aid activity records from the IATI Datastore API.

    Paginates through activities, applying a mandatory ``_REQUEST_DELAY_SECONDS``
    delay between requests.

    Args:
        context: Dagster asset execution context.

    Returns:
        DataFrame of raw IATI activity records.  May be empty if all
        requests fail.
    """
    activities = asyncio.run(_run_fetch(context))

    if not activities:
        context.log.warning("No activities fetched from IATI Datastore")
        return pd.DataFrame()

    df = pd.DataFrame(activities)
    context.log.info(f"iati_raw: {len(df)} rows, columns={list(df.columns)}")
    return df


def _extract_transactions(
    activity: dict[str, Any],
) -> list[dict[str, Any]]:
    """Extract financial transaction records from a single IATI activity dict.

    Flattens nested ``transaction`` arrays into a list of flat dicts that
    can be mapped 1-to-1 with grant table rows.

    Args:
        activity: A single raw IATI activity dict.

    Returns:
        List of flat transaction dicts with context from the parent activity.
    """
    iati_id: str = str(activity.get("iati-identifier", "") or "").strip()

    # Reporting organisation (funder)
    reporting_org: dict[str, Any] = activity.get("reporting-org", {}) or {}
    funder_name: str | None = (
        str(reporting_org.get("narrative", reporting_org.get("#text", "")) or "").strip()
        or None
    )
    funder_id: str | None = str(reporting_org.get("@ref", "") or "").strip() or None

    # Activity title
    title_obj: Any = activity.get("title", {}) or {}
    title: str = (
        str(title_obj.get("narrative", title_obj) or iati_id).strip()
        if isinstance(title_obj, dict)
        else str(title_obj).strip()
    )

    # Recipient country — take first entry
    recipient_countries: list[Any] = activity.get("recipient-country", []) or []
    if isinstance(recipient_countries, dict):
        recipient_countries = [recipient_countries]
    country_code: str | None = None
    if recipient_countries:
        raw_cc = str(recipient_countries[0].get("@code", "") or "").strip()
        country_code = normalize_country(raw_cc) if raw_cc else None

    # Description
    desc_obj: Any = activity.get("description", {}) or {}
    description: str | None = (
        str(desc_obj.get("narrative", desc_obj) or "").strip() or None
        if isinstance(desc_obj, dict)
        else str(desc_obj).strip() or None
    )

    # Transactions
    raw_transactions: Any = activity.get("transaction", []) or []
    if isinstance(raw_transactions, dict):
        raw_transactions = [raw_transactions]

    flat_transactions: list[dict[str, Any]] = []
    for idx, txn in enumerate(raw_transactions):
        if not isinstance(txn, dict):
            continue

        txn_type_obj: Any = txn.get("transaction-type", {}) or {}
        txn_type: str = str(
            txn_type_obj.get("@code", txn_type_obj) if isinstance(txn_type_obj, dict)
            else txn_type_obj
        ).strip()

        if txn_type not in _RELEVANT_TRANSACTION_TYPES:
            continue

        # Receiver organisation
        receiver_org: dict[str, Any] = txn.get("receiver-org", {}) or {}
        recipient_name: str | None = (
            str(receiver_org.get("narrative", receiver_org.get("#text", "")) or "").strip()
            or None
        )
        recipient_id: str | None = (
            str(receiver_org.get("@ref", "") or "").strip() or None
        )

        # Amount
        value_obj: Any = txn.get("value", {}) or {}
        try:
            amount_local = float(
                value_obj.get("#text", value_obj) if isinstance(value_obj, dict)
                else value_obj
            )
        except (TypeError, ValueError):
            amount_local = 0.0

        currency: str = (
            str(value_obj.get("@currency", "") or "USD").strip().upper()
            if isinstance(value_obj, dict)
            else "USD"
        )
        # IATI amounts are typically in native currency; use as-is for amount_usd
        # unless a proper FX layer is available.
        amount_usd: float = amount_local if currency == "USD" else amount_local

        # Transaction date
        txn_date_obj: Any = txn.get("transaction-date", {}) or {}
        txn_date: str | None = (
            str(txn_date_obj.get("@iso-date", "") or "").strip() or None
            if isinstance(txn_date_obj, dict)
            else str(txn_date_obj).strip() or None
        )

        # Unique ID: activity IATI id + transaction index
        registry_grant_id = f"{iati_id}:txn{idx}"

        flat_transactions.append(
            {
                "registry_grant_id": registry_grant_id,
                "iati_activity_id": iati_id,
                "title": title,
                "description": description,
                "funder_name": funder_name,
                "funder_registry_id": funder_id,
                "funder_slug": generate_slug(funder_name) if funder_name else None,
                "recipient_name": recipient_name,
                "recipient_registry_id": recipient_id,
                "currency": currency,
                "amount_local": amount_local,
                "amount_usd": amount_usd,
                "award_date": txn_date,
                "country_code": country_code,
                "transaction_type": txn_type,
                "registry_source": REGISTRY_SOURCE,
            }
        )

    return flat_transactions


@asset(
    name="iati_normalized",
    description="Normalize IATI activity data to OpenGive grants schema",
    group_name="normalization",
    deps=["iati_raw"],
)
def normalize_iati(
    context,  # noqa: ANN001 — Dagster resolves context type at runtime
    iati_raw: pd.DataFrame,
) -> pd.DataFrame:
    """Flatten and map IATI activity/transaction data to the grants table schema.

    Each IATI activity may contain multiple financial transactions.  Only
    disbursements (type 3), expenditures (type 4), and commitments (type 2)
    are retained.  One row is emitted per relevant transaction.

    Field mapping:
        iati-identifier           -> iati_activity_id (metadata)
        reporting-org             -> funder_name / funder_registry_id
        receiver-org              -> recipient_name / recipient_registry_id
        transaction.value         -> amount_local / amount_usd
        transaction.@currency     -> currency
        transaction-date          -> award_date
        recipient-country         -> country_code
        'iati'                    -> registry_source

    Args:
        context: Dagster asset execution context.
        iati_raw: Raw DataFrame produced by ``fetch_iati``.

    Returns:
        Normalized DataFrame ready for upsert into the grants table.
    """
    if iati_raw.empty:
        context.log.warning("normalize_iati: received empty DataFrame, skipping")
        return pd.DataFrame()

    all_transactions: list[dict[str, Any]] = []

    for _, row in iati_raw.iterrows():
        raw: dict[str, Any] = row.to_dict()
        content_hash = compute_content_hash(
            json.dumps(raw, sort_keys=True, default=str).encode()
        )
        transactions = _extract_transactions(raw)
        for txn in transactions:
            txn["_content_hash"] = content_hash
            all_transactions.append(txn)

    if not all_transactions:
        context.log.warning(
            "normalize_iati: no relevant transactions found in any activity"
        )
        return pd.DataFrame()

    df = pd.DataFrame(all_transactions)
    context.log.info(
        f"iati_normalized: {len(df)} transaction rows from "
        f"{len(iati_raw)} raw activities"
    )
    return df


@asset(
    name="iati_loaded",
    description="Upsert normalized IATI aid flow grants into the grants table",
    group_name="loading",
    deps=["iati_normalized"],
)
def load_iati(
    context,  # noqa: ANN001 — Dagster resolves context type at runtime
    supabase: SupabaseResource,
    iati_normalized: pd.DataFrame,
) -> int:
    """Upsert normalized IATI grant records into the Supabase grants table.

    Uses ON CONFLICT (registry_source, registry_grant_id) for idempotency.
    Records progress in the scrape_runs audit table.

    Args:
        context: Dagster asset execution context.
        iati_normalized: Normalized DataFrame from ``normalize_iati``.

    Returns:
        Total number of rows upserted.
    """
    client = supabase.get_client()

    run_id = start_scrape_run(
        client,
        source=REGISTRY_SOURCE,
        spider_name="iati_loaded",
        metadata={"row_count": len(iati_normalized)},
    )

    if iati_normalized.empty:
        context.log.warning("load_iati: empty DataFrame, nothing to load")
        complete_scrape_run(
            client,
            run_id=run_id,
            records_found=0,
            records_new=0,
            records_updated=0,
        )
        return 0

    records_found = len(iati_normalized)
    records_new = 0
    records_updated = 0
    records_failed = 0

    try:
        _internal_cols = {"_content_hash"}
        rows_to_upsert: list[dict[str, Any]] = []

        for _, row in iati_normalized.iterrows():
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
            f"load_iati: upserted {records_new} rows "
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
        logger.error("load_iati_failed", error=error_msg)
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
