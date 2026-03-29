from __future__ import annotations

from datetime import datetime, timezone

import structlog
from supabase import Client

logger = structlog.get_logger()


def start_scrape_run(
    client: Client,
    source: str,
    spider_name: str,
    metadata: dict[str, object] | None = None,
) -> str:
    """Insert a new scrape_runs row with status='running' and return its UUID.

    Creates a provenance record at the start of every pipeline execution so
    that partial failures are visible in the audit log.

    Args:
        client: An authenticated Supabase client.
        source: The data-source identifier, e.g. 'us_propublica' or
            'uk_charity_commission'.
        spider_name: Human-readable name for the asset or spider, e.g.
            'fetch_propublica' or 'uk_charity_commission_raw'.
        metadata: Optional arbitrary JSONB payload (dag run id, page range,
            search terms, etc.).

    Returns:
        The UUID string of the newly inserted scrape_runs row.

    Raises:
        RuntimeError: If the insert does not return a record.
    """
    payload: dict[str, object] = {
        "source": source,
        "spider_name": spider_name,
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "records_found": 0,
        "records_new": 0,
        "records_updated": 0,
        "records_failed": 0,
        "metadata": metadata or {},
    }

    response = client.table("scrape_runs").insert(payload).execute()

    if not response.data:
        raise RuntimeError(
            f"start_scrape_run: no data returned from insert for source={source!r}"
        )

    run_id: str = response.data[0]["id"]
    logger.info(
        "scrape_run_started",
        run_id=run_id,
        source=source,
        spider_name=spider_name,
    )
    return run_id


def complete_scrape_run(
    client: Client,
    run_id: str,
    records_found: int,
    records_new: int,
    records_updated: int,
    records_failed: int = 0,
    metadata: dict[str, object] | None = None,
) -> None:
    """Mark a scrape_runs row as completed with final record counts.

    Updates the row atomically so that dashboards reading the table always
    see a consistent final state.

    Args:
        client: An authenticated Supabase client.
        run_id: UUID of the scrape_runs row to update.
        records_found: Total number of records encountered in the source.
        records_new: Number of records inserted for the first time.
        records_updated: Number of records that were modified on re-fetch.
        records_failed: Number of records that could not be processed.
            Defaults to 0.
        metadata: Optional JSONB payload to merge into the row's metadata
            field (e.g. final page count, duration).
    """
    payload: dict[str, object] = {
        "status": "completed",
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "records_found": records_found,
        "records_new": records_new,
        "records_updated": records_updated,
        "records_failed": records_failed,
    }
    if metadata is not None:
        payload["metadata"] = metadata

    client.table("scrape_runs").update(payload).eq("id", run_id).execute()

    logger.info(
        "scrape_run_completed",
        run_id=run_id,
        records_found=records_found,
        records_new=records_new,
        records_updated=records_updated,
        records_failed=records_failed,
    )


def fail_scrape_run(
    client: Client,
    run_id: str,
    error: str,
    records_found: int = 0,
    records_new: int = 0,
    records_updated: int = 0,
) -> None:
    """Mark a scrape_runs row as failed and record the error message.

    Should be called from an except block so that every pipeline failure is
    captured in the audit log regardless of whether Dagster itself retries.

    Args:
        client: An authenticated Supabase client.
        run_id: UUID of the scrape_runs row to update.
        error: Human-readable error message or traceback excerpt.
        records_found: Records seen before the failure (default 0).
        records_new: Records inserted before the failure (default 0).
        records_updated: Records updated before the failure (default 0).
    """
    payload: dict[str, object] = {
        "status": "failed",
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "error_log": error,
        "records_found": records_found,
        "records_new": records_new,
        "records_updated": records_updated,
    }

    client.table("scrape_runs").update(payload).eq("id", run_id).execute()

    logger.error(
        "scrape_run_failed",
        run_id=run_id,
        error=error,
    )
