/**
 * PostGIS-backed spatial query builders for the `organizations` table.
 *
 * Drizzle ORM does not have native PostGIS support, so all spatial operations
 * use the `sql` tagged template literal to emit raw SQL fragments.  The rest
 * of the query is still typed and assembled with Drizzle's builder.
 */
import type { Database } from '../client';
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
export declare function getMarkers(db: Database, params: GetMarkersParams): Promise<OrgMarker[]>;
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
export declare function getMarkersInBounds(db: Database, params: GetMarkersInBoundsParams): Promise<OrgMarker[]>;
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
export declare function getClusteredMarkers(db: Database, params: GetClusteredMarkersParams): Promise<ClusteredMarker[]>;
//# sourceMappingURL=geo.d.ts.map