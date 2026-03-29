from __future__ import annotations

import math
from typing import Any

import structlog
from pydantic import BaseModel, Field

from app.config import settings

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Methodology version and pillar weights (configurable via Settings)
# ---------------------------------------------------------------------------

METHODOLOGY_VERSION = "v1"

# Overall = 0.35 × Financial Health + 0.25 × Transparency
#         + 0.25 × Governance   + 0.15 × Efficiency
PILLAR_WEIGHTS: dict[str, float] = {
    "financial_health": 0.35,
    "transparency": 0.25,
    "governance": 0.25,
    "efficiency": 0.15,
}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class PillarBreakdown(BaseModel):
    """Detailed sub-score breakdown for one scoring pillar.

    Attributes:
        score: Pillar score (0-100).
        components: Mapping of component name to its contribution value.
        data_available: True if sufficient data existed to score this pillar.
    """

    score: float = Field(ge=0.0, le=100.0)
    components: dict[str, float | None] = Field(default_factory=dict)
    data_available: bool = True


class ScoreResult(BaseModel):
    """Composite transparency and financial-health score for one organisation.

    Attributes:
        org_id: UUID of the scored organisation.
        fiscal_year: Fiscal year the score relates to.
        overall_score: Weighted composite score (0-100).
        financial_health_score: Financial Health pillar score (0-100).
        transparency_score: Transparency pillar score (0-100).
        governance_score: Governance pillar score (0-100).
        efficiency_score: Efficiency pillar score (0-100).
        score_breakdown: Per-pillar PillarBreakdown objects serialised to dict.
        methodology_version: Algorithm version used (e.g. 'v1').
    """

    org_id: str
    fiscal_year: int | None = None
    overall_score: float = Field(ge=0.0, le=100.0)
    financial_health_score: float = Field(ge=0.0, le=100.0)
    transparency_score: float = Field(ge=0.0, le=100.0)
    governance_score: float = Field(ge=0.0, le=100.0)
    efficiency_score: float = Field(ge=0.0, le=100.0)
    score_breakdown: dict[str, Any] = Field(default_factory=dict)
    methodology_version: str = METHODOLOGY_VERSION


# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    """Clamp a value to [lo, hi]."""
    return max(lo, min(hi, value))


def _safe_float(value: Any) -> float | None:
    """Coerce to float, returning None for invalid/NaN values."""
    if value is None:
        return None
    try:
        f = float(value)
        return None if math.isnan(f) else f
    except (TypeError, ValueError):
        return None


def _score_revenue_trend(filings: list[dict[str, Any]]) -> float | None:
    """Score 3-year revenue trend.  Growth is rewarded; decline is penalised.

    Maps compound annual growth rate to 0-100:
    - CAGR >= +20% -> 100
    - CAGR   0%    -> 50
    - CAGR <= -50% -> 0

    Args:
        filings: List of financial filings sorted descending by fiscal_year.

    Returns:
        Component score 0-100, or None if insufficient data.
    """
    revenues = [_safe_float(f.get("total_revenue")) for f in filings[:3]]
    revenues = [r for r in revenues if r is not None and r > 0]
    if len(revenues) < 2:
        return None
    n_periods = len(revenues) - 1
    if revenues[-1] <= 0:
        return 50.0
    # revenues[0] is most recent, revenues[-1] is oldest
    cagr = (revenues[0] / revenues[-1]) ** (1 / n_periods) - 1
    score = 50.0 + (cagr / 0.20) * 50.0
    return _clamp(score)


def _score_working_capital(filing: dict[str, Any]) -> float | None:
    """Score working capital ratio (assets / liabilities).

    Args:
        filing: Latest financial filing dict.

    Returns:
        Component score 0-100, or None if data missing.
    """
    ratio = _safe_float(filing.get("working_capital_ratio"))
    if ratio is None:
        assets = _safe_float(filing.get("total_assets"))
        liabilities = _safe_float(filing.get("total_liabilities"))
        if assets is None or liabilities is None or liabilities <= 0:
            return None
        ratio = assets / liabilities
    # Benchmark: ratio >= 2.0 is excellent (100), ratio <= 1.0 is poor (0)
    score = (ratio - 1.0) / 1.0 * 100.0
    return _clamp(score)


def _score_revenue_diversification(filing: dict[str, Any]) -> float | None:
    """Score revenue diversification using a simplified Herfindahl index.

    Lower concentration (more diversification) yields a higher score.

    Args:
        filing: Latest financial filing dict.

    Returns:
        Component score 0-100, or None if data missing.
    """
    total = _safe_float(filing.get("total_revenue"))
    if total is None or total <= 0:
        return None

    sources = [
        _safe_float(filing.get("contributions_grants")) or 0.0,
        _safe_float(filing.get("program_service_revenue")) or 0.0,
        _safe_float(filing.get("investment_income")) or 0.0,
        _safe_float(filing.get("other_revenue")) or 0.0,
    ]
    # Herfindahl index: sum of squared shares
    hhi = sum((s / total) ** 2 for s in sources if s > 0)
    # HHI range: 0.25 (perfectly diversified) to 1.0 (100% one source)
    # Map to 0-100: HHI=1.0 -> 0, HHI=0.25 -> 100
    score = (1.0 - hhi) / 0.75 * 100.0
    return _clamp(score)


def _score_cash_reserve_months(filing: dict[str, Any]) -> float | None:
    """Score months of cash reserves (net_assets / monthly expenses).

    Args:
        filing: Latest financial filing dict.

    Returns:
        Component score 0-100, or None if data missing.
    """
    net_assets = _safe_float(filing.get("net_assets"))
    total_expenses = _safe_float(filing.get("total_expenses"))
    if net_assets is None or total_expenses is None or total_expenses <= 0:
        return None
    monthly_expenses = total_expenses / 12.0
    months = net_assets / monthly_expenses
    benchmark = settings.scoring_cash_reserve_months_benchmark
    score = (months / benchmark) * 100.0
    return _clamp(score)


def _compute_financial_health(filings: list[dict[str, Any]]) -> PillarBreakdown:
    """Compute Financial Health pillar score (0-100).

    Sub-components (equally weighted):
    - Revenue trend (3-year CAGR)
    - Working capital ratio
    - Revenue diversification (Herfindahl)
    - Cash reserve months

    Args:
        filings: Filings sorted descending by fiscal_year.

    Returns:
        PillarBreakdown with score and component breakdown.
    """
    if not filings:
        return PillarBreakdown(score=0.0, data_available=False)

    latest = filings[0]
    components: dict[str, float | None] = {
        "revenue_trend": _score_revenue_trend(filings),
        "working_capital": _score_working_capital(latest),
        "revenue_diversification": _score_revenue_diversification(latest),
        "cash_reserve_months": _score_cash_reserve_months(latest),
    }

    available = [v for v in components.values() if v is not None]
    if not available:
        return PillarBreakdown(score=0.0, components=components, data_available=False)

    score = sum(available) / len(available)
    return PillarBreakdown(score=_clamp(score), components=components)


def _compute_transparency(
    filings: list[dict[str, Any]],
    org: dict[str, Any],
) -> PillarBreakdown:
    """Compute Transparency pillar score (0-100).

    Sub-components:
    - Filing completeness — % of expected fields populated
    - Filing timeliness — placeholder (50 when period_end unknown)
    - Audit status — bonus if audited filing present
    - Data availability — multi-year history bonus

    Args:
        filings: Filings sorted descending by fiscal_year.
        org: Organisation record dict.

    Returns:
        PillarBreakdown with score and component breakdown.
    """
    if not filings:
        return PillarBreakdown(score=0.0, data_available=False)

    latest = filings[0]

    # Filing completeness: count populated financial fields
    expected_fields = list(_EXPECTED_FINANCIAL_FIELDS)
    populated = sum(1 for f in expected_fields if latest.get(f) is not None)
    completeness_score = (populated / len(expected_fields)) * 100.0

    # Data availability: reward multi-year history
    year_count = len(filings)
    availability_score = min(year_count / 5.0 * 100.0, 100.0)

    # Timeliness: use 50 as neutral when period_end not available
    timeliness_score = 50.0

    # Audit status: if org or filing indicates audit, award bonus
    # Use data_completeness field as proxy when explicit audit flag is absent
    data_completeness = _safe_float(org.get("data_completeness"))
    audit_score = (data_completeness * 100.0) if data_completeness is not None else 50.0

    components: dict[str, float | None] = {
        "filing_completeness": completeness_score,
        "filing_timeliness": timeliness_score,
        "audit_status": audit_score,
        "data_availability": availability_score,
    }
    score = sum(v for v in components.values() if v is not None) / len(components)
    return PillarBreakdown(score=_clamp(score), components=components)


def _compute_governance(
    org: dict[str, Any],
    people: list[dict[str, Any]],
) -> PillarBreakdown:
    """Compute Governance pillar score (0-100).

    Sub-components:
    - Board size adequacy (optimal: 5-25 members)
    - Board independence (% non-compensated directors)
    - Officer disclosure (named officers with titles)
    - Conflict of interest policy (proxy via data completeness)

    Args:
        org: Organisation record dict.
        people: List of person records (directors / officers).

    Returns:
        PillarBreakdown with score and component breakdown.
    """
    board_members = [
        p for p in people if p.get("role") in ("director", "trustee", "board_member")
    ]
    board_size = len(board_members)
    board_min = settings.scoring_board_size_min
    board_max = settings.scoring_board_size_max

    # Board size: [board_min, board_max] is optimal
    if board_size == 0:
        size_score: float | None = None
    elif board_min <= board_size <= board_max:
        size_score = 100.0
    elif board_size < board_min:
        size_score = (board_size / board_min) * 100.0
    else:
        # Penalise oversized boards linearly — double board_max scores 0
        oversize_range = board_max  # half the "double" range
        size_score = max(0.0, 100.0 - ((board_size - board_max) / oversize_range) * 100.0)

    # Board independence: non-compensated directors
    if board_size > 0:
        non_comp = sum(
            1 for p in board_members if not _safe_float(p.get("compensation"))
        )
        independence_score: float | None = (non_comp / board_size) * 100.0
    else:
        independence_score = None

    # Officer disclosure: officers with titles present
    officers = [
        p for p in people
        if p.get("role") in ("officer", "president", "ceo", "cfo", "executive_director")
        and p.get("name")
        and p.get("title")
    ]
    disclosure_score: float | None = 100.0 if officers else 0.0

    # Conflict-of-interest policy proxy
    coi_score = 50.0  # Default neutral; extend when explicit field is available

    components: dict[str, float | None] = {
        "board_size": size_score,
        "board_independence": independence_score,
        "officer_disclosure": disclosure_score,
        "conflict_of_interest_policy": coi_score,
    }
    available = [v for v in components.values() if v is not None]
    if not available:
        return PillarBreakdown(score=0.0, components=components, data_available=False)

    score = sum(available) / len(available)
    return PillarBreakdown(score=_clamp(score), components=components)


def _compute_efficiency(filing: dict[str, Any]) -> PillarBreakdown:
    """Compute Efficiency pillar score (0-100).

    Sub-components:
    - Program expense ratio  (benchmark from settings; >75% -> 100 by default)
    - Fundraising efficiency (benchmark from settings; <$0.25 per $1 raised -> 100)
    - Admin expense ratio    (benchmark from settings; <15% -> 100 by default)
    - Joint cost flag        (penalise if joint costs > 20% of total expenses)

    All benchmarks are sourced from ``app.config.Settings`` and can be
    overridden via environment variables.

    Args:
        filing: Latest financial filing dict.

    Returns:
        PillarBreakdown with score and component breakdown.
    """
    per_benchmark = settings.scoring_program_expense_ratio_benchmark
    fe_benchmark = settings.scoring_fundraising_efficiency_benchmark
    aer_benchmark = settings.scoring_admin_expense_ratio_benchmark

    # Program expense ratio: higher is better
    per = _safe_float(filing.get("program_expense_ratio"))
    if per is not None:
        program_score: float | None = _clamp((per / per_benchmark) * 100.0)
    else:
        program_score = None

    # Fundraising efficiency (lower is better); double the benchmark = 0 points
    fe = _safe_float(filing.get("fundraising_efficiency"))
    if fe is not None and fe >= 0:
        fundraising_score: float | None = _clamp(
            (1.0 - fe / (fe_benchmark * 2.0)) * 100.0
        )
    else:
        fundraising_score = None

    # Admin expense ratio (lower is better); double the benchmark = 0 points
    aer = _safe_float(filing.get("admin_expense_ratio"))
    if aer is not None:
        admin_score: float | None = _clamp(
            (1.0 - aer / (aer_benchmark * 2.0)) * 100.0
        )
    else:
        admin_score = None

    # Joint cost flag — penalise if present in filing evidence.
    # No explicit field yet; default to neutral (100) pending extended schema.
    joint_cost_score = 100.0

    components: dict[str, float | None] = {
        "program_expense_ratio": program_score,
        "fundraising_efficiency": fundraising_score,
        "admin_expense_ratio": admin_score,
        "joint_cost_flag": joint_cost_score,
    }
    available = [v for v in components.values() if v is not None]
    if not available:
        return PillarBreakdown(score=0.0, components=components, data_available=False)

    score = sum(available) / len(available)
    return PillarBreakdown(score=_clamp(score), components=components)


# Fields that are expected to be populated in a complete filing
_EXPECTED_FINANCIAL_FIELDS: tuple[str, ...] = (
    "total_revenue",
    "contributions_grants",
    "program_service_revenue",
    "total_expenses",
    "program_expenses",
    "admin_expenses",
    "fundraising_expenses",
    "total_assets",
    "total_liabilities",
    "net_assets",
    "program_expense_ratio",
    "admin_expense_ratio",
)


# ---------------------------------------------------------------------------
# Main async scoring entry point
# ---------------------------------------------------------------------------


async def compute_score(
    org_id: str,
    db_client: Any,
) -> ScoreResult:
    """Compute the OpenGive Transparency Score for an organisation.

    Fetches financial filings, organisation record, and people records from
    Supabase, then computes each of the four scoring pillars before combining
    them with the PRD-specified weights.

    Args:
        org_id: UUID of the organisation to score.
        db_client: Authenticated Supabase Client instance (service role).

    Returns:
        ScoreResult with overall score, pillar scores, and per-component
        breakdown suitable for storage in ``organization_scores``.
    """
    log = logger.bind(org_id=org_id)
    log.info("compute_score_start")

    # ------------------------------------------------------------------
    # Fetch organisation record
    # ------------------------------------------------------------------
    try:
        org_resp = (
            db_client.table("organizations")
            .select("*")
            .eq("id", org_id)
            .single()
            .execute()
        )
        org: dict[str, Any] = org_resp.data or {}
    except Exception as exc:
        log.error("compute_score_fetch_org_failed", error=str(exc))
        org = {}

    # ------------------------------------------------------------------
    # Fetch financial filings (up to 5 years)
    # ------------------------------------------------------------------
    try:
        filings_resp = (
            db_client.table("financial_filings")
            .select("*")
            .eq("organization_id", org_id)
            .order("fiscal_year", desc=True)
            .limit(5)
            .execute()
        )
        filings: list[dict[str, Any]] = filings_resp.data or []
    except Exception as exc:
        log.error("compute_score_fetch_filings_failed", error=str(exc))
        filings = []

    # ------------------------------------------------------------------
    # Fetch people records (directors, officers)
    # ------------------------------------------------------------------
    try:
        people_resp = (
            db_client.table("people")
            .select("*")
            .eq("organization_id", org_id)
            .execute()
        )
        people: list[dict[str, Any]] = people_resp.data or []
    except Exception as exc:
        log.warning("compute_score_fetch_people_failed", error=str(exc))
        people = []

    latest_filing = filings[0] if filings else {}
    fiscal_year: int | None = latest_filing.get("fiscal_year") if latest_filing else None

    # ------------------------------------------------------------------
    # Compute each pillar
    # ------------------------------------------------------------------
    fh_breakdown = _compute_financial_health(filings)
    t_breakdown = _compute_transparency(filings, org)
    g_breakdown = _compute_governance(org, people)
    e_breakdown = _compute_efficiency(latest_filing)

    fh_score = fh_breakdown.score
    t_score = t_breakdown.score
    g_score = g_breakdown.score
    e_score = e_breakdown.score

    overall = (
        PILLAR_WEIGHTS["financial_health"] * fh_score
        + PILLAR_WEIGHTS["transparency"] * t_score
        + PILLAR_WEIGHTS["governance"] * g_score
        + PILLAR_WEIGHTS["efficiency"] * e_score
    )
    overall = _clamp(overall)

    log.info(
        "compute_score_complete",
        overall=round(overall, 2),
        financial_health=round(fh_score, 2),
        transparency=round(t_score, 2),
        governance=round(g_score, 2),
        efficiency=round(e_score, 2),
    )

    return ScoreResult(
        org_id=org_id,
        fiscal_year=fiscal_year,
        overall_score=round(overall, 2),
        financial_health_score=round(fh_score, 2),
        transparency_score=round(t_score, 2),
        governance_score=round(g_score, 2),
        efficiency_score=round(e_score, 2),
        score_breakdown={
            "financial_health": fh_breakdown.model_dump(),
            "transparency": t_breakdown.model_dump(),
            "governance": g_breakdown.model_dump(),
            "efficiency": e_breakdown.model_dump(),
            "weights": PILLAR_WEIGHTS,
        },
        methodology_version=METHODOLOGY_VERSION,
    )
