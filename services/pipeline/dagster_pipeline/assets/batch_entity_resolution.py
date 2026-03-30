from __future__ import annotations

import os
from typing import Any

import httpx
import structlog
from dagster import asset

from dagster_pipeline.resources.supabase import SupabaseResource

logger = structlog.get_logger()

_ML_API_BASE_URL: str = os.environ.get("ML_API_BASE_URL", "http://localhost:8000")
_ML_API_SECRET: str = os.environ.get("ML_API_SECRET", "")

# Default registry pair used when no config is provided.
_DEFAULT_SOURCE_REGISTRY: str = os.environ.get(
    "ENTITY_RESOLUTION_SOURCE_REGISTRY", "us-irs"
)
_DEFAULT_TARGET_REGISTRY: str = os.environ.get(
    "ENTITY_RESOLUTION_TARGET_REGISTRY", "uk-ccew"
)


def _ml_api_headers() -> dict[str, str]:
    """Build HTTP headers for ML API requests.

    Returns:
        Dict with Content-Type and (if set) X-Service-Secret headers.
    """
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if _ML_API_SECRET:
        headers["X-Service-Secret"] = _ML_API_SECRET
    return headers


@asset(
    name="batch_entity_resolution",
    description=(
        "Run Splink probabilistic entity resolution across a pair of registries, "
        "persisting match results into the entity_matches table via the ML API."
    ),
    group_name="analysis",
    config_schema={
        "source_registry": str,
        "target_registry": str,
    },
)
def batch_entity_resolution(
    context,  # noqa: ANN001 — Dagster resolves context type at runtime
    supabase: SupabaseResource,  # noqa: ARG001 — kept for dependency injection pattern
) -> dict[str, Any]:
    """Dagster asset that resolves entities across two organisation registries.

    Calls ``POST /entities/resolve`` once for the full dataset — the ML API
    handles fetching both sides from Supabase, running Splink, and writing
    results to ``entity_matches``.

    Configuration:
        source_registry (str): Left-hand registry slug (e.g. ``'us-irs'``).
        target_registry (str): Right-hand registry slug (e.g. ``'uk-ccew'``).

    Args:
        context: Dagster asset execution context.
        supabase: Supabase resource (unused directly; kept for dependency
            graph consistency with other batch assets).

    Returns:
        Response dict from the ML API, including match counts if available.
    """
    source_registry: str = context.op_config.get(
        "source_registry", _DEFAULT_SOURCE_REGISTRY
    )
    target_registry: str = context.op_config.get(
        "target_registry", _DEFAULT_TARGET_REGISTRY
    )

    context.log.info(
        f"batch_entity_resolution: starting "
        f"source={source_registry} target={target_registry}"
    )

    try:
        with httpx.Client(
            timeout=600,  # Entity resolution can be slow on large datasets
            headers=_ml_api_headers(),
            follow_redirects=True,
        ) as http_client:
            resp = http_client.post(
                f"{_ML_API_BASE_URL}/entities/resolve",
                params={
                    "source_registry": source_registry,
                    "target_registry": target_registry,
                },
            )
            resp.raise_for_status()
            data: dict[str, Any] = resp.json()
    except httpx.HTTPStatusError as exc:
        logger.error(
            "batch_entity_resolution_http_error",
            status=exc.response.status_code,
            error=str(exc),
        )
        raise
    except Exception as exc:
        logger.error("batch_entity_resolution_failed", error=str(exc))
        raise

    confirmed = data.get("confirmed_matches", 0)
    probable = data.get("probable_matches", 0)
    possible = data.get("possible_matches", 0)
    total_upserted = data.get("upserted", 0)

    context.log.info(
        f"batch_entity_resolution: complete. "
        f"confirmed={confirmed} probable={probable} possible={possible} "
        f"upserted={total_upserted}"
    )
    logger.info(
        "batch_entity_resolution_done",
        source_registry=source_registry,
        target_registry=target_registry,
        confirmed=confirmed,
        probable=probable,
        possible=possible,
        upserted=total_upserted,
    )
    return data
