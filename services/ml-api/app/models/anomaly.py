from __future__ import annotations

import math
from enum import Enum
from typing import Any

import structlog
from pydantic import BaseModel, Field

from app.config import settings

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Severity / type enumerations
# ---------------------------------------------------------------------------

VALID_ALERT_TYPES = frozenset(
    {
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
        "overhead_flip",
        "revenue_cliff",
    }
)


class AlertSeverity(str, Enum):
    """Severity levels matching the anomaly_alerts table CHECK constraint."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class AnomalyEvidence(BaseModel):
    """Structured evidence payload stored in anomaly_alerts.evidence (JSONB).

    Attributes:
        field_values: Raw field values from the filing that triggered the rule.
        thresholds: Threshold values compared against the field values.
        computed: Computed ratios or differences produced by the rule.
        fiscal_year: The fiscal year of the filing under scrutiny.
        peer_context: Optional peer-group comparison data.
    """

    field_values: dict[str, float | int | None] = Field(default_factory=dict)
    thresholds: dict[str, float | int] = Field(default_factory=dict)
    computed: dict[str, float | None] = Field(default_factory=dict)
    fiscal_year: int | None = None
    peer_context: dict[str, Any] = Field(default_factory=dict)


class AnomalyResult(BaseModel):
    """A single detected anomaly for one organization.

    Attributes:
        alert_type: Machine-readable anomaly type (matches DB CHECK constraint).
        severity: Severity level (low / medium / high / critical).
        confidence: Estimated confidence that this is a genuine anomaly (0-1).
        title: Short human-readable title for display in the dashboard.
        description: Plain-language explanation of why this is flagged.
        evidence: Structured evidence data.
        methodology: Name of the rule or model that generated the alert.
        fiscal_year: Fiscal year the anomaly relates to, if applicable.
    """

    alert_type: str
    severity: AlertSeverity
    confidence: float = Field(ge=0.0, le=1.0)
    title: str
    description: str
    evidence: AnomalyEvidence = Field(default_factory=AnomalyEvidence)
    methodology: str = "rule_engine_v1"
    fiscal_year: int | None = None


# ---------------------------------------------------------------------------
# Rule catalogue (kept in sync with PRD section 11)
# ---------------------------------------------------------------------------

ANOMALY_RULES: dict[str, dict[str, str]] = {
    "zero_fundraising": {
        "condition": (
            "fundraising_expenses == 0 "
            "AND contributions_grants > ZERO_FUNDRAISING_CONTRIBUTIONS_MIN"
        ),
        "severity": "high",
        "description": (
            "Organization reports zero fundraising costs despite receiving "
            "over $500K in contributions"
        ),
    },
    "overhead_flip": {
        "condition": (
            "year_over_year admin_expense_ratio change > OVERHEAD_FLIP_THRESHOLD"
        ),
        "severity": "medium",
        "description": (
            "Dramatic shift in administrative expense ratio suggests "
            "reclassification of joint costs"
        ),
    },
    "compensation_outlier": {
        "condition": (
            "ceo_compensation > 2 * peer_median "
            "AND total_revenue < 5_000_000"
        ),
        "severity": "high",
        "description": (
            "Executive compensation significantly exceeds peer benchmarks "
            "relative to organization size"
        ),
    },
    "benford_violation": {
        "condition": "benford_chi_squared p_value < BENFORD_P_VALUE_THRESHOLD",
        "severity": "medium",
        "description": (
            "Financial figures do not follow expected leading-digit distribution "
            "patterns (Benford's Law)"
        ),
    },
    "shell_indicator": {
        "condition": (
            "shared_address_count > SHELL_SHARED_ADDRESS_MIN "
            "AND shared_director_count > SHELL_SHARED_DIRECTOR_MIN"
        ),
        "severity": "critical",
        "description": (
            "Organization shares address and directors with multiple other "
            "entities — potential shell or circular-funding structure"
        ),
    },
    "revenue_cliff": {
        "condition": (
            "year_over_year total_revenue decline > REVENUE_CLIFF_THRESHOLD"
        ),
        "severity": "medium",
        "description": (
            "Sudden and dramatic revenue decline may indicate organizational "
            "distress or dissolution"
        ),
    },
    "revenue_expense_mismatch": {
        "condition": "abs(total_revenue - total_expenses) / total_revenue > 0.30",
        "severity": "medium",
        "description": (
            "Revenue and expense figures diverge by more than 30%, which may "
            "indicate misclassified line items or transcription errors"
        ),
    },
    "filing_inconsistency": {
        "condition": (
            "sum(program_expenses, admin_expenses, fundraising_expenses) "
            "!= total_expenses"
        ),
        "severity": "low",
        "description": (
            "Expense sub-totals do not reconcile with the reported total "
            "expenses figure"
        ),
    },
}


# ---------------------------------------------------------------------------
# Rule evaluation helpers
# ---------------------------------------------------------------------------


def _safe_float(value: Any) -> float | None:
    """Coerce a value to float, returning None for falsy/invalid values."""
    if value is None:
        return None
    try:
        f = float(value)
        return None if math.isnan(f) else f
    except (TypeError, ValueError):
        return None


def _check_zero_fundraising(
    filing: dict[str, Any],
) -> AnomalyResult | None:
    """Rule 1 — zero fundraising expenses with large contribution income.

    Args:
        filing: Financial filing dict from Supabase.

    Returns:
        AnomalyResult if the rule fires, else None.
    """
    fundraising = _safe_float(filing.get("fundraising_expenses"))
    contributions = _safe_float(filing.get("contributions_grants"))
    min_contributions = settings.zero_fundraising_contributions_min

    if fundraising is None or contributions is None:
        return None
    if fundraising == 0 and contributions > min_contributions:
        return AnomalyResult(
            alert_type="zero_fundraising",
            severity=AlertSeverity.HIGH,
            confidence=0.80,
            title="Zero Fundraising Expenses with Significant Contributions",
            description=ANOMALY_RULES["zero_fundraising"]["description"],
            evidence=AnomalyEvidence(
                field_values={
                    "fundraising_expenses": fundraising,
                    "contributions_grants": contributions,
                },
                thresholds={"min_contributions": min_contributions},
                fiscal_year=filing.get("fiscal_year"),
            ),
            fiscal_year=filing.get("fiscal_year"),
        )
    return None


def _check_overhead_flip(
    filing: dict[str, Any],
    prior_filing: dict[str, Any] | None,
) -> AnomalyResult | None:
    """Rule 2 — year-over-year admin expense ratio swing > threshold.

    Args:
        filing: Most recent financial filing dict.
        prior_filing: Prior-year filing dict, or None if unavailable.

    Returns:
        AnomalyResult if the rule fires, else None.
    """
    if prior_filing is None:
        return None

    current_ratio = _safe_float(filing.get("admin_expense_ratio"))
    prior_ratio = _safe_float(prior_filing.get("admin_expense_ratio"))
    threshold = settings.overhead_flip_threshold

    if current_ratio is None or prior_ratio is None:
        return None

    change = abs(current_ratio - prior_ratio)
    if change > threshold:
        return AnomalyResult(
            alert_type="overhead_flip",
            severity=AlertSeverity.MEDIUM,
            confidence=0.70,
            title="Dramatic Overhead Ratio Shift",
            description=ANOMALY_RULES["overhead_flip"]["description"],
            evidence=AnomalyEvidence(
                field_values={
                    "current_admin_expense_ratio": current_ratio,
                    "prior_admin_expense_ratio": prior_ratio,
                },
                thresholds={"max_yoy_change": threshold},
                computed={"yoy_change": change},
                fiscal_year=filing.get("fiscal_year"),
            ),
            fiscal_year=filing.get("fiscal_year"),
        )
    return None


def _check_compensation_outlier(
    filing: dict[str, Any],
    peer_median_ceo_comp: float | None,
) -> AnomalyResult | None:
    """Rule 3 — CEO comp > 2× peer median when revenue < $5M.

    Args:
        filing: Financial filing dict (must include ceo_compensation if available).
        peer_median_ceo_comp: Median CEO compensation across peer organisations.

    Returns:
        AnomalyResult if the rule fires, else None.
    """
    ceo_comp = _safe_float(filing.get("ceo_compensation"))
    revenue = _safe_float(filing.get("total_revenue"))
    revenue_threshold = 5_000_000.0
    multiplier = 2.0

    if ceo_comp is None or peer_median_ceo_comp is None or revenue is None:
        return None
    if peer_median_ceo_comp <= 0:
        return None

    if ceo_comp > multiplier * peer_median_ceo_comp and revenue < revenue_threshold:
        ratio = ceo_comp / peer_median_ceo_comp
        return AnomalyResult(
            alert_type="compensation_outlier",
            severity=AlertSeverity.HIGH,
            confidence=0.75,
            title="Executive Compensation Outlier",
            description=ANOMALY_RULES["compensation_outlier"]["description"],
            evidence=AnomalyEvidence(
                field_values={
                    "ceo_compensation": ceo_comp,
                    "total_revenue": revenue,
                    "peer_median_ceo_comp": peer_median_ceo_comp,
                },
                thresholds={
                    "peer_median_multiplier": multiplier,
                    "max_revenue": revenue_threshold,
                },
                computed={"comp_to_peer_ratio": ratio},
                fiscal_year=filing.get("fiscal_year"),
            ),
            fiscal_year=filing.get("fiscal_year"),
        )
    return None


def _check_benford_violation(
    org_id: str,
    p_value: float | None,
    chi_squared: float | None,
    fiscal_year: int | None,
) -> AnomalyResult | None:
    """Rule 4 — Benford chi-squared p-value below threshold.

    Args:
        org_id: Organisation UUID (for logging context).
        p_value: Chi-squared p-value from run_benford_test().
        chi_squared: Chi-squared statistic from run_benford_test().
        fiscal_year: Most recent fiscal year analysed.

    Returns:
        AnomalyResult if the rule fires, else None.
    """
    threshold = settings.benford_p_value_threshold

    if p_value is None:
        return None
    if p_value < threshold:
        return AnomalyResult(
            alert_type="benford_violation",
            severity=AlertSeverity.MEDIUM,
            confidence=0.65,
            title="Benford's Law Violation",
            description=ANOMALY_RULES["benford_violation"]["description"],
            evidence=AnomalyEvidence(
                field_values={"p_value": p_value, "chi_squared": chi_squared},
                thresholds={"p_value_threshold": threshold},
                fiscal_year=fiscal_year,
            ),
            fiscal_year=fiscal_year,
        )
    return None


def _check_shell_indicator(
    org_id: str,
    shared_address_count: int,
    shared_director_count: int,
) -> AnomalyResult | None:
    """Rule 5 — shared address + director count exceeds shell thresholds.

    Args:
        org_id: Organisation UUID (for logging context).
        shared_address_count: Number of other orgs at the same address.
        shared_director_count: Number of directors shared with other orgs.

    Returns:
        AnomalyResult if the rule fires, else None.
    """
    addr_min = settings.shell_shared_address_min
    dir_min = settings.shell_shared_director_min

    if shared_address_count > addr_min and shared_director_count > dir_min:
        return AnomalyResult(
            alert_type="shell_indicator",
            severity=AlertSeverity.CRITICAL,
            confidence=0.85,
            title="Potential Shell Entity Indicator",
            description=ANOMALY_RULES["shell_indicator"]["description"],
            evidence=AnomalyEvidence(
                field_values={
                    "shared_address_count": shared_address_count,
                    "shared_director_count": shared_director_count,
                },
                thresholds={
                    "shared_address_min": addr_min,
                    "shared_director_min": dir_min,
                },
            ),
        )
    return None


def _check_revenue_cliff(
    filing: dict[str, Any],
    prior_filing: dict[str, Any] | None,
) -> AnomalyResult | None:
    """Rule 6 — year-over-year revenue decline exceeds threshold.

    Args:
        filing: Most recent financial filing dict.
        prior_filing: Prior-year filing dict, or None if unavailable.

    Returns:
        AnomalyResult if the rule fires, else None.
    """
    if prior_filing is None:
        return None

    current_rev = _safe_float(filing.get("total_revenue"))
    prior_rev = _safe_float(filing.get("total_revenue", prior_filing.get("total_revenue")))
    # Correct: get prior year revenue from prior_filing
    prior_rev = _safe_float(prior_filing.get("total_revenue"))
    threshold = settings.revenue_cliff_threshold

    if current_rev is None or prior_rev is None or prior_rev <= 0:
        return None

    decline = (prior_rev - current_rev) / prior_rev
    if decline > threshold:
        return AnomalyResult(
            alert_type="revenue_cliff",
            severity=AlertSeverity.MEDIUM,
            confidence=0.75,
            title="Significant Revenue Decline",
            description=ANOMALY_RULES["revenue_cliff"]["description"],
            evidence=AnomalyEvidence(
                field_values={
                    "current_revenue": current_rev,
                    "prior_revenue": prior_rev,
                },
                thresholds={"max_yoy_decline": threshold},
                computed={"yoy_decline_pct": decline},
                fiscal_year=filing.get("fiscal_year"),
            ),
            fiscal_year=filing.get("fiscal_year"),
        )
    return None


# ---------------------------------------------------------------------------
# Main async detection entry point
# ---------------------------------------------------------------------------


async def detect_anomalies(
    org_id: str,
    db_client: Any,
) -> list[AnomalyResult]:
    """Run all anomaly detection rules against an organisation's filings.

    Fetches financial filings from Supabase, evaluates all six PRD rules, and
    returns a deduplicated list of detected anomalies ordered by severity.

    The Benford rule is run independently via analyze_benford() whose result is
    passed in as a pre-computed p-value so detection stays composable.

    Args:
        org_id: UUID of the organisation to analyse.
        db_client: Authenticated Supabase Client instance (service role).

    Returns:
        List of AnomalyResult objects for every rule that fired.  Empty if none.
    """
    log = logger.bind(org_id=org_id)
    log.info("detect_anomalies_start")

    results: list[AnomalyResult] = []

    # ------------------------------------------------------------------
    # Fetch financial filings sorted descending by fiscal_year
    # ------------------------------------------------------------------
    try:
        resp = (
            db_client.table("financial_filings")
            .select("*")
            .eq("organization_id", org_id)
            .order("fiscal_year", desc=True)
            .limit(5)
            .execute()
        )
        filings: list[dict[str, Any]] = resp.data or []
    except Exception as exc:
        log.error("detect_anomalies_fetch_filings_failed", error=str(exc))
        return []

    if not filings:
        log.info("detect_anomalies_no_filings")
        return []

    latest = filings[0]
    prior = filings[1] if len(filings) > 1 else None
    latest_year: int | None = latest.get("fiscal_year")

    # ------------------------------------------------------------------
    # Rule 1 — zero fundraising
    # ------------------------------------------------------------------
    if r := _check_zero_fundraising(latest):
        results.append(r)

    # ------------------------------------------------------------------
    # Rule 2 — overhead flip (YoY)
    # ------------------------------------------------------------------
    if r := _check_overhead_flip(latest, prior):
        results.append(r)

    # ------------------------------------------------------------------
    # Rule 3 — compensation outlier (requires people table lookup)
    # ------------------------------------------------------------------
    try:
        people_resp = (
            db_client.table("people")
            .select("compensation")
            .eq("organization_id", org_id)
            .not_.is_("compensation", "null")
            .order("compensation", desc=True)
            .limit(1)
            .execute()
        )
        people_rows: list[dict[str, Any]] = people_resp.data or []
        ceo_comp: float | None = None
        if people_rows:
            ceo_comp = _safe_float(people_rows[0].get("compensation"))

        # Peer median: average CEO comp across orgs with similar revenue
        peer_median: float | None = None
        if ceo_comp is not None:
            rev = _safe_float(latest.get("total_revenue"))
            if rev is not None:
                low_bound = rev * 0.5
                high_bound = rev * 2.0
                peer_resp = (
                    db_client.rpc(
                        "get_peer_median_ceo_comp",
                        {
                            "org_id_param": org_id,
                            "revenue_low": low_bound,
                            "revenue_high": high_bound,
                        },
                    ).execute()
                )
                if peer_resp.data:
                    peer_median = _safe_float(peer_resp.data)

        # Inject ceo_compensation into the filing dict for the rule helper
        latest_with_comp = {**latest, "ceo_compensation": ceo_comp}
        if r := _check_compensation_outlier(latest_with_comp, peer_median):
            results.append(r)
    except Exception as exc:
        log.warning("detect_anomalies_compensation_check_failed", error=str(exc))

    # ------------------------------------------------------------------
    # Rule 4 — Benford violation (delegate to benford module)
    # ------------------------------------------------------------------
    try:
        from app.models.benford import analyze_benford  # noqa: PLC0415

        benford_result = await analyze_benford(org_id, db_client)
        if r := _check_benford_violation(
            org_id,
            benford_result.p_value,
            benford_result.chi_squared,
            latest_year,
        ):
            results.append(r)
    except Exception as exc:
        log.warning("detect_anomalies_benford_check_failed", error=str(exc))

    # ------------------------------------------------------------------
    # Rule 5 — shell indicator (entity_matches table)
    # ------------------------------------------------------------------
    try:
        # Count orgs sharing same registered address via org metadata
        org_resp = (
            db_client.table("organizations")
            .select("registered_address")
            .eq("id", org_id)
            .single()
            .execute()
        )
        org_address: str | None = None
        if org_resp.data:
            org_address = org_resp.data.get("registered_address")

        shared_addr_count = 0
        if org_address:
            addr_resp = (
                db_client.table("organizations")
                .select("id", count="exact")
                .eq("registered_address", org_address)
                .neq("id", org_id)
                .execute()
            )
            shared_addr_count = addr_resp.count or 0

        # Count directors shared across entity_matches confirmed pairs
        matches_resp = (
            db_client.table("entity_matches")
            .select("org_a_id,org_b_id")
            .or_(f"org_a_id.eq.{org_id},org_b_id.eq.{org_id}")
            .eq("match_type", "confirmed")
            .execute()
        )
        match_rows: list[dict[str, Any]] = matches_resp.data or []
        matched_org_ids: list[str] = []
        for m in match_rows:
            other = m["org_b_id"] if m["org_a_id"] == org_id else m["org_a_id"]
            matched_org_ids.append(other)

        shared_director_count = len(matched_org_ids)

        if r := _check_shell_indicator(org_id, shared_addr_count, shared_director_count):
            results.append(r)
    except Exception as exc:
        log.warning("detect_anomalies_shell_check_failed", error=str(exc))

    # ------------------------------------------------------------------
    # Rule 6 — revenue cliff
    # ------------------------------------------------------------------
    if r := _check_revenue_cliff(latest, prior):
        results.append(r)

    log.info("detect_anomalies_complete", anomaly_count=len(results))
    return results
