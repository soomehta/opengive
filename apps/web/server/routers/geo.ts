/**
 * tRPC router — geo (geospatial organization markers)
 *
 * Exposes:
 *   geo.getMarkers           — all orgs with a known location
 *   geo.getMarkersInBounds   — orgs within a map bounding box
 *   geo.getClusteredMarkers  — spatially clustered markers for a given zoom level
 *
 * All PostGIS queries delegate to @opengive/db/queries which uses Drizzle's
 * `sql` tagged template for raw spatial SQL.
 */

import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import {
  getMarkers,
  getMarkersInBounds,
  getClusteredMarkers,
} from '@opengive/db/queries';

// ---------------------------------------------------------------------------
// Shared input schemas
// ---------------------------------------------------------------------------

const orgStatusSchema = z.enum([
  'active',
  'inactive',
  'dissolved',
  'suspended',
  'unknown',
]);

const orgTypeSchema = z.enum([
  'charity',
  'foundation',
  'ngo',
  'nonprofit',
  'association',
  'trust',
  'cooperative',
  'social_enterprise',
  'religious',
  'other',
]);

const boundsSchema = z.object({
  minLat: z.number().min(-90).max(90),
  minLng: z.number().min(-180).max(180),
  maxLat: z.number().min(-90).max(90),
  maxLng: z.number().min(-180).max(180),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const geoRouter = router({
  /**
   * Returns all organizations that have a PostGIS `location` value set.
   * Each marker carries `{ id, name, slug, lat, lng, country, orgType }`.
   *
   * Optional equality filters: country (ISO 3166-1 alpha-2), orgType, status.
   * Hard-capped at 2000 rows to protect map rendering performance.
   */
  getMarkers: publicProcedure
    .input(
      z.object({
        country: z.string().length(2).toUpperCase().optional(),
        orgType: orgTypeSchema.optional(),
        status: orgStatusSchema.optional(),
        limit: z.number().int().min(1).max(2000).default(500),
      }),
    )
    .query(async ({ ctx, input }) => {
      const markers = await getMarkers(ctx.db, {
        country: input.country,
        orgType: input.orgType,
        status: input.status,
        limit: input.limit,
      });
      return markers;
    }),

  /**
   * Returns organizations within a geographic bounding box.
   * Uses PostGIS `ST_MakeEnvelope` + `&&` operator (GIST-indexed).
   *
   * Input `bounds` must form a valid south-west / north-east rectangle.
   * For queries that cross the anti-meridian (lng wraps from 180 to -180)
   * callers should split into two requests.
   */
  getMarkersInBounds: publicProcedure
    .input(
      z.object({
        bounds: boundsSchema,
        country: z.string().length(2).toUpperCase().optional(),
        orgType: orgTypeSchema.optional(),
        status: orgStatusSchema.optional(),
        limit: z.number().int().min(1).max(2000).default(500),
      }),
    )
    .query(async ({ ctx, input }) => {
      const markers = await getMarkersInBounds(ctx.db, {
        ...input.bounds,
        country: input.country,
        orgType: input.orgType,
        status: input.status,
        limit: input.limit,
      });
      return markers;
    }),

  /**
   * Returns spatially clustered markers using `ST_ClusterDBSCAN`.
   *
   * Cluster radius (epsilon) is automatically derived from the `zoom` level:
   * lower zoom = larger clusters.  At zoom 0 each cluster covers ~5°;
   * at zoom 15 clusters resolve to individual points (~0.001°).
   *
   * Each row carries:
   *   { lat, lng, count, id?, name?, slug?, country, orgType? }
   *
   * When `count === 1` the marker represents a single org and `id`/`name`/
   * `slug` are populated.  For multi-org clusters these fields are `null`.
   */
  getClusteredMarkers: publicProcedure
    .input(
      z.object({
        zoom: z.number().int().min(0).max(22),
        bounds: boundsSchema.optional(),
        country: z.string().length(2).toUpperCase().optional(),
        orgType: orgTypeSchema.optional(),
        status: orgStatusSchema.optional(),
        limit: z.number().int().min(1).max(1000).default(300),
      }),
    )
    .query(async ({ ctx, input }) => {
      const clusters = await getClusteredMarkers(ctx.db, {
        zoom: input.zoom,
        bounds: input.bounds,
        country: input.country,
        orgType: input.orgType,
        status: input.status,
        limit: input.limit,
      });
      return clusters;
    }),
});

export type GeoRouter = typeof geoRouter;
