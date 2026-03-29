from __future__ import annotations

# ---------------------------------------------------------------------------
# Dagster assets for India and GCC data sources (Sprint 7)
#
# Sources:
#   - India NGO Darpan  (Scrapy spider via CrawlerProcess)
#   - India FCRA Portal (Playwright scraper)
#   - India MCA         (Scrapy spider via CrawlerProcess)
#   - GCC Ministry Portals (Playwright scraper, best-effort)
#
# Each source follows the 3-stage pattern:
#   raw asset  → normalize asset → load asset
#
# Scrape-run provenance is recorded in the scrape_runs table via the
# tracking utilities for every load asset.
# ---------------------------------------------------------------------------

import json
import traceback
from typing import Any

import pandas as pd
import structlog
from dagster import asset
from scrapy.crawler import CrawlerProcess
from scrapy.utils.project import get_project_settings

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

# ---------------------------------------------------------------------------
# Shared constants
# ---------------------------------------------------------------------------

_REQUEST_DELAY_SECONDS = 2.0
_BATCH_SIZE = 100

# ---------------------------------------------------------------------------
# Scrapy runner helper
# ---------------------------------------------------------------------------


def _run_scrapy_spider(spider_cls: type) -> list[dict[str, Any]]:
    """Run a Scrapy spider in-process and collect yielded items.

    Spiders must yield plain ``dict`` items (not Scrapy ``Item`` objects) so
    that they can be accumulated without a dedicated item pipeline.

    The ``_RAW_ITEMS`` list is thread-local to this call; the spider class
    attribute is set immediately before the crawl and cleared after.

    Args:
        spider_cls: A Scrapy Spider class.

    Returns:
        List of dicts yielded by the spider.
    """
    collected: list[dict[str, Any]] = []

    # Attach a collector list to the spider class so the spider can append
    # items directly — avoiding the need to configure an item pipeline.
    spider_cls._collected_items = collected  # type: ignore[attr-defined]

    settings = get_project_settings()
    # Ensure politeness settings from settings.py are honoured.
    settings.setdict(
        {
            "ROBOTSTXT_OBEY": True,
            "DOWNLOAD_DELAY": 2,
            "AUTOTHROTTLE_ENABLED": True,
            "LOG_LEVEL": "WARNING",  # Suppress per-item Scrapy noise in Dagster logs.
            # Wire up an in-process item collector pipeline.
            "ITEM_PIPELINES": {
                "dagster_pipeline.assets.india_scrapers._CollectorPipeline": 100,
            },
        }
    )

    process = CrawlerProcess(settings)
    process.crawl(spider_cls)
    process.start()

    # Remove the class-level reference to avoid cross-run contamination.
    spider_cls._collected_items = None  # type: ignore[attr-defined]

    return collected


class _CollectorPipeline:
    """Minimal Scrapy item pipeline that appends items to the spider's list.

    The spider class must expose a ``_collected_items`` list attribute before
    the crawl starts.  This pipeline is registered dynamically in
    ``_run_scrapy_spider``.
    """

    def process_item(self, item: Any, spider: Any) -> Any:
        """Append item to the spider's collector list.

        Args:
            item: Any item yielded by the spider.
            spider: The running Scrapy Spider instance.

        Returns:
            The item unchanged (Scrapy requires this).
        """
        target: list[dict[str, Any]] | None = getattr(
            spider.__class__, "_collected_items", None
        )
        if target is not None and isinstance(item, dict):
            target.append(item)
        return item


# ---------------------------------------------------------------------------
# Helper: generic load function (shared by all three India sources + GCC)
# ---------------------------------------------------------------------------


def _load_records(
    context: Any,
    supabase: SupabaseResource,
    normalized_df: pd.DataFrame,
    registry_source: str,
    asset_name: str,
) -> int:
    """Upsert a normalized DataFrame into the organizations table.

    Uses ON CONFLICT (registry_source, registry_id) for idempotency.
    Records the run in the scrape_runs audit table.

    Args:
        context: Dagster asset execution context.
        supabase: Supabase resource.
        normalized_df: Normalized DataFrame from the corresponding normalize asset.
        registry_source: Registry source identifier string.
        asset_name: Human-readable name for the scrape_runs row.

    Returns:
        Total rows upserted.
    """
    client = supabase.get_client()
    run_id = start_scrape_run(
        client,
        source=registry_source,
        spider_name=asset_name,
        metadata={"row_count": len(normalized_df)},
    )

    if normalized_df.empty:
        context.log.warning(f"{asset_name}: empty DataFrame, nothing to load")
        complete_scrape_run(
            client,
            run_id=run_id,
            records_found=0,
            records_new=0,
            records_updated=0,
        )
        return 0

    records_found = len(normalized_df)
    records_new = 0
    records_updated = 0
    records_failed = 0

    try:
        _internal_cols = {"_content_hash", "_raw"}
        rows_to_upsert: list[dict[str, Any]] = []

        for _, row in normalized_df.iterrows():
            record = {
                k: (None if pd.isna(v) else v)
                for k, v in row.to_dict().items()
                if k not in _internal_cols
            }
            rows_to_upsert.append(record)

        for batch_start in range(0, len(rows_to_upsert), _BATCH_SIZE):
            batch = rows_to_upsert[batch_start : batch_start + _BATCH_SIZE]
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
                f"Upserted batch {batch_start // _BATCH_SIZE + 1}: {returned} rows"
            )

        context.log.info(
            f"{asset_name}: upserted {records_new} rows "
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
        logger.error(f"{asset_name}_failed", error=error_msg)
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


# ===========================================================================
# S7-H01 — India NGO Darpan
# ===========================================================================

_NGO_DARPAN_SOURCE = "in_ngo_darpan"


@asset(
    name="india_ngo_darpan_raw",
    description="Fetch India NGO Darpan organizations via Scrapy spider",
    group_name="ingestion",
)
def fetch_india_ngo_darpan(context) -> pd.DataFrame:  # noqa: ANN001
    """Run the IndiaNgoDarpanSpider and return raw records as a DataFrame.

    Invokes the Scrapy spider in-process via CrawlerProcess.  The spider
    paginates through the NGO Darpan AJAX search API and yields one dict
    per organization.

    Args:
        context: Dagster asset execution context.

    Returns:
        DataFrame of raw NGO Darpan records.
    """
    from scrapers.spiders.india_ngo_darpan import IndiaNgoDarpanSpider  # noqa: PLC0415

    context.log.info("india_ngo_darpan_raw: starting Scrapy crawl")
    items = _run_scrapy_spider(IndiaNgoDarpanSpider)

    if not items:
        context.log.warning("india_ngo_darpan_raw: no items collected")
        return pd.DataFrame()

    df = pd.DataFrame(items)
    context.log.info(
        f"india_ngo_darpan_raw: {len(df)} rows, columns={list(df.columns)}"
    )
    return df


@asset(
    name="india_ngo_darpan_normalized",
    description="Normalize India NGO Darpan data to OpenGive organizations schema",
    group_name="normalization",
    deps=["india_ngo_darpan_raw"],
)
def normalize_india_ngo_darpan(
    context,  # noqa: ANN001
    india_ngo_darpan_raw: pd.DataFrame,
) -> pd.DataFrame:
    """Normalize raw NGO Darpan items to the OpenGive organizations schema.

    The spider already performs basic field mapping; this stage applies
    canonical normalizations (slug, org_type, country_code, content hash)
    and drops any rows that lack a registry_id.

    Field mapping:
        name            -> name (already set)
        registry_id     -> registry_id (unique_id or registration_no)
        state_province  -> state_province
        city            -> city
        sector          -> sector
        phone / email   -> contact fields
        website         -> website
        'in_ngo_darpan' -> registry_source
        'IN'            -> country_code

    Args:
        context: Dagster asset execution context.
        india_ngo_darpan_raw: Raw DataFrame from ``fetch_india_ngo_darpan``.

    Returns:
        Normalized DataFrame ready for upsert.
    """
    if india_ngo_darpan_raw.empty:
        context.log.warning("normalize_india_ngo_darpan: empty DataFrame, skipping")
        return pd.DataFrame()

    rows: list[dict[str, Any]] = []

    for _, row_s in india_ngo_darpan_raw.iterrows():
        raw: dict[str, Any] = row_s.to_dict()

        registry_id = str(raw.get("registry_id", "") or "").strip()
        if not registry_id:
            logger.warning("ngo_darpan_missing_registry_id", row=raw)
            continue

        name = str(raw.get("name", "") or "").strip() or f"Unnamed NGO {registry_id}"
        slug = generate_slug(name)

        # Recompute content hash from the stored _raw payload if available,
        # otherwise hash the full row dict for consistency.
        raw_payload: dict[str, Any] = raw.get("_raw") or raw
        if not isinstance(raw_payload, dict):
            raw_payload = raw
        content_hash = str(raw.get("_content_hash", "") or "").strip() or compute_content_hash(
            json.dumps(raw_payload, sort_keys=True, default=str).encode()
        )

        normalized: dict[str, Any] = {
            "name": name,
            "slug": slug,
            "org_type": "ngo",
            "sector": str(raw.get("sector", "") or "").strip() or None,
            "country_code": normalize_country("IN"),
            "state_province": str(raw.get("state_province", "") or "").strip() or None,
            "city": str(raw.get("city", "") or "").strip() or None,
            "registry_source": _NGO_DARPAN_SOURCE,
            "registry_id": registry_id,
            "status": "active",
            "website": str(raw.get("website", "") or "").strip() or None,
            "phone": str(raw.get("phone", "") or "").strip() or None,
            "email": str(raw.get("email", "") or "").strip() or None,
            "_content_hash": content_hash,
        }
        rows.append(normalized)

    df = pd.DataFrame(rows)
    context.log.info(
        f"normalize_india_ngo_darpan: {len(df)} rows normalized from "
        f"{len(india_ngo_darpan_raw)} raw rows"
    )
    return df


@asset(
    name="india_ngo_darpan_loaded",
    description="Upsert normalized India NGO Darpan organizations into organizations table",
    group_name="loading",
    deps=["india_ngo_darpan_normalized"],
)
def load_india_ngo_darpan(
    context,  # noqa: ANN001
    supabase: SupabaseResource,
    india_ngo_darpan_normalized: pd.DataFrame,
) -> int:
    """Upsert normalized NGO Darpan records into the organizations table.

    Args:
        context: Dagster asset execution context.
        supabase: Supabase resource.
        india_ngo_darpan_normalized: Normalized DataFrame.

    Returns:
        Total rows upserted.
    """
    return _load_records(
        context=context,
        supabase=supabase,
        normalized_df=india_ngo_darpan_normalized,
        registry_source=_NGO_DARPAN_SOURCE,
        asset_name="india_ngo_darpan_loaded",
    )


# ===========================================================================
# S7-H02 — India FCRA Portal
# ===========================================================================

_FCRA_SOURCE = "in_fcra"


@asset(
    name="india_fcra_raw",
    description="Fetch India FCRA registered organizations via Playwright scraper",
    group_name="ingestion",
)
def fetch_india_fcra(context) -> pd.DataFrame:  # noqa: ANN001
    """Run the FCRA Playwright scraper and return raw records as a DataFrame.

    The FCRA portal is a JavaScript-heavy ASP.NET application; Playwright
    is used for browser automation.  The scraper honours the 2 s minimum
    delay policy and handles pagination of the JS-rendered results table.

    Args:
        context: Dagster asset execution context.

    Returns:
        DataFrame of raw FCRA records.  May be empty if the portal is
        unavailable or no records are returned.
    """
    from scrapers.playwright_scrapers.india_fcra_portal import run_fcra_scraper  # noqa: PLC0415

    context.log.info("india_fcra_raw: starting Playwright scraper")
    try:
        items = run_fcra_scraper()
    except ImportError as exc:
        context.log.error(f"india_fcra_raw: Playwright not installed — {exc}")
        return pd.DataFrame()
    except Exception as exc:
        context.log.error(f"india_fcra_raw: scraper error — {exc}")
        return pd.DataFrame()

    if not items:
        context.log.warning("india_fcra_raw: no items collected")
        return pd.DataFrame()

    df = pd.DataFrame(items)
    context.log.info(
        f"india_fcra_raw: {len(df)} rows, columns={list(df.columns)}"
    )
    return df


@asset(
    name="india_fcra_normalized",
    description="Normalize India FCRA data to OpenGive organizations schema",
    group_name="normalization",
    deps=["india_fcra_raw"],
)
def normalize_india_fcra(
    context,  # noqa: ANN001
    india_fcra_raw: pd.DataFrame,
) -> pd.DataFrame:
    """Normalize raw FCRA records to the OpenGive organizations schema.

    Field mapping:
        name            -> name
        fcra_reg_no     -> registry_id
        state           -> state_province
        purpose         -> sector
        status          -> status (normalized)
        'in_fcra'       -> registry_source
        'IN'            -> country_code

    Args:
        context: Dagster asset execution context.
        india_fcra_raw: Raw DataFrame from ``fetch_india_fcra``.

    Returns:
        Normalized DataFrame ready for upsert.
    """
    if india_fcra_raw.empty:
        context.log.warning("normalize_india_fcra: empty DataFrame, skipping")
        return pd.DataFrame()

    rows: list[dict[str, Any]] = []

    for _, row_s in india_fcra_raw.iterrows():
        raw: dict[str, Any] = row_s.to_dict()

        registry_id = str(raw.get("registry_id", "") or "").strip()
        if not registry_id:
            logger.warning("fcra_missing_registry_id", row=raw)
            continue

        name = str(raw.get("name", "") or "").strip() or f"Unnamed FCRA Org {registry_id}"
        slug = generate_slug(name)

        raw_status = str(raw.get("status", "") or "").strip().lower()
        if raw_status in {"active", "registered", "valid"}:
            status = "active"
        elif raw_status in {"cancelled", "revoked", "rejected"}:
            status = "inactive"
        else:
            status = "active"

        raw_payload: dict[str, Any] = raw.get("_raw") or raw
        if not isinstance(raw_payload, dict):
            raw_payload = raw
        content_hash = str(raw.get("_content_hash", "") or "").strip() or compute_content_hash(
            json.dumps(raw_payload, sort_keys=True, default=str).encode()
        )

        normalized: dict[str, Any] = {
            "name": name,
            "slug": slug,
            "org_type": "ngo",
            "sector": str(raw.get("sector", "") or "").strip() or None,
            "country_code": normalize_country("IN"),
            "state_province": str(raw.get("state_province", "") or "").strip() or None,
            "registry_source": _FCRA_SOURCE,
            "registry_id": registry_id,
            "status": status,
            "_content_hash": content_hash,
        }
        rows.append(normalized)

    df = pd.DataFrame(rows)
    context.log.info(
        f"normalize_india_fcra: {len(df)} rows normalized from "
        f"{len(india_fcra_raw)} raw rows"
    )
    return df


@asset(
    name="india_fcra_loaded",
    description="Upsert normalized India FCRA organizations into organizations table",
    group_name="loading",
    deps=["india_fcra_normalized"],
)
def load_india_fcra(
    context,  # noqa: ANN001
    supabase: SupabaseResource,
    india_fcra_normalized: pd.DataFrame,
) -> int:
    """Upsert normalized FCRA records into the organizations table.

    Args:
        context: Dagster asset execution context.
        supabase: Supabase resource.
        india_fcra_normalized: Normalized DataFrame.

    Returns:
        Total rows upserted.
    """
    return _load_records(
        context=context,
        supabase=supabase,
        normalized_df=india_fcra_normalized,
        registry_source=_FCRA_SOURCE,
        asset_name="india_fcra_loaded",
    )


# ===========================================================================
# S7-H03 — India MCA Section 8
# ===========================================================================

_MCA_SOURCE = "in_mca"


@asset(
    name="india_mca_raw",
    description="Fetch India MCA Section 8 companies via Scrapy spider",
    group_name="ingestion",
)
def fetch_india_mca(context) -> pd.DataFrame:  # noqa: ANN001
    """Run the IndiaMcaSpider and return raw records as a DataFrame.

    Paginates through the MCA company master data API filtering for
    Section 8 (non-profit) company class.

    Args:
        context: Dagster asset execution context.

    Returns:
        DataFrame of raw MCA company records.
    """
    from scrapers.spiders.india_mca import IndiaMcaSpider  # noqa: PLC0415

    context.log.info("india_mca_raw: starting Scrapy crawl")
    items = _run_scrapy_spider(IndiaMcaSpider)

    if not items:
        context.log.warning("india_mca_raw: no items collected")
        return pd.DataFrame()

    df = pd.DataFrame(items)
    context.log.info(
        f"india_mca_raw: {len(df)} rows, columns={list(df.columns)}"
    )
    return df


@asset(
    name="india_mca_normalized",
    description="Normalize India MCA Section 8 data to OpenGive organizations schema",
    group_name="normalization",
    deps=["india_mca_raw"],
)
def normalize_india_mca(
    context,  # noqa: ANN001
    india_mca_raw: pd.DataFrame,
) -> pd.DataFrame:
    """Normalize raw MCA company records to the OpenGive organizations schema.

    Field mapping:
        name              -> name
        registry_id (CIN) -> registry_id
        state_province    -> state_province
        address_line1     -> address_line1
        registration_date -> registration_date
        status            -> status (normalized)
        'in_mca'          -> registry_source
        'IN'              -> country_code

    Args:
        context: Dagster asset execution context.
        india_mca_raw: Raw DataFrame from ``fetch_india_mca``.

    Returns:
        Normalized DataFrame ready for upsert.
    """
    if india_mca_raw.empty:
        context.log.warning("normalize_india_mca: empty DataFrame, skipping")
        return pd.DataFrame()

    rows: list[dict[str, Any]] = []

    for _, row_s in india_mca_raw.iterrows():
        raw: dict[str, Any] = row_s.to_dict()

        registry_id = str(raw.get("registry_id", "") or "").strip()
        if not registry_id:
            logger.warning("mca_missing_registry_id", row=raw)
            continue

        name = str(raw.get("name", "") or "").strip() or f"Unnamed MCA Company {registry_id}"
        slug = generate_slug(name)

        raw_status = str(raw.get("status", "active") or "").strip().lower()
        if raw_status in {"active", "registered"}:
            status = "active"
        elif raw_status in {"dissolved", "struck off", "liquidated"}:
            status = "dissolved"
        elif raw_status in {"suspended", "under process of striking off"}:
            status = "suspended"
        else:
            status = "active"

        raw_payload: dict[str, Any] = raw.get("_raw") or raw
        if not isinstance(raw_payload, dict):
            raw_payload = raw
        content_hash = str(raw.get("_content_hash", "") or "").strip() or compute_content_hash(
            json.dumps(raw_payload, sort_keys=True, default=str).encode()
        )

        normalized: dict[str, Any] = {
            "name": name,
            "slug": slug,
            "org_type": "nonprofit",
            "country_code": normalize_country("IN"),
            "state_province": str(raw.get("state_province", "") or "").strip() or None,
            "address_line1": str(raw.get("address_line1", "") or "").strip() or None,
            "registry_source": _MCA_SOURCE,
            "registry_id": registry_id,
            "registration_date": str(raw.get("registration_date", "") or "").strip() or None,
            "status": status,
            "_content_hash": content_hash,
        }
        rows.append(normalized)

    df = pd.DataFrame(rows)
    context.log.info(
        f"normalize_india_mca: {len(df)} rows normalized from "
        f"{len(india_mca_raw)} raw rows"
    )
    return df


@asset(
    name="india_mca_loaded",
    description="Upsert normalized India MCA Section 8 companies into organizations table",
    group_name="loading",
    deps=["india_mca_normalized"],
)
def load_india_mca(
    context,  # noqa: ANN001
    supabase: SupabaseResource,
    india_mca_normalized: pd.DataFrame,
) -> int:
    """Upsert normalized MCA records into the organizations table.

    Args:
        context: Dagster asset execution context.
        supabase: Supabase resource.
        india_mca_normalized: Normalized DataFrame.

    Returns:
        Total rows upserted.
    """
    return _load_records(
        context=context,
        supabase=supabase,
        normalized_df=india_mca_normalized,
        registry_source=_MCA_SOURCE,
        asset_name="india_mca_loaded",
    )


# ===========================================================================
# S7-H04 — GCC Ministry Portals (best-effort)
# ===========================================================================

_GCC_SOURCE = "gcc_directories"


@asset(
    name="gcc_directories_raw",
    description="Fetch GCC ministry portal NGO/charity listings via Playwright (best-effort)",
    group_name="ingestion",
)
def fetch_gcc_directories(context) -> pd.DataFrame:  # noqa: ANN001
    """Run the GCC Playwright scraper and return raw records as a DataFrame.

    Scrapes GCC ministry NGO / charity directories from UAE, Saudi Arabia,
    Kuwait, Qatar, Bahrain, and Oman.  All individual portal failures are
    swallowed and logged as warnings — the asset always succeeds.

    Args:
        context: Dagster asset execution context.

    Returns:
        DataFrame of raw GCC directory records.  May be empty if all
        portals fail or are unavailable.
    """
    from scrapers.playwright_scrapers.gcc_ministry_portals import run_gcc_scraper  # noqa: PLC0415

    context.log.info("gcc_directories_raw: starting Playwright scraper")
    try:
        items = run_gcc_scraper()
    except ImportError as exc:
        context.log.warning(f"gcc_directories_raw: Playwright not installed — {exc}")
        return pd.DataFrame()
    except Exception as exc:
        # Best-effort: log and return empty rather than failing the pipeline.
        context.log.warning(f"gcc_directories_raw: scraper error — {exc}")
        return pd.DataFrame()

    if not items:
        context.log.warning("gcc_directories_raw: no items collected from any portal")
        return pd.DataFrame()

    df = pd.DataFrame(items)
    context.log.info(
        f"gcc_directories_raw: {len(df)} rows, columns={list(df.columns)}"
    )
    return df


@asset(
    name="gcc_directories_normalized",
    description="Normalize GCC ministry portal data to OpenGive organizations schema",
    group_name="normalization",
    deps=["gcc_directories_raw"],
)
def normalize_gcc_directories(
    context,  # noqa: ANN001
    gcc_directories_raw: pd.DataFrame,
) -> pd.DataFrame:
    """Normalize raw GCC portal records to the OpenGive organizations schema.

    Field mapping:
        name            -> name
        registry_id     -> registry_id (reg_no or synthetic slug-based ID)
        country_code    -> country_code (per-portal ISO code)
        state_province  -> state_province
        'gcc_directories' -> registry_source

    Parse failures on individual rows are logged as warnings and skipped —
    this asset must not raise exceptions.

    Args:
        context: Dagster asset execution context.
        gcc_directories_raw: Raw DataFrame from ``fetch_gcc_directories``.

    Returns:
        Normalized DataFrame ready for upsert.
    """
    if gcc_directories_raw.empty:
        context.log.warning("normalize_gcc_directories: empty DataFrame, skipping")
        return pd.DataFrame()

    rows: list[dict[str, Any]] = []

    for _, row_s in gcc_directories_raw.iterrows():
        try:
            raw: dict[str, Any] = row_s.to_dict()

            registry_id = str(raw.get("registry_id", "") or "").strip()
            if not registry_id:
                logger.warning("gcc_missing_registry_id", row=raw)
                continue

            name = str(raw.get("name", "") or "").strip() or f"Unnamed GCC Org {registry_id}"
            slug = generate_slug(name)

            country_code_raw = str(raw.get("country_code", "") or "").strip()
            country_code = normalize_country(country_code_raw) if country_code_raw else "AE"

            raw_payload: dict[str, Any] = raw.get("_raw") or raw
            if not isinstance(raw_payload, dict):
                raw_payload = raw
            content_hash = str(raw.get("_content_hash", "") or "").strip() or compute_content_hash(
                json.dumps(raw_payload, sort_keys=True, default=str).encode()
            )

            normalized: dict[str, Any] = {
                "name": name,
                "slug": slug,
                "org_type": "ngo",
                "country_code": country_code,
                "state_province": str(raw.get("state_province", "") or "").strip() or None,
                "registry_source": _GCC_SOURCE,
                "registry_id": registry_id,
                "status": "active",
                "_content_hash": content_hash,
            }
            rows.append(normalized)

        except Exception as row_exc:
            # Best-effort row: log warning and continue.
            logger.warning(
                "gcc_normalize_row_warning",
                error=str(row_exc),
            )

    df = pd.DataFrame(rows)
    context.log.info(
        f"normalize_gcc_directories: {len(df)} rows normalized from "
        f"{len(gcc_directories_raw)} raw rows"
    )
    return df


@asset(
    name="gcc_directories_loaded",
    description="Upsert normalized GCC directory organizations into organizations table",
    group_name="loading",
    deps=["gcc_directories_normalized"],
)
def load_gcc_directories(
    context,  # noqa: ANN001
    supabase: SupabaseResource,
    gcc_directories_normalized: pd.DataFrame,
) -> int:
    """Upsert normalized GCC records into the organizations table.

    Args:
        context: Dagster asset execution context.
        supabase: Supabase resource.
        gcc_directories_normalized: Normalized DataFrame.

    Returns:
        Total rows upserted.
    """
    return _load_records(
        context=context,
        supabase=supabase,
        normalized_df=gcc_directories_normalized,
        registry_source=_GCC_SOURCE,
        asset_name="gcc_directories_loaded",
    )
