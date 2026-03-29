/**
 * Barrel re-export for all query builders.
 *
 * Import individual functions:
 *   import { searchOrganizations, getOrganizationBySlug } from '@opengive/db/queries';
 *
 * Or import the whole namespace via the db package root:
 *   import { queries } from '@opengive/db';
 *   await queries.searchOrganizations(db, { query: 'red cross' });
 */

export {
  // Cursor helpers
  encodeCursor,
  decodeCursor,
  // Organization queries
  searchOrganizations,
  getOrganizationBySlug,
  getOrganizationById,
  listOrganizations,
} from './organizations';

export type {
  DecodedCursor,
  OrganizationRow,
  PaginatedResult,
  SearchOrganizationsParams,
  ListOrganizationsParams,
} from './organizations';

export {
  // Filing-specific cursor helpers
  encodeFilingCursor,
  decodeFilingCursor,
  // Financial filing queries
  getFilings,
  getLatestFiling,
  getFilingsByYear,
} from './financials';

export type {
  FinancialFilingRow,
  PaginatedFilings,
  GetFilingsParams,
} from './financials';

export {
  // Grant-specific cursor helpers
  encodeGrantCursor,
  decodeGrantCursor,
  // Flow / grant queries
  getGrantsByFunder,
  getGrantsByRecipient,
  getFlowData,
  getSankeyData,
  getFlowsByCountry,
} from './flows';

export type {
  GrantRow,
  PaginatedGrants,
  GetGrantsByFunderParams,
  GetGrantsByRecipientParams,
  GetFlowDataParams,
  SankeyNode,
  SankeyLink,
  SankeyData,
  GetSankeyDataParams,
  CountryFlowRow,
  GetFlowsByCountryParams,
} from './flows';

export {
  // Geospatial queries
  getMarkers,
  getMarkersInBounds,
  getClusteredMarkers,
} from './geo';

export type {
  OrgMarker,
  ClusteredMarker,
  BoundingBox,
  GetMarkersParams,
  GetMarkersInBoundsParams,
  GetClusteredMarkersParams,
} from './geo';

export {
  // Stats / aggregation queries
  getGlobalStats,
  getRecentActivity,
  getTopAlerts,
} from './stats';

export type {
  GlobalStats,
  RecentActivityItem,
  PaginatedRecentActivity,
  GetRecentActivityParams,
  TopAlertItem,
} from './stats';

export {
  // Alert-specific cursor helpers
  encodeAlertCursor,
  decodeAlertCursor,
  // Analysis queries
  getAnomalyAlerts,
  getOrganizationScore,
  getEntityMatches,
} from './analysis';

export type {
  AnomalyAlertRow,
  OrganizationScoreRow,
  EntityMatchRow,
  PaginatedAlerts,
  GetAnomalyAlertsParams,
} from './analysis';
