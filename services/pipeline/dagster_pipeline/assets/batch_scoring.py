from __future__ import annotations

import os
from typing import Any

import httpx
import structlog
from dagster import asset

from dagster_pipeline.resources.supabase import SupabaseResource

logger = structlog.get_logger()

# Base URL of the ML API service.  Reads from the environment so that
# local dev, staging, and production can each point to their own instance.
_ML_API_BASE_URL: str = os.environ.get("ML_API_BASE_URL", "http://localhost:8000")
_ML_API_SECRET: str = os.environ.get("ML_API_SECRET", "")

# Number of organisations to process per batch to stay within API rate limits.
_BATCH_SIZE: int = int(os.environ.get("BATCH_SCORING_BATCH_SIZE", "50"))

# Persist scored results into organization_scores via the ML API.
_PERSIST_SCORES: bool = os.environ.get("BATCH_SCORING_PERSIST", "true").lower() == "true"


def _ml_api_headers() -> dict[str, str]:
    """Build HTTP headers for ML API requests.

    Returns:
        Dict with Content-Type and (if set) Authorization headers.
    """
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if _ML_API_SECRET:
        headers["X-Service-Secret"] = _ML_API_SECRET
    return headers


async def _score_one(
    client: httpx.AsyncClient,
    org_id: str,
    fiscal_year: int | None,
) -> dict[str, Any] | None:
    """Call the ML API /analysis/score/{org_id} endpoint for a single org.

    Args:
        client: Shared async HTTP client.
        org_id: UUID of the organisation to score.
        fiscal_year: Expected fiscal year (used only for logging).

    Returns:
        Parsed score response dict, or None on failure.
    """
    try:
        url = f"{_ML_API_BASE_URL}/analysis/score/{org_id}"
        resp = await client.get(url, params={"persist": str(_PERSIST_SCORES).lower()})
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()
        logger.debug(
            "batch_scoring_scored",
            org_id=org_id,
            overall=data.get("overall_score"),
            fiscal_year=fiscal_year,
        )
        return data
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "batch_scoring_http_error",
            org_id=org_id,
            status=exc.response.status_code,
            error=str(exc),
        )
    except Exception as exc:
        logger.warning("batch_scoring_error", org_id=org_id, error=str(exc))
    return None


def _fetch_org_ids(client: Any, fiscal_year: int | None) -> list[dict[str, Any]]:
    """Fetch organisation IDs (and optionally the latest fiscal year) from Supabase.

    Args:
        client: Authenticated Supabase Client.
        fiscal_year: If provided, only return orgs with a filing for this year.

    Returns:
        List of dicts with at least ``id`` and optionally ``fiscal_year`` keys.
    """
    try:
        if fiscal_year is not None:
            resp = (
                client.table("financial_filings")
                .select("organization_id,fiscal_year")
                .eq("fiscal_year", fiscal_year)
                .execute()
            )
            rows: list[dict[str, Any]] = resp.data or []
            # Deduplicate by organization_id
            seen: set[str] = set()
            deduped: list[dict[str, Any]] = []
            for row in rows:
                oid = row.get("organization_id")
                if oid and oid not in seen:
                    seen.add(oid)
                    deduped.append({"id": oid, "fiscal_year": row.get("fiscal_year")})
            return deduped
        else:
            # Fallback: fetch all orgs and their most recent fiscal year
            resp = (
                client.table("organizations")
                .select("id")
                .order("created_at", desc=False)
                .execute()
            )
            return [{"id": row["id"], "fiscal_year": None} for row in (resp.data or [])]
    except Exception as exc:
        logger.error("batch_scoring_fetch_org_ids_failed", error=str(exc))
        return []


@asset(
    name="batch_scoring",
    description=(
        "Score all organisations by calling the ML API scoring endpoint, "
        "populating the organization_scores table per fiscal year."
    ),
    group_name="scoring",
    config_schema={
        "fiscal_year": int,
    },
)
def batch_scoring(
    context,  # noqa: ANN001 — Dagster resolves context type at runtime
    supabase: SupabaseResource,
) -> int:
    """Dagster asset that scores every organisation for a given fiscal year.

    Fetches all organisations that have a financial filing for the configured
    fiscal year from Supabase, then calls the ML API
    ``GET /analysis/score/{org_id}?persist=true`` endpoint for each one in
    batches.  Results are written to the ``organization_scores`` table by the
    ML API (when ``persist=True``).

    Configuration:
        fiscal_year (int): The fiscal year to process.  Passed via Dagster's
            run config, e.g. ``{"ops": {"batch_scoring": {"config": {"fiscal_year": 2023}}}}``.

    Args:
        context: Dagster asset execution context.
        supabase: Supabase resource providing an authenticated client.

    Returns:
        Total number of organisations successfully scored.
    """
    import asyncio  # noqa: PLC0415

    fiscal_year: int = context.op_config["fiscal_year"]
    context.log.info(f"batch_scoring: starting for fiscal_year={fiscal_year}")

    db_client = supabase.get_client()
    org_records = _fetch_org_ids(db_client, fiscal_year)

    if not org_records:
        context.log.warning(
            f"batch_scoring: no organisations found for fiscal_year={fiscal_year}"
        )
        return 0

    context.log.info(
        f"batch_scoring: found {len(org_records)} organisations to score"
    )

    # ---------------------------------------------------------------
    # Async batch execution with bounded concurrency
    # ---------------------------------------------------------------
    async def _run_batch() -> int:
        headers = _ml_api_headers()
        scored_count = 0

        async with httpx.AsyncClient(
            timeout=60,
            headers=headers,
            follow_redirects=True,
        ) as http_client:
            # Process in batches of _BATCH_SIZE
            for batch_start in range(0, len(org_records), _BATCH_SIZE):
                batch = org_records[batch_start : batch_start + _BATCH_SIZE]

                tasks = [
                    _score_one(http_client, rec["id"], rec.get("fiscal_year"))
                    for rec in batch
                ]
                batch_results = await asyncio.gather(*tasks, return_exceptions=True)

                for rec, result in zip(batch, batch_results):
                    if isinstance(result, Exception):
                        logger.warning(
                            "batch_scoring_task_exception",
                            org_id=rec["id"],
                            error=str(result),
                        )
                    elif result is not None:
                        scored_count += 1

                context.log.debug(
                    f"batch_scoring: completed batch "
                    f"{batch_start // _BATCH_SIZE + 1}, "
                    f"scored so far: {scored_count}"
                )

        return scored_count

    total_scored = asyncio.run(_run_batch())

    context.log.info(
        f"batch_scoring: complete. "
        f"Scored {total_scored}/{len(org_records)} organisations "
        f"for fiscal_year={fiscal_year}"
    )
    return total_scored
