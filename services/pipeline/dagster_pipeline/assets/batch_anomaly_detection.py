from __future__ import annotations

import asyncio
import os
from typing import Any

import httpx
import structlog
from dagster import asset

from dagster_pipeline.resources.supabase import SupabaseResource

logger = structlog.get_logger()

_ML_API_BASE_URL: str = os.environ.get("ML_API_BASE_URL", "http://localhost:8000")
_ML_API_SECRET: str = os.environ.get("ML_API_SECRET", "")

# Number of organisations to process per batch.
_BATCH_SIZE: int = int(os.environ.get("BATCH_ANOMALY_BATCH_SIZE", "50"))

# Max simultaneous requests within each batch.
_CONCURRENCY: int = int(os.environ.get("BATCH_ANOMALY_CONCURRENCY", "5"))


def _ml_api_headers() -> dict[str, str]:
    """Build HTTP headers for ML API requests.

    Returns:
        Dict with Content-Type and (if set) X-Service-Secret headers.
    """
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if _ML_API_SECRET:
        headers["X-Service-Secret"] = _ML_API_SECRET
    return headers


def _fetch_org_ids_with_filings(db_client: Any) -> list[str]:
    """Fetch distinct organisation IDs that have at least one financial filing.

    Args:
        db_client: Authenticated Supabase Client.

    Returns:
        List of organisation UUID strings.
    """
    try:
        resp = (
            db_client.table("financial_filings")
            .select("organization_id")
            .execute()
        )
        rows: list[dict[str, Any]] = resp.data or []
        seen: set[str] = set()
        org_ids: list[str] = []
        for row in rows:
            oid = row.get("organization_id")
            if oid and oid not in seen:
                seen.add(oid)
                org_ids.append(oid)
        return org_ids
    except Exception as exc:
        logger.error("batch_anomaly_fetch_org_ids_failed", error=str(exc))
        return []


async def _detect_one(
    client: httpx.AsyncClient,
    semaphore: asyncio.Semaphore,
    org_id: str,
) -> dict[str, Any] | None:
    """Call POST /analysis/detect-anomalies for a single organisation.

    Args:
        client: Shared async HTTP client.
        semaphore: Semaphore limiting concurrent requests.
        org_id: UUID of the organisation to analyse.

    Returns:
        Parsed response dict, or None on failure.
    """
    async with semaphore:
        try:
            resp = await client.post(
                f"{_ML_API_BASE_URL}/analysis/detect-anomalies",
                json={"org_id": org_id, "persist": True},
            )
            resp.raise_for_status()
            data: dict[str, Any] = resp.json()
            logger.debug(
                "batch_anomaly_detected",
                org_id=org_id,
                anomaly_count=data.get("anomaly_count", 0),
            )
            return data
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "batch_anomaly_http_error",
                org_id=org_id,
                status=exc.response.status_code,
                error=str(exc),
            )
        except Exception as exc:
            logger.warning("batch_anomaly_error", org_id=org_id, error=str(exc))
    return None


@asset(
    name="batch_anomaly_detection",
    description=(
        "Run anomaly detection for all organisations that have financial filings, "
        "persisting detected alerts into the anomaly_alerts table via the ML API."
    ),
    group_name="analysis",
)
def batch_anomaly_detection(
    context,  # noqa: ANN001 — Dagster resolves context type at runtime
    supabase: SupabaseResource,
) -> int:
    """Dagster asset that detects anomalies for every organisation with filings.

    Fetches all distinct organisation IDs from ``financial_filings``, then calls
    ``POST /analysis/detect-anomalies`` with ``persist: true`` for each one.
    Requests are fanned out in batches of :data:`_BATCH_SIZE` with up to
    :data:`_CONCURRENCY` simultaneous connections to avoid overloading the ML API.

    Args:
        context: Dagster asset execution context.
        supabase: Supabase resource providing an authenticated client.

    Returns:
        Total number of organisations for which detection succeeded.
    """
    db_client = supabase.get_client()
    org_ids = _fetch_org_ids_with_filings(db_client)

    if not org_ids:
        context.log.warning("batch_anomaly_detection: no organisations with filings found")
        return 0

    context.log.info(
        f"batch_anomaly_detection: found {len(org_ids)} organisations to process"
    )

    async def _run() -> int:
        semaphore = asyncio.Semaphore(_CONCURRENCY)
        succeeded = 0

        async with httpx.AsyncClient(
            timeout=120,
            headers=_ml_api_headers(),
            follow_redirects=True,
        ) as http_client:
            for batch_start in range(0, len(org_ids), _BATCH_SIZE):
                batch = org_ids[batch_start : batch_start + _BATCH_SIZE]
                tasks = [_detect_one(http_client, semaphore, oid) for oid in batch]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                for oid, result in zip(batch, results):
                    if isinstance(result, Exception):
                        logger.warning(
                            "batch_anomaly_task_exception",
                            org_id=oid,
                            error=str(result),
                        )
                    elif result is not None:
                        succeeded += 1
                        logger.info(
                            "batch_anomaly_org_done",
                            org_id=oid,
                            anomalies=result.get("anomaly_count", 0),
                        )

                context.log.debug(
                    f"batch_anomaly_detection: batch "
                    f"{batch_start // _BATCH_SIZE + 1} complete, "
                    f"succeeded so far: {succeeded}"
                )

        return succeeded

    total = asyncio.run(_run())
    context.log.info(
        f"batch_anomaly_detection: complete. "
        f"Processed {total}/{len(org_ids)} organisations."
    )
    return total
