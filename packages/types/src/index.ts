/**
 * @opengive/types — shared TypeScript types for the OpenGive monorepo.
 *
 * These types are the contract between agents/services. All changes must be
 * backward-compatible or coordinated across agents (see PRD §6).
 *
 * Named exports only — no default exports.
 */

export type {
  OrgType,
  OrgStatus,
  OrganizationLocation,
  Organization,
  OrganizationInsert,
  OrganizationUpdate,
  OrganizationSummary,
  Person,
  OrganizationPersonRole,
  OrganizationPerson,
} from './organization.js';

export type {
  FilingType,
  FinancialFiling,
  FinancialFilingInsert,
  FinancialRatios,
  FinancialTimeSeries,
} from './financial.js';

export type {
  GrantType,
  Grant,
  GrantInsert,
  FlowNode,
  FlowLink,
  FlowData,
  CountryFlowAggregate,
} from './flow.js';

export type {
  AlertType,
  AnomalySeverity,
  AlertEvidence,
  AnomalyAlert,
  AnomalyAlertInsert,
  ScoreBreakdown,
  OrganizationScore,
  OrganizationScoreInsert,
  MatchType,
  EntityMatch,
  EntityMatchInsert,
  BenfordDigitFrequency,
  BenfordAnalysisResult,
} from './analysis.js';

export type {
  RegistryApiType,
  RegistryFormat,
  RegistryUpdateFrequency,
  RegistrySource,
  ScrapeRunStatus,
  ScrapeRun,
  ScrapeRunInsert,
  RegistryStatus,
} from './registry.js';

export type {
  ApiMeta,
  ApiResponse,
  ApiErrorDetail,
  ApiError,
  PaginationParams,
  SearchParams,
  OrganizationSearchParams,
  FlowQueryParams,
  AnomalyFeedParams,
  UserRole,
  UserProfile,
  SavedInvestigation,
  SavedInvestigationInsert,
  ExportFormat,
  ExportParams,
} from './api.js';
