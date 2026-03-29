/**
 * Flow types — based on the `grants` table.
 * Represents money movement between organizations (grants, donations, aid flows).
 * All monetary amounts are `number`. All date fields are ISO 8601 strings.
 */

export type GrantType =
  | 'general_support'
  | 'project'
  | 'capital'
  | 'endowment'
  | 'emergency'
  | 'capacity_building'
  | 'technical_assistance'
  | 'other';

export interface Grant {
  id: string; // UUID

  // Parties — funderOrgId is null when funder isn't in our DB
  funderOrgId?: string | null; // UUID — references organizations.id
  recipientOrgId?: string | null; // UUID — references organizations.id
  recipientName?: string | null; // When recipient isn't in our DB
  recipientCountry?: string | null; // ISO 3166-1 alpha-2

  // Amount
  amount: number; // As filed in original currency
  currency: string; // ISO 4217 currency code, default 'USD'
  amountUsd?: number | null; // Normalized to USD

  // Period and purpose
  grantDate?: string | null; // ISO 8601 date
  fiscalYear?: number | null;
  purpose?: string | null;
  programArea?: string | null;
  grantType?: GrantType | null;

  // Provenance
  source: string; // e.g. 'irs_990_schedule_i', '360giving', 'iati'
  sourceId?: string | null; // ID within source dataset

  // Timestamps
  createdAt: string; // ISO 8601 datetime
}

/**
 * Fields required when inserting a new grant record.
 * Omits server-generated fields: id, createdAt.
 * The DB has a UNIQUE constraint on (source, sourceId).
 */
export interface GrantInsert {
  funderOrgId?: string | null;
  recipientOrgId?: string | null;
  recipientName?: string | null;
  recipientCountry?: string | null;
  amount: number;
  currency?: string;
  amountUsd?: number | null;
  grantDate?: string | null;
  fiscalYear?: number | null;
  purpose?: string | null;
  programArea?: string | null;
  grantType?: GrantType | null;
  source: string;
  sourceId?: string | null;
}

/**
 * Aggregated flow data for Sankey diagram rendering.
 * Source and target are either organization IDs or country codes.
 */
export interface FlowNode {
  id: string; // org UUID or ISO country code
  name: string;
  type: 'organization' | 'country';
  totalIn: number; // Total USD received
  totalOut: number; // Total USD given
}

export interface FlowLink {
  sourceId: string;
  targetId: string;
  amount: number; // USD
  grantCount: number;
  year?: number | null;
}

export interface FlowData {
  nodes: FlowNode[];
  links: FlowLink[];
  currency: 'USD'; // Always USD for normalized flows
  generatedAt: string; // ISO 8601 datetime
}

/**
 * Country-pair aggregate — used in the by-country flows endpoint.
 */
export interface CountryFlowAggregate {
  fromCountry: string; // ISO 3166-1 alpha-2
  toCountry: string; // ISO 3166-1 alpha-2
  totalAmountUsd: number;
  grantCount: number;
  year?: number | null;
}
