export interface FinancialData {
  totalRevenue: number;
  totalExpenses: number;
  programExpenses: number;
  adminExpenses: number;
  fundraisingExpenses: number;
  contributionsGrants: number;
  totalAssets: number;
  totalLiabilities: number;
  netAssets: number;
}

export interface ComputedRatios {
  /** program expenses / total expenses */
  programExpenseRatio: number | null;
  /** admin expenses / total expenses */
  adminExpenseRatio: number | null;
  /** fundraising expenses / contributions and grants */
  fundraisingEfficiency: number | null;
  /** net assets / (total expenses / 12) — months of operating reserves */
  workingCapitalRatio: number | null;
  /** percentage change from previous year; requires prior-year revenue */
  revenueGrowthRate: number | null;
}

/**
 * Compute standard financial ratios from a single year of financial data.
 * All division-by-zero cases return null rather than Infinity or NaN.
 */
export function computeRatios(data: FinancialData): ComputedRatios {
  const programExpenseRatio =
    data.totalExpenses !== 0
      ? data.programExpenses / data.totalExpenses
      : null;

  const adminExpenseRatio =
    data.totalExpenses !== 0
      ? data.adminExpenses / data.totalExpenses
      : null;

  const fundraisingEfficiency =
    data.contributionsGrants !== 0
      ? data.fundraisingExpenses / data.contributionsGrants
      : null;

  // Net assets divided by average monthly expenses gives months of reserve.
  // Total expenses / 12 = monthly run rate.
  const monthlyExpenses = data.totalExpenses / 12;
  const workingCapitalRatio =
    monthlyExpenses !== 0 ? data.netAssets / monthlyExpenses : null;

  return {
    programExpenseRatio,
    adminExpenseRatio,
    fundraisingEfficiency,
    workingCapitalRatio,
    revenueGrowthRate: null, // requires prior-year data; use computeRevenueGrowth
  };
}

/**
 * Compute year-over-year revenue growth rate as a decimal (e.g. 0.05 = 5%).
 * Returns null when the previous year revenue is zero (undefined growth).
 */
export function computeRevenueGrowth(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}
