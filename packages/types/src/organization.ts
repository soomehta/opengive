/**
 * Organization — the central entity in OpenGive.
 * Matches the `organizations` table in packages/db.
 * All date fields are ISO 8601 strings. Money fields are `number`.
 * camelCase here; the DB uses snake_case.
 */

export type OrgType =
  | 'charity'
  | 'foundation'
  | 'ngo'
  | 'nonprofit'
  | 'association'
  | 'trust'
  | 'cooperative'
  | 'social_enterprise'
  | 'religious'
  | 'other';

export type OrgStatus =
  | 'active'
  | 'inactive'
  | 'dissolved'
  | 'suspended'
  | 'unknown';

export interface OrganizationLocation {
  lat: number;
  lng: number;
}

export interface Organization {
  id: string; // UUID
  // Identity
  name: string;
  nameLocal?: string | null;
  slug: string;
  aliases: string[];
  // Classification
  orgType: OrgType;
  sector?: string | null;
  subsector?: string | null;
  mission?: string | null;
  description?: string | null;
  // Registration
  countryCode: string; // ISO 3166-1 alpha-2
  jurisdiction?: string | null;
  registrySource: string; // e.g. 'us_irs', 'uk_charity_commission'
  registryId: string; // EIN, charity number, etc.
  registrationDate?: string | null; // ISO 8601 date
  dissolutionDate?: string | null; // ISO 8601 date
  status: OrgStatus;
  // Contact & location
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  location?: OrganizationLocation | null; // Derived from PostGIS GEOGRAPHY(POINT)
  // Metadata
  logoUrl?: string | null;
  lastFilingDate?: string | null; // ISO 8601 date
  dataCompleteness: number; // 0–1 score of how complete our data is
  // Timestamps
  createdAt: string; // ISO 8601 datetime
  updatedAt: string; // ISO 8601 datetime
}

/**
 * Fields required when inserting a new organization.
 * Omits server-generated fields: id, createdAt, updatedAt.
 * dataCompleteness defaults to 0 on the DB but must be explicitly provided here.
 */
export interface OrganizationInsert {
  name: string;
  nameLocal?: string | null;
  slug: string;
  aliases?: string[];
  orgType: OrgType;
  sector?: string | null;
  subsector?: string | null;
  mission?: string | null;
  description?: string | null;
  countryCode: string;
  jurisdiction?: string | null;
  registrySource: string;
  registryId: string;
  registrationDate?: string | null;
  dissolutionDate?: string | null;
  status?: OrgStatus;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  location?: OrganizationLocation | null;
  logoUrl?: string | null;
  lastFilingDate?: string | null;
  dataCompleteness?: number;
}

/**
 * All fields are optional for partial updates.
 * id, createdAt, updatedAt are never updatable by callers.
 */
export interface OrganizationUpdate {
  name?: string;
  nameLocal?: string | null;
  slug?: string;
  aliases?: string[];
  orgType?: OrgType;
  sector?: string | null;
  subsector?: string | null;
  mission?: string | null;
  description?: string | null;
  countryCode?: string;
  jurisdiction?: string | null;
  registrySource?: string;
  registryId?: string;
  registrationDate?: string | null;
  dissolutionDate?: string | null;
  status?: OrgStatus;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  location?: OrganizationLocation | null;
  logoUrl?: string | null;
  lastFilingDate?: string | null;
  dataCompleteness?: number;
}

/**
 * Lightweight summary used in search results and list views.
 */
export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  orgType: OrgType;
  sector?: string | null;
  countryCode: string;
  city?: string | null;
  status: OrgStatus;
  logoUrl?: string | null;
  dataCompleteness: number;
}

/**
 * Person associated with an organization (director, trustee, officer, etc.).
 */
export interface Person {
  id: string;
  name: string;
  nameNormalized: string;
  entityClusterId?: string | null; // Links resolved duplicates (Splink output)
  createdAt: string;
  updatedAt: string;
}

export type OrganizationPersonRole =
  | 'director'
  | 'trustee'
  | 'officer'
  | 'ceo'
  | 'cfo'
  | 'chair'
  | 'secretary'
  | 'treasurer'
  | string; // Open string for roles not yet enumerated

export interface OrganizationPerson {
  id: string;
  organizationId: string;
  personId: string;
  role: OrganizationPersonRole;
  title?: string | null;
  compensation?: number | null;
  currency?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent: boolean;
  filingYear?: number | null;
  createdAt: string;
}
