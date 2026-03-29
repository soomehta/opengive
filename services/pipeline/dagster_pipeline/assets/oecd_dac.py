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

# OECD SDMX REST API for Official Development Assistance (DAC) statistics.
# Documentation: https://data.oecd.org/api/sdmx-json-documentation/
OECD_SDMX_BASE = "https://sdmx.oecd.org/public/rest"

# DAC1 = Aid activities by donor, DAC2a = Aid by recipient and sector.
# We use the CRS (Creditor Reporting System) dataset for grant-level data.
OECD_DATASET_ID = "DSD_CRS@DF_CRS"

# Agency for CRS data.
OECD_AGENCY_ID = "OECD.DCD.FSD"

REGISTRY_SOURCE = "oecd_dac"

# Politeness delay (seconds).
_REQUEST_DELAY_SECONDS = 2.0

# Maximum number of observations to retrieve per request.
_SDMX_LIMIT = 500

# Maximum pages in one materialisation (None = exhaustive).
_MAX_PAGES: int | None = 3  # ~1500 observations in dev/demo mode

# Most recent data year to query (SDMX filter).
_DATA_YEAR = "2022"


async def _fetch_sdmx_page(
    client: httpx.AsyncClient,
    start_offset: int,
) -> tuple[list[dict[str, Any]], bool]:
    """Fetch one page of CRS aid flow observations from the OECD SDMX REST API.

    The OECD SDMX JSON API returns data in a compact format where observations
    are indexed arrays.  This function parses the structure and returns a list
    of flat observation dicts.

    Args:
        client: Shared async HTTP client.
        start_offset: Zero-based offset for pagination.

    Returns:
        Tuple of (list of flat observation dicts, has_more: bool).
    """
    try:
        # SDMX REST URL pattern: /data/{agency}/{dataflow}/{key}
        # Using ALL key to get all observations, filtering by year via startPeriod.
        url = (
            f"{OECD_SDMX_BASE}/data"
            f"/{OECD_AGENCY_ID}"
            f"/{OECD_DATASET_ID}"
            f"/A....."
        )
        resp = await client.get(
            url,
            params={
                "format": "jsondata",
                "startPeriod": _DATA_YEAR,
                "endPeriod": _DATA_YEAR,
                "dimensionAtObservation": "AllDimensions",
                "offset": start_offset,
                "limit": _SDMX_LIMIT,
            },
            headers={
                "Accept": "application/vnd.sdmx.data+json;version=2.0",
                "User-Agent": "OpenGive/0.1 (+https://opengive.org) httpx",
            },
        )
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()

        observations = _parse_sdmx_json(data)
        # SDMX does not always provide a clear total count; infer has_more from
        # whether we got a full page.
        has_more = len(observations) >= _SDMX_LIMIT

        logger.debug(
            "oecd_dac_page_fetched",
            offset=start_offset,
            count=len(observations),
            has_more=has_more,
        )
        return observations, has_more

    except httpx.HTTPStatusError as exc:
        logger.warning(
            "oecd_dac_http_error",
            offset=start_offset,
            status=exc.response.status_code,
            error=str(exc),
        )
        return [], False
    except Exception as exc:
        logger.warning("oecd_dac_fetch_error", offset=start_offset, error=str(exc))
        return [], False


def _parse_sdmx_json(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Parse a SDMX-JSON compact format response into a list of flat dicts.

    SDMX-JSON stores observations as {key: [value, ...]} mappings where the
    keys are dimension value index arrays.  Dimension labels are stored in the
    structure section.

    Args:
        data: Parsed SDMX-JSON response dict.

    Returns:
        List of flat observation dicts with human-readable dimension values.
    """
    try:
        structure: dict[str, Any] = data.get("structure", data.get("data", {}).get("structure", {}))
        datasets: list[Any] = data.get("dataSets", data.get("data", {}).get("dataSets", []))

        if not datasets:
            return []

        # Extract dimension names and their value arrays
        dimensions: list[dict[str, Any]] = (
            structure.get("dimensions", {}).get("observation", [])
            or structure.get("dimensions", {}).get("series", [])
            or []
        )

        dim_names: list[str] = [d.get("id", f"DIM{i}") for i, d in enumerate(dimensions)]
        dim_values: list[list[str]] = [
            [v.get("id", str(v)) for v in d.get("values", [])]
            for d in dimensions
        ]

        observations_raw: dict[str, Any] = datasets[0].get("observations", {})

        flat_observations: list[dict[str, Any]] = []
        for obs_key, obs_val in observations_raw.items():
            indices = [int(i) for i in obs_key.split(":")]
            flat: dict[str, Any] = {}

            for dim_idx, (name, values) in enumerate(zip(dim_names, dim_values)):
                if dim_idx < len(indices):
                    val_idx = indices[dim_idx]
                    flat[name] = values[val_idx] if val_idx < len(values) else str(val_idx)
                else:
                    flat[name] = None

            # Observation value is the first element of obs_val list
            flat["value"] = float(obs_val[0]) if obs_val else 0.0
            flat_observations.append(flat)

        return flat_observations

    except Exception as exc:
        logger.warning("oecd_dac_sdmx_parse_error", error=str(exc))
        return []


async def _run_fetch(context: Any) -> list[dict[str, Any]]:
    """Paginate through the OECD SDMX API with politeness delays.

    Args:
        context: Dagster asset execution context.

    Returns:
        Flat list of raw OECD DAC observation dicts.
    """
    all_observations: list[dict[str, Any]] = []
    page = 0

    async with httpx.AsyncClient(timeout=120, follow_redirects=True) as client:
        while True:
            offset = page * _SDMX_LIMIT
            await asyncio.sleep(_REQUEST_DELAY_SECONDS)
            observations, has_more = await _fetch_sdmx_page(client, offset)
            all_observations.extend(observations)

            context.log.debug(
                f"OECD DAC page {page + 1}: {len(observations)} observations, "
                f"total so far: {len(all_observations)}"
            )

            if not observations or not has_more:
                break

            if _MAX_PAGES is not None and (page + 1) >= _MAX_PAGES:
                context.log.info(
                    f"Reached _MAX_PAGES={_MAX_PAGES}, stopping pagination"
                )
                break

            page += 1

    context.log.info(
        f"OECD DAC fetch complete: {len(all_observations)} observations "
        f"across {page + 1} page(s)"
    )
    return all_observations


@asset(
    name="oecd_dac_raw",
    description="Fetch OECD DAC Official Development Assistance flows via SDMX REST API",
    group_name="ingestion",
)
def fetch_oecd_dac(context) -> pd.DataFrame:  # noqa: ANN001 — Dagster resolves context type at runtime
    """Fetch Official Development Assistance (ODA) flows from the OECD DAC SDMX API.

    Retrieves CRS-level grant data from the OECD statistical API, applying a
    mandatory ``_REQUEST_DELAY_SECONDS`` delay between requests.

    Args:
        context: Dagster asset execution context.

    Returns:
        DataFrame of raw OECD DAC observations.  May be empty if all
        requests fail.
    """
    observations = asyncio.run(_run_fetch(context))

    if not observations:
        context.log.warning("oecd_dac_raw: no data fetched")
        return pd.DataFrame()

    df = pd.DataFrame(observations)
    context.log.info(
        f"oecd_dac_raw: {len(df)} rows, columns={list(df.columns)}"
    )
    return df


@asset(
    name="oecd_dac_normalized",
    description="Normalize OECD DAC ODA flow data to OpenGive grants schema",
    group_name="normalization",
    deps=["oecd_dac_raw"],
)
def normalize_oecd_dac(
    context,  # noqa: ANN001 — Dagster resolves context type at runtime
    oecd_dac_raw: pd.DataFrame,
) -> pd.DataFrame:
    """Map OECD DAC SDMX dimension values to the OpenGive grants table schema.

    The SDMX CRS dataset uses coded dimension values.  After parsing, the
    flat dict contains the dimension IDs as keys.

    Key SDMX dimensions mapped:
        DONOR             -> funder_name (DAC donor code to name mapping)
        RECIPIENT         -> recipient_name / country_code
        SECTOR            -> purpose
        YEAR (TIME_PERIOD) -> award_date
        value             -> amount_usd (CRS reports in USD millions)
        'oecd_dac'        -> registry_source

    Note: CRS values are in millions of USD; this asset stores raw values.
    Frontend should label as 'USD millions' or multiply by 1,000,000.

    Args:
        context: Dagster asset execution context.
        oecd_dac_raw: Raw DataFrame from ``fetch_oecd_dac``.

    Returns:
        Normalized DataFrame ready for upsert into the grants table.
    """
    if oecd_dac_raw.empty:
        context.log.warning("normalize_oecd_dac: received empty DataFrame, skipping")
        return pd.DataFrame()

    def _pick(row: dict[str, Any], *keys: str, default: str = "") -> str:
        for k in keys:
            v = str(row.get(k, "") or "").strip()
            if v and v.lower() not in {"nan", "none", "n/a", ""}:
                return v
        return default

    rows: list[dict[str, Any]] = []

    for idx, row_s in oecd_dac_raw.iterrows():
        raw: dict[str, Any] = row_s.to_dict()

        # Build a deterministic registry_grant_id from dimension values
        donor = _pick(raw, "DONOR", "donor", "DONOR_CODE")
        recipient = _pick(raw, "RECIPIENT", "recipient", "RECIP_CODE")
        sector = _pick(raw, "SECTOR", "sector", "SECTOR_CODE")
        time_period = _pick(raw, "TIME_PERIOD", "YEAR", "year", "time", default=_DATA_YEAR)

        # Unique key: donor + recipient + sector + year + row index as tiebreaker
        registry_grant_id = f"{REGISTRY_SOURCE}:{donor}:{recipient}:{sector}:{time_period}:{idx}"

        # Amount — CRS data is in USD millions
        try:
            amount_raw = float(raw.get("value", raw.get("OBS_VALUE", 0)) or 0)
        except (TypeError, ValueError):
            amount_raw = 0.0

        # Store raw value; consumers should treat as USD millions
        amount_usd = amount_raw

        # Recipient country resolution
        country_code: str | None = normalize_country(recipient) if recipient else None

        # Purpose from sector
        purpose: str | None = sector or None

        # Title
        title = (
            f"ODA flow: {donor} -> {recipient} [{sector}] ({time_period})"
            if all([donor, recipient, sector])
            else f"OECD DAC ODA flow {registry_grant_id}"
        )

        content_hash = compute_content_hash(
            json.dumps(raw, sort_keys=True, default=str).encode()
        )

        normalized: dict[str, Any] = {
            "registry_grant_id": registry_grant_id,
            "title": title,
            "funder_name": donor or None,
            "funder_registry_id": donor or None,
            "funder_slug": generate_slug(donor) if donor else None,
            "recipient_name": recipient or None,
            "recipient_registry_id": recipient or None,
            "currency": "USD",
            "amount_local": amount_raw,
            "amount_usd": amount_usd,
            "award_date": time_period or None,
            "purpose": purpose,
            "country_code": country_code,
            "registry_source": REGISTRY_SOURCE,
            "_content_hash": content_hash,
        }
        rows.append(normalized)

    df = pd.DataFrame(rows)
    context.log.info(
        f"oecd_dac_normalized: {len(df)} rows normalized from "
        f"{len(oecd_dac_raw)} raw rows"
    )
    return df


@asset(
    name="oecd_dac_loaded",
    description="Upsert normalized OECD DAC ODA flows into the grants table",
    group_name="loading",
    deps=["oecd_dac_normalized"],
)
def load_oecd_dac(
    context,  # noqa: ANN001 — Dagster resolves context type at runtime
    supabase: SupabaseResource,
    oecd_dac_normalized: pd.DataFrame,
) -> int:
    """Upsert normalized OECD DAC ODA flows into the Supabase grants table.

    Uses ON CONFLICT (registry_source, registry_grant_id) for idempotency.
    Records progress in the scrape_runs audit table.

    Args:
        context: Dagster asset execution context.
        oecd_dac_normalized: Normalized DataFrame from ``normalize_oecd_dac``.

    Returns:
        Total number of rows upserted.
    """
    client = supabase.get_client()

    run_id = start_scrape_run(
        client,
        source=REGISTRY_SOURCE,
        spider_name="oecd_dac_loaded",
        metadata={"row_count": len(oecd_dac_normalized)},
    )

    if oecd_dac_normalized.empty:
        context.log.warning("load_oecd_dac: empty DataFrame, nothing to load")
        complete_scrape_run(
            client,
            run_id=run_id,
            records_found=0,
            records_new=0,
            records_updated=0,
        )
        return 0

    records_found = len(oecd_dac_normalized)
    records_new = 0
    records_updated = 0
    records_failed = 0

    try:
        _internal_cols = {"_content_hash"}
        rows_to_upsert: list[dict[str, Any]] = []

        for _, row in oecd_dac_normalized.iterrows():
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
            f"load_oecd_dac: upserted {records_new} rows "
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
        logger.error("load_oecd_dac_failed", error=error_msg)
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
