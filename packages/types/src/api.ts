/**
 * API types — request/response envelopes, error shapes, and query params.
 * These are shared between the tRPC internal API and the Hono public REST API.
 *
 * Error format (from CLAUDE.md + PRD §9):
 *   { error: { code: string, message: string, details?: unknown } }
 *
 * Pagination: cursor-based (never offset).
 * Public API versioned at /v1/.
 */

// ==========================================
// RESPONSE ENVELOPE
// ==========================================

export interface ApiMeta {
  cursor?: string | null; // Opaque cursor for next page
  total?: number | null; // Total count when available (may be expensive)
  page?: number | null; // Page number (for non-cursor endpoints)
}

export interface ApiResponse<T> {
  data: T;
  meta?: ApiMeta;
}

// ==========================================
// ERROR FORMAT
// ==========================================

export interface ApiErrorDetail {
  code: string; // Machine-readable error code, e.g. 'NOT_FOUND', 'RATE_LIMITED'
  message: string; // Human-readable message
  details?: unknown; // Optional structured context (field errors, etc.)
}

export interface ApiError {
  error: ApiErrorDetail;
}

// ==========================================
// PAGINATION
// ==========================================

export interface PaginationParams {
  cursor?: string; // Opaque cursor from previous response
  limit: number; // 1–100, default 25
}

// ==========================================
// SEARCH PARAMS
// ==========================================

export interface SearchParams {
  query: string; // Full-text search query
  country?: string; // ISO 3166-1 alpha-2 filter
  sector?: string; // NTEE / ICNPO sector filter
  status?: string; // OrgStatus filter
}

/**
 * Extended search params used by the tRPC organizations.search procedure.
 */
export interface OrganizationSearchParams extends PaginationParams {
  query?: string;
  country?: string;
  sector?: string;
  status?: string;
}

/**
 * Grant flow query params used by the tRPC flows.getGrantFlows procedure.
 */
export interface FlowQueryParams {
  orgId?: string; // UUID — filter to a specific organization
  country?: string; // ISO 3166-1 alpha-2
  year?: number;
  minAmount?: number; // Minimum USD amount
}

/**
 * Anomaly feed query params.
 */
export interface AnomalyFeedParams extends PaginationParams {
  severity?: string; // AnomalySeverity filter
  type?: string; // AlertType filter
}

// ==========================================
// USER / AUTH
// ==========================================

export type UserRole = 'viewer' | 'analyst' | 'admin';

export interface UserProfile {
  id: string; // UUID — matches auth.users(id)
  displayName?: string | null;
  role: UserRole;
  preferences: Record<string, unknown>; // JSONB
  createdAt: string; // ISO 8601 datetime
  updatedAt: string; // ISO 8601 datetime
}

// ==========================================
// SAVED INVESTIGATIONS
// ==========================================

export interface SavedInvestigation {
  id: string; // UUID
  userId: string; // UUID
  title: string;
  description?: string | null;
  queryState: Record<string, unknown>; // Serialized investigation state (JSONB)
  organizationIds: string[]; // UUID[] — organizations in scope
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SavedInvestigationInsert {
  title: string;
  description?: string | null;
  queryState: Record<string, unknown>;
  organizationIds?: string[];
  isPublic?: boolean;
}

// ==========================================
// EXPORT
// ==========================================

export type ExportFormat = 'csv' | 'json';

export interface ExportParams {
  format: ExportFormat;
  entity: 'organizations' | 'financials' | 'grants' | 'alerts';
  filters?: Record<string, unknown>;
}
