// ---------------------------------------------------------------------------
// Pillar weights — sum to 1.0
// ---------------------------------------------------------------------------
const WEIGHTS = {
  financialHealth: 0.35,
  transparency: 0.25,
  governance: 0.25,
  efficiency: 0.15,
} as const;

// ---------------------------------------------------------------------------
// Scoring thresholds (from PRD section 11)
// ---------------------------------------------------------------------------

/** Clamp a number to [0, 1]. */
function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Scale a clamped [0, 1] fraction to a 0–100 score. */
function toScore(fraction: number): number {
  return Math.round(clamp01(fraction) * 100);
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ScoringInput {
  // --- Financial Health ---
  /** 3-year compound revenue growth rate (decimal, e.g. 0.05 = 5%). */
  revenueGrowth3Year: number | null;
  /** Net assets divided by monthly operating expenses (months of reserves). */
  workingCapitalRatio: number | null;
  /**
   * Herfindahl–Hirschman Index of revenue sources (0–1).
   * Lower = more diversified.  1.0 = single source.
   */
  revenueDiversificationIndex: number | null;
  /** Months of cash reserves (net assets / monthly expenses). */
  cashReserveMonths: number | null;

  // --- Transparency ---
  /** Fraction of expected filing fields that are populated (0–1). */
  filingCompleteness: number;
  /** Days between fiscal year-end and filing date.  Null if unknown. */
  filingTimelinessDays: number | null;
  /** Whether an independent CPA audit was performed. */
  hasIndependentAudit: boolean;
  /** How many fiscal years of data are available. */
  yearsOfData: number;

  // --- Governance ---
  /** Number of board members.  Null if unknown. */
  boardSize: number | null;
  /** Fraction of board members who are non-compensated (0–1). */
  boardIndependenceRatio: number | null;
  /** Whether named officers with titles are disclosed. */
  hasNamedOfficers: boolean;
  /** Whether a conflict-of-interest policy is disclosed on the filing. */
  hasConflictOfInterestPolicy: boolean;

  // --- Efficiency ---
  /** Program expenses / total expenses (0–1). */
  programExpenseRatio: number | null;
  /** Fundraising expenses / contributions and grants (decimal). */
  fundraisingEfficiency: number | null;
  /** Admin expenses / total expenses (0–1). */
  adminExpenseRatio: number | null;
  /**
   * Joint costs as a fraction of total expenses (0–1).
   * Joint costs are fundraising activities that are partly educational;
   * values above 0.20 are penalised.
   */
  jointCostRatio: number | null;
}

export interface ScoreResult {
  /** Composite score (0–100). */
  overall: number;
  financialHealth: number;
  transparency: number;
  governance: number;
  efficiency: number;
  /** Per-component raw scores keyed by component name. */
  breakdown: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Financial Health sub-scores
// ---------------------------------------------------------------------------

/**
 * Revenue trend score.
 * 3-year CAGR ≥ 5%  → 100
 * 0% to 5%          → scaled 50–100
 * -20% to 0%        → scaled 0–50
 * ≤ -20%            → 0
 * Null (unknown)    → 50 (neutral)
 */
function scoreRevenueTrend(growth: number | null): number {
  if (growth === null) return 50;
  if (growth >= 0.05) return 100;
  if (growth >= 0) return toScore(0.5 + (growth / 0.05) * 0.5);
  if (growth >= -0.2) return toScore(0.5 + (growth / 0.2) * 0.5); // 0.5 → 0
  return 0;
}

/**
 * Working capital (reserve months) score.
 * ≥ 6 months   → 100
 * 3–6 months   → scaled 50–100
 * 0–3 months   → scaled 0–50
 * < 0          → 0 (liabilities exceed assets)
 * Null         → 50
 */
function scoreWorkingCapital(months: number | null): number {
  if (months === null) return 50;
  if (months >= 6) return 100;
  if (months >= 3) return toScore(0.5 + ((months - 3) / 3) * 0.5);
  if (months >= 0) return toScore((months / 3) * 0.5);
  return 0;
}

/**
 * Diversification score based on Herfindahl index.
 * HHI = 0   (perfectly diversified) → 100
 * HHI = 0.5 → 50
 * HHI = 1   (single source)         → 0
 * Null                              → 50
 */
function scoreRevenueDiversification(hhi: number | null): number {
  if (hhi === null) return 50;
  return toScore(1 - clamp01(hhi));
}

/**
 * Cash-reserve score (same thresholds as working capital since both express
 * months of runway — either can be used depending on what the caller provides).
 * Exposed separately so callers can supply cashReserveMonths independently.
 */
function scoreCashReserve(months: number | null): number {
  return scoreWorkingCapital(months);
}

function computeFinancialHealth(input: ScoringInput): {
  score: number;
  breakdown: Record<string, number>;
} {
  const revenueTrend = scoreRevenueTrend(input.revenueGrowth3Year);
  const workingCapital = scoreWorkingCapital(input.workingCapitalRatio);
  const diversification = scoreRevenueDiversification(
    input.revenueDiversificationIndex,
  );
  const cashReserve = scoreCashReserve(input.cashReserveMonths);

  // Equal weight among the four components (0.25 each).
  const score = Math.round(
    (revenueTrend + workingCapital + diversification + cashReserve) / 4,
  );

  return {
    score,
    breakdown: {
      revenueTrend,
      workingCapital,
      diversification,
      cashReserve,
    },
  };
}

// ---------------------------------------------------------------------------
// Transparency sub-scores
// ---------------------------------------------------------------------------

/**
 * Timeliness score.
 * ≤ 90 days after FY-end  → 100
 * 90–180 days             → scaled 50–100
 * 180–365 days            → scaled 0–50
 * > 365 days              → 0
 * Null (unknown)          → 50
 */
function scoreFilingTimeliness(days: number | null): number {
  if (days === null) return 50;
  if (days <= 90) return 100;
  if (days <= 180) return toScore(0.5 + ((180 - days) / 90) * 0.5);
  if (days <= 365) return toScore(((365 - days) / 185) * 0.5);
  return 0;
}

/**
 * Years-of-data score.
 * ≥ 5 years → 100
 * 1–4 years → scaled proportionally
 */
function scoreYearsOfData(years: number): number {
  return toScore(years / 5);
}

function computeTransparency(input: ScoringInput): {
  score: number;
  breakdown: Record<string, number>;
} {
  const completeness = toScore(input.filingCompleteness);
  const timeliness = scoreFilingTimeliness(input.filingTimelinessDays);
  const auditScore = input.hasIndependentAudit ? 100 : 0;
  const dataAvailability = scoreYearsOfData(input.yearsOfData);

  // Equal weight among the four components (0.25 each).
  const score = Math.round(
    (completeness + timeliness + auditScore + dataAvailability) / 4,
  );

  return {
    score,
    breakdown: {
      filingCompleteness: completeness,
      filingTimeliness: timeliness,
      auditStatus: auditScore,
      dataAvailability,
    },
  };
}

// ---------------------------------------------------------------------------
// Governance sub-scores
// ---------------------------------------------------------------------------

/**
 * Board size score.
 * Optimal range: 5–25 members.
 * < 3 or > 35 → 0
 * 3–5         → scaled 0–100 (approaching optimal)
 * 5–25        → 100
 * 25–35       → scaled 100–0 (too large)
 * Null        → 50
 */
function scoreBoardSize(size: number | null): number {
  if (size === null) return 50;
  if (size < 3 || size > 35) return 0;
  if (size >= 5 && size <= 25) return 100;
  if (size < 5) return toScore((size - 3) / 2); // 3→0, 5→100
  return toScore((35 - size) / 10); // 25→100, 35→0
}

function computeGovernance(input: ScoringInput): {
  score: number;
  breakdown: Record<string, number>;
} {
  const boardSizeScore = scoreBoardSize(input.boardSize);
  const boardIndependenceScore =
    input.boardIndependenceRatio !== null
      ? toScore(input.boardIndependenceRatio)
      : 50;
  const officerDisclosureScore = input.hasNamedOfficers ? 100 : 0;
  const conflictPolicyScore = input.hasConflictOfInterestPolicy ? 100 : 0;

  // Equal weight among the four components (0.25 each).
  const score = Math.round(
    (boardSizeScore +
      boardIndependenceScore +
      officerDisclosureScore +
      conflictPolicyScore) /
      4,
  );

  return {
    score,
    breakdown: {
      boardSize: boardSizeScore,
      boardIndependence: boardIndependenceScore,
      officerDisclosure: officerDisclosureScore,
      conflictOfInterestPolicy: conflictPolicyScore,
    },
  };
}

// ---------------------------------------------------------------------------
// Efficiency sub-scores
// ---------------------------------------------------------------------------

/**
 * Program expense ratio score.
 * ≥ 0.75 → 100
 * 0.50–0.75 → scaled 0–100
 * < 0.50 → 0
 * Null → 50
 */
function scoreProgramRatio(ratio: number | null): number {
  if (ratio === null) return 50;
  if (ratio >= 0.75) return 100;
  if (ratio >= 0.5) return toScore((ratio - 0.5) / 0.25);
  return 0;
}

/**
 * Fundraising efficiency score (cost per $1 raised — lower is better).
 * ≤ $0.10 per $1 → 100
 * $0.10–$0.25   → scaled 50–100
 * $0.25–$0.50   → scaled 0–50
 * > $0.50       → 0
 * Null          → 50
 */
function scoreFundraisingEfficiency(costPerDollar: number | null): number {
  if (costPerDollar === null) return 50;
  if (costPerDollar <= 0.1) return 100;
  if (costPerDollar <= 0.25)
    return toScore(0.5 + ((0.25 - costPerDollar) / 0.15) * 0.5);
  if (costPerDollar <= 0.5)
    return toScore(((0.5 - costPerDollar) / 0.25) * 0.5);
  return 0;
}

/**
 * Admin expense ratio score (lower is better).
 * ≤ 0.10 → 100
 * 0.10–0.15 → scaled 50–100
 * 0.15–0.30 → scaled 0–50
 * > 0.30 → 0
 * Null → 50
 */
function scoreAdminRatio(ratio: number | null): number {
  if (ratio === null) return 50;
  if (ratio <= 0.1) return 100;
  if (ratio <= 0.15) return toScore(0.5 + ((0.15 - ratio) / 0.05) * 0.5);
  if (ratio <= 0.3) return toScore(((0.3 - ratio) / 0.15) * 0.5);
  return 0;
}

/**
 * Joint-cost ratio score.
 * ≤ 0.10 → 100
 * 0.10–0.20 → scaled 50–100
 * 0.20–0.40 → scaled 0–50
 * > 0.40 → 0
 * Null → 100 (benefit of the doubt — most orgs have no joint costs)
 */
function scoreJointCostRatio(ratio: number | null): number {
  if (ratio === null) return 100;
  if (ratio <= 0.1) return 100;
  if (ratio <= 0.2) return toScore(0.5 + ((0.2 - ratio) / 0.1) * 0.5);
  if (ratio <= 0.4) return toScore(((0.4 - ratio) / 0.2) * 0.5);
  return 0;
}

function computeEfficiency(input: ScoringInput): {
  score: number;
  breakdown: Record<string, number>;
} {
  const programRatio = scoreProgramRatio(input.programExpenseRatio);
  const fundraisingScore = scoreFundraisingEfficiency(
    input.fundraisingEfficiency,
  );
  const adminRatio = scoreAdminRatio(input.adminExpenseRatio);
  const jointCost = scoreJointCostRatio(input.jointCostRatio);

  // Equal weight among the four components (0.25 each).
  const score = Math.round(
    (programRatio + fundraisingScore + adminRatio + jointCost) / 4,
  );

  return {
    score,
    breakdown: {
      programExpenseRatio: programRatio,
      fundraisingEfficiency: fundraisingScore,
      adminExpenseRatio: adminRatio,
      jointCostRatio: jointCost,
    },
  };
}

// ---------------------------------------------------------------------------
// Public composite scorer
// ---------------------------------------------------------------------------

/**
 * Compute the OpenGive Transparency Score (v1) for an organisation.
 *
 * Overall = 0.35 × FinancialHealth + 0.25 × Transparency
 *         + 0.25 × Governance      + 0.15 × Efficiency
 */
export function computeScore(input: ScoringInput): ScoreResult {
  const fh = computeFinancialHealth(input);
  const tr = computeTransparency(input);
  const gv = computeGovernance(input);
  const ef = computeEfficiency(input);

  const overall = Math.round(
    fh.score * WEIGHTS.financialHealth +
      tr.score * WEIGHTS.transparency +
      gv.score * WEIGHTS.governance +
      ef.score * WEIGHTS.efficiency,
  );

  return {
    overall,
    financialHealth: fh.score,
    transparency: tr.score,
    governance: gv.score,
    efficiency: ef.score,
    breakdown: {
      ...prefixKeys("financialHealth", fh.breakdown),
      ...prefixKeys("transparency", tr.breakdown),
      ...prefixKeys("governance", gv.breakdown),
      ...prefixKeys("efficiency", ef.breakdown),
    },
  };
}

/** Prefix all keys of a record with `prefix.`. */
function prefixKeys(
  prefix: string,
  record: Record<string, number>,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(record)) {
    result[`${prefix}.${k}`] = v;
  }
  return result;
}
