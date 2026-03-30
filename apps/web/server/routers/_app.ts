/**
 * Root tRPC router — merges all sub-routers into the AppRouter.
 *
 * Sub-routers:
 *   organizations  — search, get, financials, alerts, entity matches, people
 *   financials     — filings list, latest filing, computed ratios
 *   flows          — grant flows by funder/recipient + Sankey data + country aggregation
 *   analysis       — anomaly alerts feed, scores, entity resolution matches
 *   geo            — geospatial organization markers (PostGIS-backed)
 *   stats          — Command Center aggregations (global stats, activity, top alerts)
 *   investigations — saved investigations (protected)
 *   bookmarks      — user bookmarks with notes (protected)
 *   watchlist      — user watchlist with watch types (protected)
 *   settings       — user profile and API key management (protected)
 */

import { router } from '../trpc';
import { organizationRouter } from './organizations';
import { financialsRouter } from './financials';
import { flowsRouter } from './flows';
import { analysisRouter } from './analysis';
import { geoRouter } from './geo';
import { statsRouter } from './stats';
import { investigationsRouter } from './investigations';
import { bookmarksRouter } from './bookmarks';
import { watchlistRouter } from './watchlist';
import { settingsRouter } from './settings';

export const appRouter = router({
  organizations: organizationRouter,
  financials: financialsRouter,
  flows: flowsRouter,
  analysis: analysisRouter,
  geo: geoRouter,
  stats: statsRouter,
  investigations: investigationsRouter,
  bookmarks: bookmarksRouter,
  watchlist: watchlistRouter,
  settings: settingsRouter,
});

/**
 * The exported type is used by:
 *   - @trpc/client on the frontend  (apps/web/lib/trpc.ts)
 *   - The Hono public API adapter    (apps/api/)
 *   - Any server-side caller         (apps/web/app/**)
 */
export type AppRouter = typeof appRouter;
