from __future__ import annotations

import math
from typing import Any, Sequence

import structlog
from pydantic import BaseModel, Field
from scipy import stats  # type: ignore[import-untyped]

from app.config import settings

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Expected leading-digit distribution under Benford's Law
# ---------------------------------------------------------------------------
# Pre-computed for digits 1-9 using log10(1 + 1/d).

BENFORD_EXPECTED: dict[int, float] = {
    d: math.log10(1 + 1 / d) for d in range(1, 10)
}

# Financial columns fetched for Benford analysis.
_FINANCIAL_COLUMNS: tuple[str, ...] = (
    "total_revenue",
    "contributions_grants",
    "program_service_revenue",
    "investment_income",
    "other_revenue",
    "total_expenses",
    "program_expenses",
    "admin_expenses",
    "fundraising_expenses",
    "total_assets",
    "total_liabilities",
    "net_assets",
)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class BenfordDigitFrequency(BaseModel):
    """Observed vs. expected frequency for a single leading digit.

    Attributes:
        digit: Leading digit (1-9).
        observed_count: Raw count of values with this leading digit.
        observed_frequency: Proportion of values with this leading digit.
        expected_frequency: Theoretical Benford's Law probability.
        deviation: Absolute difference (observed - expected).
    """

    digit: int = Field(ge=1, le=9)
    observed_count: int = Field(ge=0)
    observed_frequency: float = Field(ge=0.0, le=1.0)
    expected_frequency: float = Field(ge=0.0, le=1.0)
    deviation: float


class BenfordResult(BaseModel):
    """Result of Benford's Law analysis for one organisation.

    Attributes:
        org_id: UUID of the analysed organisation.
        value_count: Total number of financial values analysed.
        digit_frequencies: Per-digit observed vs. expected breakdown.
        chi_squared: Chi-squared test statistic (8 degrees of freedom).
        p_value: Resulting p-value; low values indicate non-conformance.
        is_anomaly: True when p_value < benford_p_value_threshold.
        status: One of 'pass', 'warn', 'fail', or 'insufficient_data'.
    """

    org_id: str
    value_count: int = Field(ge=0)
    digit_frequencies: list[BenfordDigitFrequency] = Field(default_factory=list)
    chi_squared: float | None = None
    p_value: float | None = None
    is_anomaly: bool = False
    status: str = "pass"


# ---------------------------------------------------------------------------
# Core statistical helpers
# ---------------------------------------------------------------------------


def benford_expected_distribution() -> dict[int, float]:
    """Return the theoretical Benford probabilities for digits 1-9.

    Returns:
        Dict mapping each digit (1-9) to its Benford probability.
    """
    return dict(BENFORD_EXPECTED)


def extract_leading_digits(values: Sequence[float | int | None]) -> list[int]:
    """Extract the leading (first significant) digit from each value.

    Signs are stripped; zeros and None values are skipped.

    Args:
        values: Sequence of numeric financial figures.

    Returns:
        List of leading digits (each in range 1-9).
    """
    digits: list[int] = []
    for v in values:
        if v is None:
            continue
        try:
            f = float(v)
        except (TypeError, ValueError):
            continue
        if math.isnan(f) or f == 0.0:
            continue
        # Strip sign and any fractional prefix to reach first non-zero digit
        s = f"{abs(f):.10g}".lstrip("0").replace(".", "")
        if s:
            d = int(s[0])
            if 1 <= d <= 9:
                digits.append(d)
    return digits


def run_benford_test(
    values: Sequence[float | int | None],
    p_threshold: float | None = None,
    org_id: str = "",
) -> BenfordResult:
    """Perform Benford's Law chi-squared goodness-of-fit test.

    Requires at least 50 data points for a meaningful test; returns
    status='insufficient_data' otherwise.

    Args:
        values: Financial figures to analyse.
        p_threshold: Override for the p-value anomaly threshold.
            Defaults to ``settings.benford_p_value_threshold``.
        org_id: Organisation UUID (included in the result for traceability).

    Returns:
        BenfordResult with chi-squared statistic, p-value, and per-digit
        frequency breakdown.
    """
    threshold = p_threshold if p_threshold is not None else settings.benford_p_value_threshold
    digits = extract_leading_digits(values)
    n = len(digits)

    if n < 50:
        logger.info("benford_insufficient_data", org_id=org_id, count=n)
        return BenfordResult(
            org_id=org_id,
            value_count=n,
            status="insufficient_data",
        )

    # Count observed occurrences per digit
    observed_counts: dict[int, int] = {d: 0 for d in range(1, 10)}
    for d in digits:
        observed_counts[d] += 1

    # Build frequency objects
    digit_frequencies: list[BenfordDigitFrequency] = []
    observed_freq_array: list[float] = []
    expected_freq_array: list[float] = []

    for d in range(1, 10):
        obs_count = observed_counts[d]
        obs_freq = obs_count / n
        exp_freq = BENFORD_EXPECTED[d]
        observed_freq_array.append(obs_freq)
        expected_freq_array.append(exp_freq)
        digit_frequencies.append(
            BenfordDigitFrequency(
                digit=d,
                observed_count=obs_count,
                observed_frequency=obs_freq,
                expected_frequency=exp_freq,
                deviation=obs_freq - exp_freq,
            )
        )

    # Chi-squared test: compare observed counts to expected counts
    # Expected counts = n * expected_probability
    expected_counts = [BENFORD_EXPECTED[d] * n for d in range(1, 10)]
    chi2_stat, p_val = stats.chisquare(
        f_obs=[observed_counts[d] for d in range(1, 10)],
        f_exp=expected_counts,
    )

    is_anomaly = p_val < threshold
    if p_val < 0.001:
        status = "fail"
    elif p_val < threshold:
        status = "warn"
    else:
        status = "pass"

    logger.info(
        "benford_test_complete",
        org_id=org_id,
        n=n,
        chi2=round(float(chi2_stat), 4),
        p_value=round(float(p_val), 6),
        is_anomaly=is_anomaly,
    )

    return BenfordResult(
        org_id=org_id,
        value_count=n,
        digit_frequencies=digit_frequencies,
        chi_squared=float(chi2_stat),
        p_value=float(p_val),
        is_anomaly=is_anomaly,
        status=status,
    )


# ---------------------------------------------------------------------------
# Async Supabase-backed entry point
# ---------------------------------------------------------------------------


async def analyze_benford(
    org_id: str,
    db_client: Any,
) -> BenfordResult:
    """Fetch all financial figures for an organisation and run Benford analysis.

    Collects every non-null numeric value from every financial filing for the
    organisation (across all fiscal years) and passes them to run_benford_test().

    Args:
        org_id: UUID of the organisation to analyse.
        db_client: Authenticated Supabase Client instance (service role).

    Returns:
        BenfordResult containing chi-squared, p-value, and per-digit breakdown.
    """
    log = logger.bind(org_id=org_id)
    log.info("analyze_benford_start")

    try:
        resp = (
            db_client.table("financial_filings")
            .select(",".join(_FINANCIAL_COLUMNS))
            .eq("organization_id", org_id)
            .execute()
        )
        filings: list[dict[str, Any]] = resp.data or []
    except Exception as exc:
        log.error("analyze_benford_fetch_failed", error=str(exc))
        return BenfordResult(org_id=org_id, value_count=0, status="insufficient_data")

    if not filings:
        log.info("analyze_benford_no_filings")
        return BenfordResult(org_id=org_id, value_count=0, status="insufficient_data")

    # Flatten all numeric values across all filings and all financial columns
    all_values: list[float | None] = []
    for filing in filings:
        for col in _FINANCIAL_COLUMNS:
            raw = filing.get(col)
            if raw is not None:
                try:
                    all_values.append(float(raw))
                except (TypeError, ValueError):
                    pass

    log.info("analyze_benford_values_collected", count=len(all_values))
    return run_benford_test(all_values, org_id=org_id)
