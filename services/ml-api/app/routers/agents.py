from __future__ import annotations

from fastapi import APIRouter, Query
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/agents", tags=["agents"])


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
) -> dict[str, str]:
    """Trigger the LangGraph multi-agent analysis pipeline for an organization.

    Orchestrates a graph of specialized agents:
      - filing_parser        : Extracts structured data from raw filings
      - financial_analyst    : Computes ratios and flags anomalies
      - network_investigator : Surfaces shell structures and circular funding
      - claims_verifier      : Cross-checks figures against registry sources
      - report_generator     : Produces a plain-language risk assessment

    Full LangGraph implementation in Sprint 7. Requires ANTHROPIC_API_KEY.

    Args:
        org_id: UUID string identifying the target organization.
        report_type: Scope of the agent run ('full', 'financial', 'network').

    Returns:
        Placeholder status dict until Sprint 7 LangGraph integration is complete.
    """
    logger.info("run_agent_analysis_called", org_id=org_id, report_type=report_type)
    # Sprint 7: instantiate LangGraph StateGraph, stream agent steps,
    # persist investigation report to Supabase, return report_id + summary.
    return {
        "status": "not_implemented",
        "org_id": org_id,
        "report_type": report_type,
    }
