/**
 * Registry types — data source registry definitions and scrape run tracking.
 * Based on the `scrape_runs` table and the registry configuration in packages/config.
 */

// ==========================================
// REGISTRY SOURCE DEFINITION
// ==========================================

export type RegistryApiType =
  | 'rest'
  | 's3_bulk'
  | 'ckan'
  | 'solr'
  | 'sdmx'
  | 'graphql'
  | 'scrape_scrapy'
  | 'scrape_playwright'
  | 'bulk_download'
  | 'other';

export type RegistryFormat =
  | 'json'
  | 'xml'
  | 'csv'
  | 'parquet'
  | 'excel'
  | 'pdf'
  | 'html'
  | 'other';

export type RegistryUpdateFrequency =
  | 'real_time'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'bi_annual'
  | 'quarterly'
  | 'annual'
  | 'irregular';

export interface RegistrySource {
  id: string; // e.g. 'us_irs', 'uk_charity_commission', 'iati'
  name: string; // Human-readable name
  countryCode: string; // ISO 3166-1 alpha-2, or 'INTL' for international sources
  organizationCount?: number | null; // Approximate number of organizations covered
  apiType: RegistryApiType;
  format: RegistryFormat;
  updateFrequency: RegistryUpdateFrequency;
  requiresAuth: boolean;
  baseUrl?: string | null;
  documentationUrl?: string | null;
  isEnabled: boolean; // Feature-flag controlled
  phase: 1 | 2 | 3; // Which build phase this source is ingested in
}

// ==========================================
// SCRAPE RUN TRACKING
// ==========================================

export type ScrapeRunStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ScrapeRun {
  id: string; // UUID
  source: string; // References RegistrySource.id
  spiderName?: string | null; // Scrapy spider or Dagster asset name

  startedAt: string; // ISO 8601 datetime
  completedAt?: string | null; // ISO 8601 datetime

  status: ScrapeRunStatus;

  recordsFound: number; // Total records encountered
  recordsNew: number; // Net-new records inserted
  recordsUpdated: number; // Existing records updated (change detected)
  recordsFailed: number; // Records that failed validation or insert

  errorLog?: string | null; // Truncated error output for failed runs
  metadata: Record<string, unknown>; // JSONB — source-specific metadata
}

export interface ScrapeRunInsert {
  source: string;
  spiderName?: string | null;
  status?: ScrapeRunStatus;
  recordsFound?: number;
  recordsNew?: number;
  recordsUpdated?: number;
  recordsFailed?: number;
  errorLog?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Data freshness status for a single registry source.
 * Derived from the most recent ScrapeRun for that source.
 */
export interface RegistryStatus {
  source: string; // RegistrySource.id
  lastSuccessfulRun?: string | null; // ISO 8601 datetime
  lastAttemptedRun?: string | null; // ISO 8601 datetime
  status: ScrapeRunStatus | 'never_run';
  recordsTotal?: number | null;
  staleDays?: number | null; // How many days since last successful sync
}
