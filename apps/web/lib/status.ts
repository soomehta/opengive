/**
 * Status normalisation utilities.
 *
 * The database schema uses a richer set of status values than the UI
 * (e.g. 'dissolved', 'suspended') that need to be mapped to the smaller
 * set the OrgDetail interface understands.
 *
 * Keep this file free of any server-only or client-only imports so it
 * can be used in both Server Components and Client Components.
 */

/** The status values understood by the OrgDetail UI interface. */
export type NormalizedOrgStatus = 'active' | 'inactive' | 'revoked' | 'pending';

/**
 * Maps a raw database `status` value to one of the four UI-level statuses.
 *
 * Mapping:
 *   'active'                 → 'active'
 *   'inactive'               → 'inactive'
 *   'dissolved' | 'suspended'→ 'revoked'
 *   null | unknown values    → 'pending'
 */
export function normalizeOrgStatus(
  dbStatus: string | null | undefined,
): NormalizedOrgStatus {
  switch (dbStatus) {
    case 'active':
      return 'active';
    case 'inactive':
      return 'inactive';
    case 'dissolved':
    case 'suspended':
      return 'revoked';
    default:
      return 'pending';
  }
}
