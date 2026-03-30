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

_BATCH_SIZE: int = int(os.environ.get("BATCH_EMBEDDINGS_BATCH_SIZE", "50"))
_CONCURRENCY: int = int(os.environ.get("BATCH_EMBEDDINGS_CONCURRENCY", "5"))


def _ml_api_headers() -> dict[str, str]:
    """Build HTTP headers for ML API requests.

    Returns:
        Dict with Content-Type and (if set) X-Service-Secret headers.
    """
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if _ML_API_SECRET:
        headers["X-Service-Secret"] = _ML_API_SECRET
    return headers


def _fetch_all_org_ids(db_client: Any) -> list[str]:
    """Fetch all organisation IDs from Supabase.

    Args:
        db_client: Authenticated Supabase Client.

    Returns:
        List of organisation UUID strings.
    """
    try:
        resp = (
            db_client.table("organizations")
            .select("id")
            .order("created_at", desc=False)
            .execute()
        )
        return [row["id"] for row in (resp.data or []) if row.get("id")]
    except Exception as exc:
        logger.error("batch_embeddings_fetch_org_ids_failed", error=str(exc))
        return []


async def _embed_one(
    client: httpx.AsyncClient,
    semaphore: asyncio.Semaphore,
    org_id: str,
) -> dict[str, Any] | None:
    """Call POST /embeddings/generate for a single organisation.

    Args:
        client: Shared async HTTP client.
        semaphore: Semaphore limiting concurrent requests.
        org_id: UUID of the organisation to embed.

    Returns:
        Parsed response dict, or None on failure.
    """
    async with semaphore:
        try:
            resp = await client.post(
                f"{_ML_API_BASE_URL}/embeddings/generate",
                json={"org_id": org_id},
            )
            resp.raise_for_status()
            data: dict[str, Any] = resp.json()
            logger.debug(
                "batch_embeddings_generated",
                org_id=org_id,
                dims=data.get("dims"),
            )
            return data
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "batch_embeddings_http_error",
                org_id=org_id,
                status=exc.response.status_code,
                error=str(exc),
            )
        except Exception as exc:
            logger.warning("batch_embeddings_error", org_id=org_id, error=str(exc))
    return None


@asset(
    name="batch_embeddings",
    description=(
        "Generate and upsert text embeddings for all organisations by calling "
        "the ML API embedding endpoint, populating organizations.embedding."
    ),
    group_name="embeddings",
)
def batch_embeddings(
    context,  # noqa: ANN001 — Dagster resolves context type at runtime
    supabase: SupabaseResource,
) -> int:
    """Dagster asset that generates pgvector embeddings for every organisation.

    Fetches all organisation IDs from Supabase, then calls
    ``POST /embeddings/generate`` for each one with bounded concurrency to
    avoid exhausting the OpenAI rate limit.  The ML API writes the resulting
    1536-dim vector back to ``organizations.embedding``.

    Args:
        context: Dagster asset execution context.
        supabase: Supabase resource providing an authenticated client.

    Returns:
        Total number of organisations successfully embedded.
    """
    db_client = supabase.get_client()
    org_ids = _fetch_all_org_ids(db_client)

    if not org_ids:
        context.log.warning("batch_embeddings: no organisations found")
        return 0

    context.log.info(
        f"batch_embeddings: found {len(org_ids)} organisations to embed"
    )

    async def _run() -> int:
        semaphore = asyncio.Semaphore(_CONCURRENCY)
        succeeded = 0

        async with httpx.AsyncClient(
            timeout=60,
            headers=_ml_api_headers(),
            follow_redirects=True,
        ) as http_client:
            for batch_start in range(0, len(org_ids), _BATCH_SIZE):
                batch = org_ids[batch_start : batch_start + _BATCH_SIZE]
                tasks = [_embed_one(http_client, semaphore, oid) for oid in batch]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                for oid, result in zip(batch, results):
                    if isinstance(result, Exception):
                        logger.warning(
                            "batch_embeddings_task_exception",
                            org_id=oid,
                            error=str(result),
                        )
                    elif result is not None:
                        succeeded += 1

                context.log.debug(
                    f"batch_embeddings: batch "
                    f"{batch_start // _BATCH_SIZE + 1} complete, "
                    f"succeeded so far: {succeeded}"
                )

        return succeeded

    total = asyncio.run(_run())
    context.log.info(
        f"batch_embeddings: complete. "
        f"Embedded {total}/{len(org_ids)} organisations."
    )
    return total
