from __future__ import annotations

"""LangGraph risk assessment agent for OpenGive.

Implements a three-node StateGraph:
  1. gather_context  — fetch org data, filings, anomaly alerts, and scores.
  2. generate_assessment — call Claude to produce a structured RiskAssessment.
  3. validate_output — sanity-check the assessment against the fetched data.
"""

import json
from typing import Any, TypedDict

import structlog
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, StateGraph
from pydantic import BaseModel, Field

from app.config import settings
from app.services.supabase_client import get_supabase_client

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Pydantic output models
# ---------------------------------------------------------------------------

_RISK_LEVELS = ("low", "medium", "high", "critical")


class RiskFinding(BaseModel):
    """A single risk finding referenced in the assessment.

    Attributes:
        category: High-level category (e.g. 'financial', 'governance').
        description: Human-readable description of the finding.
        evidence: Supporting data points or references.
        severity: low | medium | high | critical.
    """

    category: str
    description: str
    evidence: list[str] = Field(default_factory=list)
    severity: str = "medium"


class RiskAssessment(BaseModel):
    """Structured risk assessment for one organisation.

    Attributes:
        org_id: UUID of the assessed organisation.
        risk_level: Aggregate risk level (low / medium / high / critical).
        summary: Plain-English executive summary (2-3 sentences).
        findings: Ordered list of risk findings (most severe first).
        recommendations: Actionable recommendations for donors / auditors.
        data_sources: Which data types were used in the assessment.
        confidence: Assessor confidence 0.0-1.0 based on data completeness.
    """

    org_id: str
    risk_level: str = "medium"
    summary: str = ""
    findings: list[RiskFinding] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    data_sources: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0, default=0.5)


# ---------------------------------------------------------------------------
# LangGraph state
# ---------------------------------------------------------------------------


class AssessmentState(TypedDict, total=False):
    """Shared state threaded through the LangGraph nodes.

    Keys:
        org_id: UUID of the organisation under assessment.
        org_data: Raw organisation record from Supabase.
        filings: List of financial filing records.
        anomaly_alerts: List of anomaly alert records.
        scores: List of scoring records.
        assessment: Parsed RiskAssessment produced by generate_assessment.
        validation_errors: Any issues found during validate_output.
    """

    org_id: str
    org_data: dict[str, Any]
    filings: list[dict[str, Any]]
    anomaly_alerts: list[dict[str, Any]]
    scores: list[dict[str, Any]]
    assessment: RiskAssessment | None
    validation_errors: list[str]


# ---------------------------------------------------------------------------
# Node implementations
# ---------------------------------------------------------------------------


def _gather_context(state: AssessmentState) -> AssessmentState:
    """Node 1: fetch org record, filings, anomaly alerts, and scores from Supabase.

    Args:
        state: Current graph state carrying ``org_id``.

    Returns:
        Updated state with ``org_data``, ``filings``, ``anomaly_alerts``,
        ``scores`` populated.
    """
    org_id: str = state["org_id"]
    log = logger.bind(org_id=org_id, node="gather_context")
    log.info("gather_context_start")

    db = get_supabase_client()

    # Organisation record
    org_data: dict[str, Any] = {}
    try:
        resp = (
            db.table("organizations")
            .select(
                "id,name,slug,sector,subsector,country_code,jurisdiction,"
                "org_type,description,founded_year,registration_id,website"
            )
            .eq("id", org_id)
            .single()
            .execute()
        )
        org_data = resp.data or {}
    except Exception as exc:
        log.warning("gather_context_org_fetch_failed", error=str(exc))

    # Financial filings (most recent 5)
    filings: list[dict[str, Any]] = []
    try:
        resp = (
            db.table("financial_filings")
            .select(
                "fiscal_year,total_revenue,total_expenses,program_expenses,"
                "admin_expenses,fundraising_expenses,net_assets"
            )
            .eq("organization_id", org_id)
            .order("fiscal_year", desc=True)
            .limit(5)
            .execute()
        )
        filings = resp.data or []
    except Exception as exc:
        log.warning("gather_context_filings_fetch_failed", error=str(exc))

    # Anomaly alerts
    anomaly_alerts: list[dict[str, Any]] = []
    try:
        resp = (
            db.table("anomaly_alerts")
            .select("alert_type,severity,confidence,title,description,fiscal_year")
            .eq("organization_id", org_id)
            .order("confidence", desc=True)
            .limit(20)
            .execute()
        )
        anomaly_alerts = resp.data or []
    except Exception as exc:
        log.warning("gather_context_alerts_fetch_failed", error=str(exc))

    # Scores (most recent)
    scores: list[dict[str, Any]] = []
    try:
        resp = (
            db.table("organization_scores")
            .select(
                "fiscal_year,overall_score,financial_health_score,"
                "transparency_score,governance_score,efficiency_score"
            )
            .eq("organization_id", org_id)
            .order("fiscal_year", desc=True)
            .limit(3)
            .execute()
        )
        scores = resp.data or []
    except Exception as exc:
        log.warning("gather_context_scores_fetch_failed", error=str(exc))

    log.info(
        "gather_context_complete",
        filings_count=len(filings),
        alerts_count=len(anomaly_alerts),
        scores_count=len(scores),
    )

    return {
        **state,
        "org_data": org_data,
        "filings": filings,
        "anomaly_alerts": anomaly_alerts,
        "scores": scores,
        "assessment": None,
        "validation_errors": [],
    }


async def _generate_assessment(state: AssessmentState) -> AssessmentState:
    """Node 2: call Claude to produce a structured RiskAssessment.

    Builds a context-rich prompt from the gathered data, calls the Anthropic
    Claude API, and parses the response into a :class:`RiskAssessment`.

    Args:
        state: Current graph state with org context data populated.

    Returns:
        Updated state with ``assessment`` set.
    """
    org_id: str = state["org_id"]
    log = logger.bind(org_id=org_id, node="generate_assessment")
    log.info("generate_assessment_start")

    if not settings.anthropic_api_key:
        log.error("generate_assessment_no_api_key")
        fallback = RiskAssessment(
            org_id=org_id,
            risk_level="medium",
            summary="Assessment unavailable: ANTHROPIC_API_KEY not configured.",
            confidence=0.0,
        )
        return {**state, "assessment": fallback}

    llm = ChatAnthropic(
        model="claude-3-5-sonnet-20241022",
        api_key=settings.anthropic_api_key,
        temperature=0.2,
        max_tokens=2048,
    )

    # Build a concise JSON context block to keep the prompt under the token limit
    context_block = json.dumps(
        {
            "organization": state.get("org_data", {}),
            "financial_filings": state.get("filings", []),
            "anomaly_alerts": state.get("anomaly_alerts", []),
            "transparency_scores": state.get("scores", []),
        },
        default=str,
        indent=2,
    )

    system_prompt = (
        "You are a forensic charity analyst for OpenGive, a global charity "
        "accountability dashboard. Your role is to assess financial risk and "
        "governance quality using publicly available data. Be factual, "
        "evidence-based, and cite specific data points from the context. "
        "Risk levels: low (no material concerns), medium (minor issues), "
        "high (significant concerns warranting scrutiny), "
        "critical (fraud indicators or severe governance failures). "
        "Always ground findings in the data provided."
    )

    user_prompt = f"""Analyse the following charity data and produce a structured risk assessment.

CONTEXT DATA:
{context_block}

Return a JSON object with exactly this structure:
{{
  "risk_level": "<low|medium|high|critical>",
  "summary": "<2-3 sentence executive summary referencing specific data>",
  "findings": [
    {{
      "category": "<financial|governance|transparency|network|compliance>",
      "description": "<specific finding>",
      "evidence": ["<data point 1>", "<data point 2>"],
      "severity": "<low|medium|high|critical>"
    }}
  ],
  "recommendations": ["<actionable recommendation>"],
  "data_sources": ["filings", "anomaly_alerts", "scores"],
  "confidence": <0.0-1.0 based on data completeness>
}}

Only return the JSON object, no markdown fences or extra text."""

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ]

    try:
        response = await llm.ainvoke(messages)
        raw: str = response.content
        if isinstance(raw, list):
            # Handle multi-part content blocks from Claude
            raw = " ".join(
                part.get("text", "") if isinstance(part, dict) else str(part)
                for part in raw
            )
        parsed_json: dict[str, Any] = json.loads(raw.strip())
        assessment = RiskAssessment(
            org_id=org_id,
            **{k: v for k, v in parsed_json.items() if k in RiskAssessment.model_fields},
        )
        log.info(
            "generate_assessment_complete",
            risk_level=assessment.risk_level,
            finding_count=len(assessment.findings),
            confidence=assessment.confidence,
        )
    except json.JSONDecodeError as exc:
        log.error("generate_assessment_json_parse_failed", error=str(exc))
        assessment = RiskAssessment(
            org_id=org_id,
            risk_level="medium",
            summary="Assessment could not be parsed from model response.",
            confidence=0.1,
        )
    except Exception as exc:
        log.error("generate_assessment_llm_failed", error=str(exc))
        assessment = RiskAssessment(
            org_id=org_id,
            risk_level="medium",
            summary=f"Assessment failed due to an internal error: {exc}",
            confidence=0.0,
        )

    return {**state, "assessment": assessment}


def _validate_output(state: AssessmentState) -> AssessmentState:
    """Node 3: validate the assessment references real data.

    Checks that:
    - risk_level is a recognised value.
    - summary is non-empty.
    - At least one finding exists if anomaly_alerts were present.
    - confidence is within [0, 1].

    Validation errors are logged but do not raise exceptions so that a
    partial result is always returned rather than failing the entire pipeline.

    Args:
        state: Current graph state with ``assessment`` set.

    Returns:
        Updated state with ``validation_errors`` populated.
    """
    assessment: RiskAssessment | None = state.get("assessment")
    org_id: str = state["org_id"]
    log = logger.bind(org_id=org_id, node="validate_output")
    errors: list[str] = []

    if assessment is None:
        errors.append("assessment is None — generation failed entirely")
        log.warning("validate_output_no_assessment")
        return {**state, "validation_errors": errors}

    if assessment.risk_level not in _RISK_LEVELS:
        errors.append(
            f"invalid risk_level '{assessment.risk_level}'; "
            f"expected one of {_RISK_LEVELS}"
        )
        # Coerce to a safe default
        assessment = assessment.model_copy(update={"risk_level": "medium"})

    if not assessment.summary.strip():
        errors.append("summary is empty")

    anomaly_count = len(state.get("anomaly_alerts", []))
    if anomaly_count > 0 and len(assessment.findings) == 0:
        errors.append(
            f"{anomaly_count} anomaly alerts present but no findings generated"
        )

    if not (0.0 <= assessment.confidence <= 1.0):
        errors.append(
            f"confidence {assessment.confidence} is outside [0, 1]; clamping"
        )
        clamped = max(0.0, min(1.0, assessment.confidence))
        assessment = assessment.model_copy(update={"confidence": clamped})

    if errors:
        log.warning("validate_output_issues", errors=errors)
    else:
        log.info("validate_output_passed")

    return {**state, "assessment": assessment, "validation_errors": errors}


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------


def build_risk_assessor_graph() -> Any:
    """Construct and compile the risk assessor LangGraph StateGraph.

    The graph has three sequential nodes:
        gather_context -> generate_assessment -> validate_output -> END

    Returns:
        A compiled LangGraph runnable (``CompiledGraph``).
    """
    graph: StateGraph = StateGraph(AssessmentState)

    graph.add_node("gather_context", _gather_context)
    graph.add_node("generate_assessment", _generate_assessment)
    graph.add_node("validate_output", _validate_output)

    graph.set_entry_point("gather_context")
    graph.add_edge("gather_context", "generate_assessment")
    graph.add_edge("generate_assessment", "validate_output")
    graph.add_edge("validate_output", END)

    return graph.compile()


# Singleton compiled graph — created on first import.
_risk_assessor_graph: Any = None


def get_risk_assessor() -> Any:
    """Return (or lazily compile) the singleton risk assessor graph.

    Returns:
        Compiled LangGraph runnable.
    """
    global _risk_assessor_graph  # noqa: PLW0603
    if _risk_assessor_graph is None:
        _risk_assessor_graph = build_risk_assessor_graph()
        logger.info("risk_assessor_graph_compiled")
    return _risk_assessor_graph
