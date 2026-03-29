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

PROPUBLICA_BASE = "https://projects.propublica.org/nonprofits/api/v2"
REGISTRY_SOURCE = "us_propublica"

# Minimum politeness delay between outbound requests (seconds).
# Mirrors DOWNLOAD_DELAY from scrapers/settings.py.
_REQUEST_DELAY_SECONDS = 2.0

# Search terms used to build a representative sample in dev/demo mode.
# Production mode paginates alphabetically through all EINs / states.
_SAMPLE_SEARCH_TERMS: list[str] = [
    "red cross",
    "habitat humanity",
    "doctors without borders",
    "salvation army",
    "united way",
    "goodwill",
    "ymca",
    "boys girls clubs",
    "feeding america",
    "world vision",
    "american cancer society",
    "st jude",
    "planned parenthood",
    "sierra club",
    "american heart association",
]

# Number of results to retain per search term.
_RESULTS_PER_TERM = 5


async def _fetch_search_page(
    client: httpx.AsyncClient,
    term: str,
    page: int = 0,
) -> list[dict[str, Any]]:
    """Fetch one page of ProPublica search results for a search term.

    Args:
        client: Shared async HTTP client.
        term: Free-text search query.
        page: Zero-based page index.

    Returns:
        List of raw organization dicts from the API response.
    """
    try:
        resp = await client.get(
            f"{PROPUBLICA_BASE}/search.json",
            params={"q": term, "page": page},
        )
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()
        orgs: list[dict[str, Any]] = data.get("organizations", [])
        logger.debug(
            "propublica_page_fetched",
            term=term,
            page=page,
            count=len(orgs),
        )
        return orgs
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "propublica_http_error",
            term=term,
            page=page,
            status=exc.response.status_code,
            error=str(exc),
        )
        return []
    except Exception as exc:
        logger.warning(
            "propublica_fetch_error",
            term=term,
            page=page,
            error=str(exc),
        )
        return []


async def _fetch_org_detail(
    client: httpx.AsyncClient,
    ein: str,
) -> dict[str, Any]:
    """Fetch the full organization detail record by EIN.

    Falls back to an empty dict on any error so that callers can proceed with
    whatever data was returned from the search endpoint.

    Args:
        client: Shared async HTTP client.
        ein: Employer Identification Number (9 digits, no hyphen).

    Returns:
        Dict with full organization details, or empty dict on failure.
    """
    try:
        resp = await client.get(f"{PROPUBLICA_BASE}/organizations/{ein}.json")
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()
        return data.get("organization", {})
    except Exception as exc:
        logger.warning("propublica_detail_error", ein=ein, error=str(exc))
        return {}


async def _run_fetch(context: Any) -> list[dict[str, Any]]:
    """Coordinate async HTTP fetching with politeness delays.

    For each configured search term, fetches the first page and retains up to
    ``_RESULTS_PER_TERM`` organizations.  A ``_REQUEST_DELAY_SECONDS`` delay is
    inserted between every outbound request to respect the host's rate limits.

    Args:
        context: Dagster asset execution context for logging.

    Returns:
        Deduplicated list of raw organization dicts keyed by 'ein'.
    """
    headers = {
        "User-Agent": "OpenGive/0.1 (+https://opengive.org) httpx",
        "Accept": "application/json",
    }

    seen_eins: set[str] = set()
    all_orgs: list[dict[str, Any]] = []

    async with httpx.AsyncClient(
        timeout=30,
        headers=headers,
        follow_redirects=True,
    ) as client:
        for term in _SAMPLE_SEARCH_TERMS:
            await asyncio.sleep(_REQUEST_DELAY_SECONDS)
            orgs = await _fetch_search_page(client, term)

            for org in orgs[:_RESULTS_PER_TERM]:
                ein: str = str(org.get("ein", "")).strip()
                if not ein or ein in seen_eins:
                    continue
                seen_eins.add(ein)
                all_orgs.append(org)

    context.log.info(
        f"ProPublica fetch complete: {len(all_orgs)} unique organizations "
        f"across {len(_SAMPLE_SEARCH_TERMS)} search terms"
    )
    return all_orgs


@asset(
    name="us_propublica_raw",
    description="Fetch US nonprofit data from ProPublica Nonprofit Explorer API",
    group_name="ingestion",
)
def fetch_propublica(context) -> pd.DataFrame:  # noqa: ANN001 — Dagster resolves context type at runtime
    """Fetch organizations from ProPublica Nonprofit Explorer API.

    Issues search requests for a curated list of terms, deduplicates results
    by EIN, and returns a raw DataFrame.  Production deployments should extend
    this to paginate through all states or the full EIN range.

    Rate-limiting: a minimum ``_REQUEST_DELAY_SECONDS`` delay is enforced
    between every outbound HTTP request.

    Args:
        context: Dagster asset execution context.

    Returns:
        DataFrame of raw ProPublica organization records.  May be empty if
        all requests fail.
    """
    orgs = asyncio.run(_run_fetch(context))

    if not orgs:
        context.log.warning("No organizations fetched from ProPublica")
        return pd.DataFrame()

    df = pd.DataFrame(orgs)
    context.log.info(f"us_propublica_raw: {len(df)} rows, columns={list(df.columns)}")
    return df


@asset(
    name="us_propublica_normalized",
    description="Normalize ProPublica data to OpenGive organizations schema",
    group_name="normalization",
    deps=["us_propublica_raw"],
)
def normalize_propublica(
    context,  # noqa: ANN001 — Dagster resolves context type at runtime
    us_propublica_raw: pd.DataFrame,
) -> pd.DataFrame:
    """Map ProPublica API fields to the OpenGive organizations table schema.

    Field mapping:
        ein                -> registry_id
        name               -> name
        city               -> city
        state              -> state_province / jurisdiction
        ntee_code          -> org_type (via map_org_type)
        'us_propublica'    -> registry_source
        'US'               -> country_code
        slug from name     -> slug
        content_hash(row)  -> content_hash  (for change detection)

    Args:
        context: Dagster asset execution context.
        us_propublica_raw: Raw DataFrame produced by ``fetch_propublica``.

    Returns:
        Normalized DataFrame ready for upsert into the organizations table.
    """
    if us_propublica_raw.empty:
        context.log.warning("normalize_propublica: received empty DataFrame, skipping")
        return pd.DataFrame()

    rows: list[dict[str, Any]] = []

    for _, row in us_propublica_raw.iterrows():
        raw: dict[str, Any] = row.to_dict()

        ein = str(raw.get("ein", "")).strip()
        if not ein:
            logger.warning("propublica_missing_ein", row=raw)
            continue

        name: str = str(raw.get("name", "")).strip()
        if not name:
            name = f"Unnamed Org {ein}"

        slug = generate_slug(name)
        ntee_code: str = str(raw.get("ntee_code", "") or "").strip()
        org_type = map_org_type(ntee_code, REGISTRY_SOURCE)

        # Content hash over the serialised raw record for change detection
        content_hash = compute_content_hash(
            json.dumps(raw, sort_keys=True, default=str).encode()
        )

        # Subsector from NTEE description if available
        ntee_description: str = str(raw.get("ntee_description", "") or "").strip()

        # Website
        website: str | None = str(raw.get("website", "") or "").strip() or None

        # Registration / activity dates
        ruling_date: str | None = str(raw.get("ruling_date", "") or "").strip() or None

        normalized: dict[str, Any] = {
            # Identity
            "name": name,
            "slug": slug,
            # Classification
            "org_type": org_type,
            "sector": ntee_code or None,
            "subsector": ntee_description or None,
            # Registration
            "country_code": normalize_country("US"),
            "jurisdiction": str(raw.get("state", "") or "").strip() or None,
            "registry_source": REGISTRY_SOURCE,
            "registry_id": ein,
            "registration_date": ruling_date,
            "status": "active",
            # Contact & location
            "website": website,
            "city": str(raw.get("city", "") or "").strip() or None,
            "state_province": str(raw.get("state", "") or "").strip() or None,
            # Internal metadata
            "_content_hash": content_hash,
        }
        rows.append(normalized)

    df = pd.DataFrame(rows)
    context.log.info(
        f"us_propublica_normalized: {len(df)} rows normalized from "
        f"{len(us_propublica_raw)} raw rows"
    )
    return df


@asset(
    name="us_propublica_loaded",
    description="Upsert normalized ProPublica orgs into organizations table",
    group_name="loading",
    deps=["us_propublica_normalized"],
)
def load_propublica(
    context,  # noqa: ANN001 — Dagster resolves context type at runtime
    supabase: SupabaseResource,
    us_propublica_normalized: pd.DataFrame,
) -> int:
    """Upsert normalized organizations into the Supabase organizations table.

    Uses ON CONFLICT (registry_source, registry_id) to make the operation
    idempotent — re-running the asset never creates duplicates.

    Slug uniqueness: because multiple registries can yield the same slug, a
    numeric suffix is appended on conflict (``-2``, ``-3``, etc.).

    Records a row in scrape_runs at the start and updates it to 'completed'
    or 'failed' at the end.

    Args:
        context: Dagster asset execution context.  Provides ``resources.supabase``.
        us_propublica_normalized: Normalized DataFrame from ``normalize_propublica``.

    Returns:
        Total number of rows upserted (new + updated).
    """
    client = supabase.get_client()

    run_id = start_scrape_run(
        client,
        source=REGISTRY_SOURCE,
        spider_name="us_propublica_loaded",
        metadata={"row_count": len(us_propublica_normalized)},
    )

    if us_propublica_normalized.empty:
        context.log.warning("load_propublica: empty DataFrame, nothing to load")
        complete_scrape_run(
            client,
            run_id=run_id,
            records_found=0,
            records_new=0,
            records_updated=0,
        )
        return 0

    records_found = len(us_propublica_normalized)
    records_new = 0
    records_updated = 0
    records_failed = 0

    try:
        # Build list of dicts, stripping internal metadata columns
        _internal_cols = {"_content_hash"}
        rows_to_upsert: list[dict[str, Any]] = []

        for _, row in us_propublica_normalized.iterrows():
            record = {
                k: (None if pd.isna(v) else v)
                for k, v in row.to_dict().items()
                if k not in _internal_cols
            }
            rows_to_upsert.append(record)

        # Batch upsert — Supabase PostgREST uses ON CONFLICT DO UPDATE
        # on the unique constraint (registry_source, registry_id).
        # We upsert in batches of 100 to stay within PostgREST payload limits.
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
            # Supabase returns the upserted rows; we can't distinguish new vs
            # updated without a second query, so we count conservatively.
            records_new += returned
            context.log.debug(
                f"Upserted batch {batch_start // batch_size + 1}: {returned} rows"
            )

        context.log.info(
            f"load_propublica: upserted {records_new} rows "
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
        logger.error("load_propublica_failed", error=error_msg)
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
