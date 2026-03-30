from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.agents.risk_assessor import RiskAssessment, get_risk_assessor
from app.services.supabase_client import get_supabase_client

logger = structlog.get_logger()
router = APIRouter(prefix="/agents", tags=["agents"])


# ---------------------------------------------------------------------------
# Dependency
# ---------------------------------------------------------------------------


def _db_client() -> Any:
    """FastAPI dependency returning the Supabase client.

    Raises:
        HTTPException 503: If the Supabase client is not configured.
    """
    try:
        return get_supabase_client()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------


def _get_cached_summary(
    db: Any,
    org_id: str,
    summary_type: str = "risk_assessment",
) -> dict[str, Any] | None:
    """Check organization_summaries for a non-expired cached result.

    Args:
        db: Authenticated Supabase Client.
        org_id: UUID of the organisation.
        summary_type: Type of summary to look up (default ``'risk_assessment'``).

    Returns:
        Cached summary row dict if found and not expired, else None.
    """
    try:
        now_iso = datetime.now(tz=timezone.utc).isoformat()
        resp = (
            db.table("organization_summaries")
            .select("id,content,risk_level,model_used,generated_at,expires_at")
            .eq("organization_id", org_id)
            .eq("summary_type", summary_type)
            .gt("expires_at", now_iso)
            .single()
            .execute()
        )
        return resp.data or None
    except Exception:
        # single() raises if no row found; treat all errors as cache miss
        return None


def _persist_summary(
    db: Any,
    org_id: str,
    assessment: RiskAssessment,
    summary_type: str = "risk_assessment",
) -> None:
    """Upsert the risk assessment result into organization_summaries.

    Uses ON CONFLICT on (organization_id, summary_type) so re-running the
    agent updates the existing row rather than inserting a duplicate.

    Args:
        db: Authenticated Supabase Client (service role).
        org_id: UUID of the organisation.
        assessment: The RiskAssessment to cache.
        summary_type: Category of the summary (default ``'risk_assessment'``).
    """
    try:
        db.table("organization_summaries").upsert(
            {
                "organization_id": org_id,
                "summary_type": summary_type,
                "risk_level": assessment.risk_level,
                "content": assessment.model_dump(),
                "model_used": "claude-3-5-sonnet-20241022",
            },
            on_conflict="organization_id,summary_type",
        ).execute()
        logger.info("agent_summary_persisted", org_id=org_id, summary_type=summary_type)
    except Exception as exc:
        logger.error("agent_summary_persist_failed", org_id=org_id, error=str(exc))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/analyze")
async def run_agent_analysis(
    org_id: str = Query(..., description="UUID of the organization to analyse"),
    report_type: str = Query(
        "full",
        description=(
            "Type of report to generate: "
            "'full' (all agents), 'financial' (Financial Analyst only), "
            "'network' (Network Investigator only)"
        ),
    ),
    force_refresh: bool = Query(
        False,
        description="Bypass the cache and regenerate the assessment even if a fresh one exists.",
    ),
    db: Any = Depends(_db_client),
) -> dict[str, Any]:
    """Trigger the LangGraph risk assessment pipeline for an organization.

    Checks the ``organization_summaries`` cache first.  If a non-expired entry
    exists and ``force_refresh`` is False, the cached result is returned
    immediately.  Otherwise the three-node LangGraph is executed:

    1. ``gather_context`` — fetch org record, filings, anomaly alerts, scores.
    2. ``generate_assessment`` — call Claude with a structured prompt.
    3. ``validate_output`` — sanity-check the response against fetched data.

    The result is persisted to ``organization_summaries`` for future cache hits.

    Args:
        org_id: UUID string identifying the target organisation.
        report_type: Scope of the agent run (currently 'full' is fully wired;
            'financial' and 'network' fall back to 'full' until specialised
            agents are added in a later sprint).
        force_refresh: When True, skip the cache and always run the agent.
        db: Supabase client (injected by FastAPI dependency).

    Returns:
        Dict containing the ``RiskAssessment`` fields plus a ``cached`` flag.

    Raises:
        HTTPException 400: If org_id is blank.
        HTTPException 503: If the Supabase or Anthropic client is not configured.
    """
    if not org_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="org_id must not be empty",
        )

    logger.info(
        "run_agent_analysis_called",
        org_id=org_id,
        report_type=report_type,
        force_refresh=force_refresh,
    )

    # ------------------------------------------------------------------
    # Cache check
    # ------------------------------------------------------------------
    if not force_refresh:
        cached = _get_cached_summary(db, org_id)
        if cached:
            logger.info("run_agent_analysis_cache_hit", org_id=org_id)
            return {
                "cached": True,
                "generated_at": cached.get("generated_at"),
                "expires_at": cached.get("expires_at"),
                **cached.get("content", {}),
            }

    # ------------------------------------------------------------------
    # Run the LangGraph risk assessor
    # ------------------------------------------------------------------
    try:
        graph = get_risk_assessor()
        final_state: dict[str, Any] = await graph.ainvoke({"org_id": org_id})
    except Exception as exc:
        logger.error("run_agent_analysis_graph_failed", org_id=org_id, error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Risk assessment pipeline failed: {exc}",
        ) from exc

    assessment: RiskAssessment | None = final_state.get("assessment")
    if assessment is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Risk assessment graph did not produce a result.",
        )

    validation_errors: list[str] = final_state.get("validation_errors", [])
    if validation_errors:
        logger.warning(
            "run_agent_analysis_validation_warnings",
            org_id=org_id,
            errors=validation_errors,
        )

    # ------------------------------------------------------------------
    # Persist result to cache
    # ------------------------------------------------------------------
    _persist_summary(db, org_id, assessment)

    return {
        "cached": False,
        "validation_warnings": validation_errors,
        **assessment.model_dump(),
    }
