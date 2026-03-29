// Pagination
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

// Rate Limiting
export const RATE_LIMIT_ANON = 100; // requests per minute
export const RATE_LIMIT_AUTHENTICATED = 1000;

// API
export const API_VERSION = 'v1';

// Scoring (from PRD section 11)
export const SCORING_WEIGHTS = {
  financialHealth: 0.35,
  transparency: 0.25,
  governance: 0.25,
  efficiency: 0.15,
} as const;

// Anomaly thresholds
export const BENFORD_P_VALUE_THRESHOLD = 0.01;
export const ENTITY_MATCH_CONFIRMED_THRESHOLD = 0.85;
export const ENTITY_MATCH_PROBABLE_THRESHOLD = 0.65;

// Scraping
export const SCRAPE_MIN_DELAY_MS = 2000;

// Feature flags (keys match env vars)
export const FEATURE_FLAGS = [
  'AI_ANALYSIS',
  'INVESTIGATION_WORKBENCH',
  'PUBLIC_API',
] as const;
