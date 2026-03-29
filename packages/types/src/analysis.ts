/**
 * Analysis types — based on `anomaly_alerts`, `organization_scores`,
 * and `entity_matches` tables.
 * These are the outputs of the Sentinel ML/analysis engine.
 */

// ==========================================
// ANOMALY ALERTS
// ==========================================

/**
 * Exact set of alert types checked in the DB constraint.
 */
export type AlertType =
  | 'overhead_manipulation'
  | 'related_party'
  | 'compensation_outlier'
  | 'revenue_expense_mismatch'
  | 'benford_violation'
  | 'network_anomaly'
  | 'filing_inconsistency'
  | 'geographic_discrepancy'
  | 'zero_fundraising'
  | 'rapid_growth'
  | 'shell_indicator'
  | 'other';

/**
 * Severity levels ordered from least to most urgent.
 */
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Structured evidence attached to an anomaly alert.
 * The exact shape varies by alertType; `unknown` allows extension
 * without breaking the contract. Callers should use type guards.
 */
export type AlertEvidence = Record<string, unknown>;

export interface AnomalyAlert {
  id: string; // UUID
  organizationId: string; // UUID — references organizations.id
  fiscalYear?: number | null;

  alertType: AlertType;
  severity: AnomalySeverity;
  confidence: number; // 0–1 probability score from the ML model

  title: string;
  description: string; // Plain-language explanation for non-technical users
  evidence: AlertEvidence; // Structured evidence JSONB
  methodology: string; // Which algorithm / model version generated this

  isReviewed: boolean;
  reviewedBy?: string | null; // UUID of the reviewer (user_profiles.id)
  reviewNotes?: string | null;

  createdAt: string; // ISO 8601 datetime
}

export interface AnomalyAlertInsert {
  organizationId: string;
  fiscalYear?: number | null;
  alertType: AlertType;
  severity: AnomalySeverity;
  confidence: number;
  title: string;
  description: string;
  evidence?: AlertEvidence;
  methodology: string;
  isReviewed?: boolean;
  reviewedBy?: string | null;
  reviewNotes?: string | null;
}

// ==========================================
// ORGANIZATION SCORES
// ==========================================

/**
 * Flexible JSONB breakdown of how each sub-score was computed.
 * The exact keys evolve as the scoring methodology changes;
 * `methodologyVersion` tracks breaking changes.
 */
export type ScoreBreakdown = Record<string, unknown>;

export interface OrganizationScore {
  id: string; // UUID
  organizationId: string; // UUID — references organizations.id
  fiscalYear: number;

  // Composite scores (0–100)
  overallScore?: number | null;
  financialHealthScore?: number | null;
  transparencyScore?: number | null;
  governanceScore?: number | null;
  efficiencyScore?: number | null;

  scoreBreakdown: ScoreBreakdown; // JSONB — flexible as methodology evolves
  methodologyVersion: string; // e.g. 'v1', 'v1.2'

  createdAt: string; // ISO 8601 datetime
}

export interface OrganizationScoreInsert {
  organizationId: string;
  fiscalYear: number;
  overallScore?: number | null;
  financialHealthScore?: number | null;
  transparencyScore?: number | null;
  governanceScore?: number | null;
  efficiencyScore?: number | null;
  scoreBreakdown?: ScoreBreakdown;
  methodologyVersion?: string;
}

// ==========================================
// ENTITY RESOLUTION
// ==========================================

export type MatchType = 'confirmed' | 'probable' | 'possible';

export interface EntityMatch {
  id: string; // UUID

  // The two organizations being compared (order is canonical: orgAId < orgBId by UUID)
  orgAId: string; // UUID — references organizations.id
  orgBId: string; // UUID — references organizations.id

  matchProbability: number; // 0–1 Splink probability
  matchType?: MatchType | null;
  matchedFields?: string[] | null; // Which fields contributed to the match

  reviewed: boolean;
  createdAt: string; // ISO 8601 datetime
}

export interface EntityMatchInsert {
  orgAId: string;
  orgBId: string;
  matchProbability: number;
  matchType?: MatchType | null;
  matchedFields?: string[] | null;
  reviewed?: boolean;
}

// ==========================================
// BENFORD'S LAW ANALYSIS RESULT
// (returned by the ML API, not stored as a table row)
// ==========================================

export interface BenfordDigitFrequency {
  digit: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  observed: number; // Observed frequency (0–1)
  expected: number; // Benford expected frequency (0–1)
  deviation: number; // |observed - expected|
}

export interface BenfordAnalysisResult {
  organizationId: string;
  fiscalYear: number;
  chiSquareStat: number;
  pValue: number;
  isSignificant: boolean; // p < 0.05
  digitFrequencies: BenfordDigitFrequency[];
  analyzedAt: string; // ISO 8601 datetime
}
