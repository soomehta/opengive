/**
 * Financial types — based on the `financial_filings` table.
 * All monetary amounts are `number` (stored as NUMERIC(15,2) in DB).
 * All date fields are ISO 8601 strings. Ratios are 0–1 floats.
 */

export type FilingType =
  | '990'
  | '990-EZ'
  | '990-PF'
  | '990-N'
  | 'annual_return'
  | 'abbreviated_accounts'
  | 'full_accounts'
  | 'other';

export interface FinancialFiling {
  id: string; // UUID
  organizationId: string; // UUID — references organizations.id

  // Period
  fiscalYear: number;
  periodStart?: string | null; // ISO 8601 date
  periodEnd?: string | null; // ISO 8601 date
  filingType?: FilingType | null;

  // Revenue
  totalRevenue?: number | null;
  contributionsGrants?: number | null;
  programServiceRevenue?: number | null;
  investmentIncome?: number | null;
  otherRevenue?: number | null;

  // Expenses
  totalExpenses?: number | null;
  programExpenses?: number | null;
  adminExpenses?: number | null;
  fundraisingExpenses?: number | null;

  // Balance sheet
  totalAssets?: number | null;
  totalLiabilities?: number | null;
  netAssets?: number | null;

  // Computed ratios (denormalized for query performance)
  programExpenseRatio?: number | null; // programExpenses / totalExpenses
  adminExpenseRatio?: number | null; // adminExpenses / totalExpenses
  fundraisingEfficiency?: number | null; // fundraisingExpenses / contributionsGrants
  workingCapitalRatio?: number | null;

  // Currency and provenance
  currency: string; // ISO 4217 currency code, default 'USD'
  currencyOriginal?: string | null; // Original filing currency before conversion
  exchangeRate?: number | null; // Rate used to convert to USD
  sourceUrl?: string | null; // Link to original filing
  rawFilingKey?: string | null; // Supabase Storage key for raw filing

  // Timestamps
  createdAt: string; // ISO 8601 datetime
  updatedAt: string; // ISO 8601 datetime
}

/**
 * Fields required when inserting a new financial filing.
 * Omits server-generated fields: id, createdAt, updatedAt.
 * The DB has a UNIQUE constraint on (organizationId, fiscalYear, filingType).
 */
export interface FinancialFilingInsert {
  organizationId: string;
  fiscalYear: number;
  periodStart?: string | null;
  periodEnd?: string | null;
  filingType?: FilingType | null;
  totalRevenue?: number | null;
  contributionsGrants?: number | null;
  programServiceRevenue?: number | null;
  investmentIncome?: number | null;
  otherRevenue?: number | null;
  totalExpenses?: number | null;
  programExpenses?: number | null;
  adminExpenses?: number | null;
  fundraisingExpenses?: number | null;
  totalAssets?: number | null;
  totalLiabilities?: number | null;
  netAssets?: number | null;
  programExpenseRatio?: number | null;
  adminExpenseRatio?: number | null;
  fundraisingEfficiency?: number | null;
  workingCapitalRatio?: number | null;
  currency?: string;
  currencyOriginal?: string | null;
  exchangeRate?: number | null;
  sourceUrl?: string | null;
  rawFilingKey?: string | null;
}

/**
 * Computed financial ratios extracted for display and analysis.
 * These are derived from a FinancialFiling and are never stored independently.
 */
export interface FinancialRatios {
  programExpenseRatio: number | null; // 0–1: share of expenses going to programs
  adminExpenseRatio: number | null; // 0–1: share of expenses going to admin
  fundraisingEfficiency: number | null; // cost per dollar raised
  workingCapitalRatio: number | null; // liquidity indicator
  revenueGrowthRate: number | null; // YoY revenue growth (requires two years)
  surplusMargin: number | null; // (totalRevenue - totalExpenses) / totalRevenue
}

/**
 * Aggregated financial summary across multiple years, used in charts.
 */
export interface FinancialTimeSeries {
  organizationId: string;
  years: number[];
  totalRevenue: Array<number | null>;
  totalExpenses: Array<number | null>;
  netAssets: Array<number | null>;
  programExpenseRatio: Array<number | null>;
}
