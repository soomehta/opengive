from __future__ import annotations

import asyncio
import io
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

# Canada Revenue Agency bulk T3010 data download.
# CRA publishes charity information as an annual CSV dump.
CRA_BULK_URL = (
    "https://apps.cra-arc.gc.ca/ebci/hacc/srch/pub/dsplyBscSrch"
    "?request_locale=en"
)

# Fallback direct CSV URL for the registered charities list.
# CRA also exposes data via open.canada.ca (CKAN).
CRA_CSV_URL = (
    "https://www.canada.ca/content/dam/cra-arc/migration/cra-arc/chrts/"
    "lstngs/2024/Charities_Listings.csv"
)

# Open Canada CKAN dataset for registered charities.
CRA_CKAN_URL = (
    "https://open.canada.ca/data/en/datastore/dump/"
    "d2df8d7a-8e76-4c04-a8e4-ee9f84b3f2b7"
)

REGISTRY_SOURCE = "ca_cra"

# Politeness delay (seconds).
_REQUEST_DELAY_SECONDS = 2.0

# Maximum rows to process in dev/demo mode (None = all rows).
_MAX_ROWS: int | None = 500

# CRA CSV encoding (typically Latin-1 for legacy government files).
_CSV_ENCODING = "latin-1"


async def _download_csv(url: str) -> bytes:
    """Download a CSV file from the given URL.

    Args:
        url: Remote URL of the CSV file.

    Returns:
        Raw bytes of the CSV response body.

    Raises:
        httpx.HTTPStatusError: On non-2xx response.
    """
    await asyncio.sleep(_REQUEST_DELAY_SECONDS)
    async with httpx.AsyncClient(
        timeout=120,
        follow_redirects=True,
        headers={
            "User-Agent": "OpenGive/0.1 (+https://opengive.org) httpx",
            "Accept": "text/csv,application/octet-stream,*/*",
        },
    ) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.content


async def _run_fetch(context: Any) -> bytes:
    """Attempt to download the CRA registered charities CSV.

    Tries the CKAN dump URL first; falls back to the legacy direct URL.

    Args:
        context: Dagster asset execution context.

    Returns:
        Raw CSV bytes, or empty bytes if all attempts fail.
    """
    for url in [CRA_CKAN_URL, CRA_CSV_URL]:
        try:
            context.log.info(f"Attempting CRA download from: {url}")
            data = await _download_csv(url)
            context.log.info(
                f"CRA CSV downloaded: {len(data):,} bytes from {url}"
            )
            return data
        except Exception as exc:
            logger.warning("cra_download_failed", url=url, error=str(exc))
            continue

    logger.error("cra_all_downloads_failed")
    return b""


@asset(
    name="canada_cra_raw",
    description="Bulk-download Canada CRA registered charities CSV (T3010 data)",
    group_name="ingestion",
)
def fetch_canada_cra(context) -> pd.DataFrame:  # noqa: ANN001 — Dagster resolves context type at runtime
    """Download the Canada Revenue Agency registered charities CSV.

    The CRA publishes an annual dump of all registered charities including
    financial summaries from the T3010 Return.  The file is fetched in full
    and returned as a raw DataFrame.

    Args:
        context: Dagster asset execution context.

    Returns:
        DataFrame of raw CRA charity records.  May be empty if the download
        fails.
    """
    csv_bytes = asyncio.run(_run_fetch(context))

    if not csv_bytes:
        context.log.warning("canada_cra_raw: no data downloaded")
        return pd.DataFrame()

    try:
        df = pd.read_csv(
            io.BytesIO(csv_bytes),
            encoding=_CSV_ENCODING,
            dtype=str,
            on_bad_lines="skip",
            low_memory=False,
        )
    except Exception as exc:
        # Try UTF-8 as a second attempt
        try:
            df = pd.read_csv(
                io.BytesIO(csv_bytes),
                encoding="utf-8",
                dtype=str,
                on_bad_lines="skip",
                low_memory=False,
            )
        except Exception as exc2:
            context.log.error(
                f"canada_cra_raw: CSV parse failed: {exc}; utf-8 attempt: {exc2}"
            )
            return pd.DataFrame()

    if _MAX_ROWS is not None:
        df = df.head(_MAX_ROWS)

    # Normalise column names to lowercase snake_case
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    context.log.info(
        f"canada_cra_raw: {len(df)} rows, columns={list(df.columns)}"
    )
    return df


@asset(
    name="canada_cra_normalized",
    description="Normalize Canada CRA charity data to OpenGive organizations schema",
    group_name="normalization",
    deps=["canada_cra_raw"],
)
def normalize_canada_cra(
    context,  # noqa: ANN001 — Dagster resolves context type at runtime
    canada_cra_raw: pd.DataFrame,
) -> pd.DataFrame:
    """Map Canada CRA CSV fields to the OpenGive organizations table schema.

    The CRA CSV column names vary between annual releases.  This function
    uses a priority-ordered list of candidate column names for each field.

    Field mapping (T3010 / open-data CSV):
        bn / business_number / bn_registration  -> registry_id
        legal_name / organization_legal_name    -> name
        city                                    -> city
        province_territory / province           -> state_province / jurisdiction
        category_code / designation_code        -> org_type (via map_org_type)
        effective_date / registration_date      -> registration_date
        status / designations_status            -> status
        website_url / url                       -> website
        'ca_cra'                                -> registry_source
        'CA'                                    -> country_code

    Args:
        context: Dagster asset execution context.
        canada_cra_raw: Raw DataFrame from ``fetch_canada_cra``.

    Returns:
        Normalized DataFrame ready for upsert into the organizations table.
    """
    if canada_cra_raw.empty:
        context.log.warning("normalize_canada_cra: empty DataFrame, skipping")
        return pd.DataFrame()

    def _pick(row: dict[str, Any], *keys: str, default: str = "") -> str:
        """Return the first non-empty value from the candidate column keys."""
        for k in keys:
            v = str(row.get(k, "") or "").strip()
            if v and v.lower() not in {"nan", "none", "n/a", ""}:
                return v
        return default

    rows: list[dict[str, Any]] = []

    for _, row_s in canada_cra_raw.iterrows():
        raw: dict[str, Any] = row_s.to_dict()

        registry_id = _pick(
            raw,
            "bn",
            "business_number",
            "bn_registration",
            "registration_number",
            "charity_registration_number",
        )
        if not registry_id:
            logger.warning("cra_missing_registry_id", row=raw)
            continue

        name = _pick(
            raw,
            "legal_name",
            "organization_legal_name",
            "charity_name",
            "name",
            default=f"Unnamed Org {registry_id}",
        )

        slug = generate_slug(name)

        raw_type = _pick(
            raw,
            "category_code",
            "designation_code",
            "charity_category",
            "type",
        )
        org_type = map_org_type(raw_type, REGISTRY_SOURCE)

        raw_status = _pick(raw, "status", "designations_status", "charity_status").lower()
        if raw_status in {"revoked", "annulled", "suspended"}:
            status = "inactive"
        elif raw_status in {"registered", "active"}:
            status = "active"
        else:
            status = "active"

        province = _pick(
            raw,
            "province_territory",
            "province",
            "state_province",
            "prov_territory",
        )

        city = _pick(raw, "city", "municipality")
        postal_code: str | None = _pick(raw, "postal_code", "postal", "zip") or None
        website: str | None = _pick(raw, "website_url", "url", "website") or None
        registration_date: str | None = (
            _pick(raw, "effective_date", "registration_date", "date_registered") or None
        )

        content_hash = compute_content_hash(
            json.dumps(raw, sort_keys=True, default=str).encode()
        )

        normalized: dict[str, Any] = {
            "name": name,
            "slug": slug,
            "org_type": org_type,
            "country_code": normalize_country("CA"),
            "jurisdiction": province or None,
            "registry_source": REGISTRY_SOURCE,
            "registry_id": registry_id,
            "registration_date": registration_date,
            "status": status,
            "website": website,
            "city": city or None,
            "state_province": province or None,
            "postal_code": postal_code,
            "_content_hash": content_hash,
        }
        rows.append(normalized)

    df = pd.DataFrame(rows)
    context.log.info(
        f"canada_cra_normalized: {len(df)} rows normalized from "
        f"{len(canada_cra_raw)} raw rows"
    )
    return df


@asset(
    name="canada_cra_loaded",
    description="Upsert normalized Canada CRA charities into organizations table",
    group_name="loading",
    deps=["canada_cra_normalized"],
)
def load_canada_cra(
    context,  # noqa: ANN001 — Dagster resolves context type at runtime
    supabase: SupabaseResource,
    canada_cra_normalized: pd.DataFrame,
) -> int:
    """Upsert normalized CRA charities into the Supabase organizations table.

    Uses ON CONFLICT (registry_source, registry_id) for idempotency.
    Records progress in the scrape_runs audit table.

    Args:
        context: Dagster asset execution context.
        canada_cra_normalized: Normalized DataFrame from ``normalize_canada_cra``.

    Returns:
        Total number of rows upserted.
    """
    client = supabase.get_client()

    run_id = start_scrape_run(
        client,
        source=REGISTRY_SOURCE,
        spider_name="canada_cra_loaded",
        metadata={"row_count": len(canada_cra_normalized)},
    )

    if canada_cra_normalized.empty:
        context.log.warning("load_canada_cra: empty DataFrame, nothing to load")
        complete_scrape_run(
            client,
            run_id=run_id,
            records_found=0,
            records_new=0,
            records_updated=0,
        )
        return 0

    records_found = len(canada_cra_normalized)
    records_new = 0
    records_updated = 0
    records_failed = 0

    try:
        _internal_cols = {"_content_hash"}
        rows_to_upsert: list[dict[str, Any]] = []

        for _, row in canada_cra_normalized.iterrows():
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
            f"load_canada_cra: upserted {records_new} rows "
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
        logger.error("load_canada_cra_failed", error=error_msg)
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
