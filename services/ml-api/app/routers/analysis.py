from __future__ import annotations

from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.models.anomaly import AnomalyResult, detect_anomalies
from app.models.benford import BenfordResult, analyze_benford
from app.models.scoring import ScoreResult, compute_score
from app.services.supabase_client import get_supabase_client

logger = structlog.get_logger()
router = APIRouter(prefix="/analysis", tags=["analysis"])


# ---------------------------------------------------------------------------
# Request / response wrappers
# ---------------------------------------------------------------------------


class DetectAnomaliesRequest(BaseModel):
    """Request body for POST /analysis/detect-anomalies.

    Attributes:
        org_id: UUID of the organisation to analyse.
        persist: When True, upsert detected anomalies into anomaly_alerts.
    """

    org_id: str
    persist: bool = False


class DetectAnomaliesResponse(BaseModel):
    """Response from POST /analysis/detect-anomalies.

    Attributes:
        org_id: UUID of the analysed organisation.
        anomaly_count: Number of anomalies detected.
        anomalies: Full list of AnomalyResult objects.
    """

    org_id: str
    anomaly_count: int
    anomalies: list[AnomalyResult]


class BenfordRequest(BaseModel):
    """Request body for POST /analysis/benford.

    Attributes:
        org_id: UUID of the organisation to analyse.
    """

    org_id: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _db_client() -> Any:
    """FastAPI dependency that returns the Supabase client.

    Returns:
        Authenticated Supabase Client instance.

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


async def _persist_anomalies(
    org_id: str,
    anomalies: list[AnomalyResult],
    db: Any,
) -> None:
    """Upsert detected anomalies into the anomaly_alerts table.

    Rows are inserted without ON CONFLICT deduplication — the caller is
    responsible for avoiding duplicate runs within the same fiscal year.

    Args:
        org_id: UUID of the organisation.
        anomalies: Detected anomaly results to persist.
        db: Authenticated Supabase client.
    """
    if not anomalies:
        return

    rows: list[dict[str, Any]] = []
    for a in anomalies:
        # Map internal alert_type to the closest DB CHECK constraint value.
        # 'overhead_flip' is not in the DB enum, map to 'overhead_manipulation'.
        db_alert_type = a.alert_type
        if db_alert_type == "overhead_flip":
            db_alert_type = "overhead_manipulation"
        elif db_alert_type not in {
            "overhead_manipulation",
            "related_party",
            "compensation_outlier",
            "revenue_expense_mismatch",
            "benford_violation",
            "network_anomaly",
            "filing_inconsistency",
            "geographic_discrepancy",
            "zero_fundraising",
            "rapid_growth",
            "shell_indicator",
            "other",
        }:
            db_alert_type = "other"

        rows.append(
            {
                "organization_id": org_id,
                "fiscal_year": a.fiscal_year,
                "alert_type": db_alert_type,
                "severity": a.severity.value,
                "confidence": a.confidence,
                "title": a.title,
                "description": a.description,
                "evidence": a.evidence.model_dump(),
                "methodology": a.methodology,
            }
        )

    try:
        db.table("anomaly_alerts").insert(rows).execute()
        logger.info("anomaly_alerts_persisted", org_id=org_id, count=len(rows))
    except Exception as exc:
        logger.error("anomaly_alerts_persist_failed", org_id=org_id, error=str(exc))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/detect-anomalies",
    response_model=DetectAnomaliesResponse,
    summary="Run anomaly detection for an organisation",
)
async def detect_anomalies_endpoint(
    body: DetectAnomaliesRequest,
    db: Any = Depends(_db_client),
) -> DetectAnomaliesResponse:
    """Run all six PRD anomaly rules against an organisation's financial data.

    Evaluates:
    - Zero fundraising expenses with large contributions
    - Year-over-year admin expense ratio flip
    - CEO compensation outlier
    - Benford's Law violation
    - Shell entity indicators (shared address + directors)
    - Revenue cliff (>50% YoY decline)

    Args:
        body: Request containing org_id and optional persist flag.
        db: Supabase client (injected by FastAPI dependency).

    Returns:
        DetectAnomaliesResponse with the full list of detected anomalies.

    Raises:
        HTTPException 400: If org_id is blank.
        HTTPException 503: If the Supabase client is not configured.
    """
    if not body.org_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="org_id must not be empty",
        )

    logger.info("detect_anomalies_called", org_id=body.org_id, persist=body.persist)

    anomalies = await detect_anomalies(body.org_id, db)

    if body.persist:
        await _persist_anomalies(body.org_id, anomalies, db)

    return DetectAnomaliesResponse(
        org_id=body.org_id,
        anomaly_count=len(anomalies),
        anomalies=anomalies,
    )


@router.post(
    "/benford",
    response_model=BenfordResult,
    summary="Run Benford's Law analysis for an organisation",
)
async def benford_analysis(
    body: BenfordRequest,
    db: Any = Depends(_db_client),
) -> BenfordResult:
    """Perform Benford's Law chi-squared goodness-of-fit analysis.

    Collects all financial figures across all filings for the organisation,
    extracts leading digits, and computes a chi-squared statistic against the
    theoretical Benford distribution (8 degrees of freedom).

    A p-value below the configurable threshold (default 0.01) is classified
    as an anomaly.

    Args:
        body: Request containing org_id.
        db: Supabase client (injected by FastAPI dependency).

    Returns:
        BenfordResult with chi-squared, p-value, and per-digit frequencies.

    Raises:
        HTTPException 400: If org_id is blank.
        HTTPException 503: If the Supabase client is not configured.
    """
    if not body.org_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="org_id must not be empty",
        )

    logger.info("benford_analysis_called", org_id=body.org_id)

    return await analyze_benford(body.org_id, db)


@router.get(
    "/score/{org_id}",
    response_model=ScoreResult,
    summary="Get the transparency score for an organisation",
)
async def get_score(
    org_id: str,
    persist: bool = Query(False, description="Upsert the score into organization_scores"),
    db: Any = Depends(_db_client),
) -> ScoreResult:
    """Compute or retrieve the OpenGive Transparency Score for an organisation.

    Overall Score = 0.35 x Financial Health + 0.25 x Transparency
                  + 0.25 x Governance + 0.15 x Efficiency

    Each pillar is scored 0-100 based on the criteria documented in PRD
    section 11 and apps/docs/docs/methodology.md.

    Args:
        org_id: UUID of the organisation to score.
        persist: When True, upsert the computed score into organization_scores.
        db: Supabase client (injected by FastAPI dependency).

    Returns:
        ScoreResult with overall score, pillar scores, and score breakdown.

    Raises:
        HTTPException 400: If org_id is blank.
        HTTPException 503: If the Supabase client is not configured.
    """
    if not org_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="org_id must not be empty",
        )

    logger.info("get_score_called", org_id=org_id, persist=persist)

    result = await compute_score(org_id, db)

    if persist and result.fiscal_year is not None:
        try:
            db.table("organization_scores").upsert(
                {
                    "organization_id": org_id,
                    "fiscal_year": result.fiscal_year,
                    "overall_score": result.overall_score,
                    "financial_health_score": result.financial_health_score,
                    "transparency_score": result.transparency_score,
                    "governance_score": result.governance_score,
                    "efficiency_score": result.efficiency_score,
                    "score_breakdown": result.score_breakdown,
                    "methodology_version": result.methodology_version,
                },
                on_conflict="organization_id,fiscal_year,methodology_version",
            ).execute()
            logger.info("score_persisted", org_id=org_id, fiscal_year=result.fiscal_year)
        except Exception as exc:
            logger.error("score_persist_failed", org_id=org_id, error=str(exc))

    return result
