/**
 * PostGIS-backed spatial query builders for the `organizations` table.
 *
 * Drizzle ORM does not have native PostGIS support, so all spatial operations
 * use the `sql` tagged template literal to emit raw SQL fragments.  The rest
 * of the query is still typed and assembled with Drizzle's builder.
 */

import { sql, and, eq, type SQL } from 'drizzle-orm';
import { organizations } from '../schema';
import type { Database } from '../client';

// ---------------------------------------------------------------------------
// Shared result types
// ---------------------------------------------------------------------------

export interface OrgMarker {
  id: string;
  name: string;
  slug: string;
  lat: number;
  lng: number;
  country: string;
  orgType: string;
}

export interface ClusteredMarker {
  /** Cluster centroid latitude. */
  lat: number;
  /** Cluster centroid longitude. */
  lng: number;
  /** Number of organizations in this cluster. */
  count: number;
  /**
   * When count === 1 the marker represents a single org — these fields are
   * populated.  For multi-org clusters they are null.
   */
  id: string | null;
  name: string | null;
  slug: string | null;
  country: string;
  orgType: string | null;
}

// ---------------------------------------------------------------------------
// getMarkers
// ---------------------------------------------------------------------------

export interface GetMarkersParams {
  /** ISO 3166-1 alpha-2 country filter. */
  country?: string;
  orgType?: string;
  status?: string;
  /** Maximum number of markers to return. Default 500, max 2000. */
  limit?: number;
}

/**
 * Returns organizations that have a non-null PostGIS `location` column,
 * extracting `lat` and `lng` via ST_Y / ST_X.
 *
 * All spatial extraction is done in Postgres so the driver never has to
 * parse opaque WKB strings.
 */
export async function getMarkers(
  db: Database,
  params: GetMarkersParams,
): Promise<OrgMarker[]> {
  const limit = Math.min(params.limit ?? 500, 2000);

  // Equality filters expressed through Drizzle's typed columns
  const conditions: SQL[] = [
    sql`${organizations.location} IS NOT NULL`,
  ];

  if (params.country) {
    conditions.push(eq(organizations.countryCode, params.country));
  }
  if (params.orgType) {
    conditions.push(
      sql`${organizations.orgType} = ${params.orgType}`,
    );
  }
  if (params.status) {
    conditions.push(
      sql`${organizations.status} = ${params.status}`,
    );
  }

  const whereClause = and(...conditions);

  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      country: organizations.countryCode,
      orgType: organizations.orgType,
      // PostGIS coordinate extraction — returns numeric, cast to float8
      lat: sql<number>`ST_Y(${organizations.location}::geometry)`,
      lng: sql<number>`ST_X(${organizations.location}::geometry)`,
    })
    .from(organizations)
    .where(whereClause)
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    country: r.country,
    orgType: r.orgType,
    lat: Number(r.lat),
    lng: Number(r.lng),
  }));
}

// ---------------------------------------------------------------------------
// getMarkersInBounds
// ---------------------------------------------------------------------------

export interface BoundingBox {
  /** South-west corner latitude (min lat). */
  minLat: number;
  /** South-west corner longitude (min lng). */
  minLng: number;
  /** North-east corner latitude (max lat). */
  maxLat: number;
  /** North-east corner longitude (max lng). */
  maxLng: number;
}

export interface GetMarkersInBoundsParams extends BoundingBox {
  country?: string;
  orgType?: string;
  status?: string;
  limit?: number;
}

/**
 * Returns organizations whose `location` falls within the given bounding box.
 * Uses PostGIS `ST_MakeEnvelope(minLng, minLat, maxLng, maxLat, 4326)` with a
 * `&&` operator (bounding-box overlap with GIST index support).
 */
export async function getMarkersInBounds(
  db: Database,
  params: GetMarkersInBoundsParams,
): Promise<OrgMarker[]> {
  const limit = Math.min(params.limit ?? 500, 2000);

  const conditions: SQL[] = [
    sql`${organizations.location} IS NOT NULL`,
    // ST_MakeEnvelope(xmin, ymin, xmax, ymax, srid)
    // Note: PostGIS uses (lng, lat) = (x, y)
    sql`${organizations.location}::geometry && ST_MakeEnvelope(
      ${params.minLng},
      ${params.minLat},
      ${params.maxLng},
      ${params.maxLat},
      4326
    )`,
  ];

  if (params.country) {
    conditions.push(eq(organizations.countryCode, params.country));
  }
  if (params.orgType) {
    conditions.push(sql`${organizations.orgType} = ${params.orgType}`);
  }
  if (params.status) {
    conditions.push(sql`${organizations.status} = ${params.status}`);
  }

  const whereClause = and(...conditions);

  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      country: organizations.countryCode,
      orgType: organizations.orgType,
      lat: sql<number>`ST_Y(${organizations.location}::geometry)`,
      lng: sql<number>`ST_X(${organizations.location}::geometry)`,
    })
    .from(organizations)
    .where(whereClause)
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    country: r.country,
    orgType: r.orgType,
    lat: Number(r.lat),
    lng: Number(r.lng),
  }));
}

// ---------------------------------------------------------------------------
// getClusteredMarkers
// ---------------------------------------------------------------------------

export interface GetClusteredMarkersParams {
  /** Map zoom level (0–22). Lower zoom = coarser clusters. */
  zoom: number;
  /** Optional bounding box to restrict clustering. */
  bounds?: BoundingBox;
  country?: string;
  orgType?: string;
  status?: string;
  /** Maximum number of cluster rows returned. Default 300, max 1000. */
  limit?: number;
}

/**
 * Clusters organization markers using `ST_ClusterDBSCAN`.
 *
 * The epsilon (cluster radius in degrees) is derived from the zoom level so
 * that clusters become finer as the user zooms in.  At zoom 0 the epsilon is
 * ~5°; at zoom 15 it is ~0.001°.  The formula mirrors common web-map cluster
 * libraries.
 *
 * For each cluster the centroid is computed with `ST_Centroid(ST_Collect(...))`.
 * Single-point clusters (count = 1) expose the underlying org's id/name/slug.
 */
export async function getClusteredMarkers(
  db: Database,
  params: GetClusteredMarkersParams,
): Promise<ClusteredMarker[]> {
  const limit = Math.min(params.limit ?? 300, 1000);

  // Epsilon decreases exponentially with zoom level
  const epsilon = 5 / Math.pow(2, Math.max(0, params.zoom));
  const minPoints = 1; // Every point belongs to some cluster

  // Build optional filters for the inner query
  const innerConditions: SQL[] = [
    sql`location IS NOT NULL`,
  ];

  if (params.bounds) {
    innerConditions.push(
      sql`location::geometry && ST_MakeEnvelope(
        ${params.bounds.minLng},
        ${params.bounds.minLat},
        ${params.bounds.maxLng},
        ${params.bounds.maxLat},
        4326
      )`,
    );
  }
  if (params.country) {
    innerConditions.push(sql`country_code = ${params.country}`);
  }
  if (params.orgType) {
    innerConditions.push(sql`org_type = ${params.orgType}`);
  }
  if (params.status) {
    innerConditions.push(sql`status = ${params.status}`);
  }

  const innerWhere =
    innerConditions.length > 0
      ? sql`WHERE ${sql.join(innerConditions, sql` AND `)}`
      : sql``;

  // ST_ClusterDBSCAN assigns a cluster ID per row; we then group by that ID.
  const rows = await db.execute<{
    lat: string;
    lng: string;
    count: string;
    id: string | null;
    name: string | null;
    slug: string | null;
    country: string;
    org_type: string | null;
  }>(
    sql`
      WITH clustered AS (
        SELECT
          id,
          name,
          slug,
          country_code,
          org_type,
          location::geometry AS geom,
          ST_ClusterDBSCAN(location::geometry, eps := ${epsilon}, minpoints := ${minPoints})
            OVER () AS cluster_id
        FROM organizations
        ${innerWhere}
      )
      SELECT
        ST_Y(ST_Centroid(ST_Collect(geom)))::text  AS lat,
        ST_X(ST_Centroid(ST_Collect(geom)))::text  AS lng,
        COUNT(*)::text                              AS count,
        -- For single-point clusters expose org details
        CASE WHEN COUNT(*) = 1 THEN MIN(id::text)  ELSE NULL END AS id,
        CASE WHEN COUNT(*) = 1 THEN MIN(name)       ELSE NULL END AS name,
        CASE WHEN COUNT(*) = 1 THEN MIN(slug)       ELSE NULL END AS slug,
        MIN(country_code)                           AS country,
        CASE WHEN COUNT(*) = 1 THEN MIN(org_type)   ELSE NULL END AS org_type
      FROM clustered
      GROUP BY cluster_id
      ORDER BY COUNT(*) DESC
      LIMIT ${limit}
    `,
  );

  return rows.map((r) => ({
    lat: Number(r.lat),
    lng: Number(r.lng),
    count: Number(r.count),
    id: r.id ?? null,
    name: r.name ?? null,
    slug: r.slug ?? null,
    country: r.country,
    orgType: r.org_type ?? null,
  }));
}
