/**
 * Drizzle ORM schema — mirrors SQL migrations 00001 through 00006 exactly.
 * All table and column names use snake_case to match the database.
 * JS property names use camelCase via the column-name parameter.
 *
 * Unsupported PostGIS / pgvector / tsvector types are declared with
 * `customType` so that Drizzle can carry them through select types
 * while the actual column definitions live in the SQL migrations.
 */
import { pgTable, uuid, text, boolean, integer, real, numeric, date, timestamp, jsonb, index, uniqueIndex, customType, } from 'drizzle-orm/pg-core';
// ---------------------------------------------------------------------------
// Custom column types for extensions not natively supported by Drizzle
// ---------------------------------------------------------------------------
/**
 * PostGIS GEOGRAPHY(POINT, 4326) — used for spatial indexing and proximity
 * queries. Drizzle does not ship a PostGIS dialect, so we declare this as an
 * opaque `unknown` at the TypeScript level. Callers that need to work with
 * geographic coordinates should use raw SQL via `sql` tagged templates.
 */
const geography = customType({
    dataType() {
        return 'geography(point,4326)';
    },
});
/**
 * pgvector VECTOR(1536) — 1536-dimension float array for OpenAI embeddings.
 * Represented as `number[]` in TypeScript; serialised as a Postgres vector
 * literal (e.g. `[0.1, 0.2, …]`) by the driver.
 */
const vector1536 = customType({
    dataType() {
        return 'vector(1536)';
    },
    fromDriver(value) {
        // Postgres vector literals arrive as "[0.1,0.2,...]"
        return value
            .replace(/^\[|\]$/g, '')
            .split(',')
            .map(Number);
    },
    toDriver(value) {
        return `[${value.join(',')}]`;
    },
});
/**
 * TSVECTOR — generated full-text search column. Declared as read-only;
 * Postgres computes the value via a GENERATED ALWAYS AS expression defined
 * in migration 00001. TypeScript sees it as an opaque `unknown`.
 */
const tsvector = customType({
    dataType() {
        return 'tsvector';
    },
});
// ---------------------------------------------------------------------------
// Table: organizations (migration 00001)
// ---------------------------------------------------------------------------
export const organizations = pgTable('organizations', {
    id: uuid('id').primaryKey().defaultRandom(),
    // Identity
    name: text('name').notNull(),
    nameLocal: text('name_local'),
    slug: text('slug').unique().notNull(),
    aliases: text('aliases').array().default([]),
    // Classification
    orgType: text('org_type', {
        enum: [
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
        ],
    }).notNull(),
    sector: text('sector'),
    subsector: text('subsector'),
    mission: text('mission'),
    description: text('description'),
    // Registration
    countryCode: text('country_code').notNull(),
    jurisdiction: text('jurisdiction'),
    registrySource: text('registry_source').notNull(),
    registryId: text('registry_id').notNull(),
    registrationDate: date('registration_date'),
    dissolutionDate: date('dissolution_date'),
    status: text('status', {
        enum: ['active', 'inactive', 'dissolved', 'suspended', 'unknown'],
    }).default('active'),
    // Contact & location
    website: text('website'),
    email: text('email'),
    phone: text('phone'),
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    city: text('city'),
    stateProvince: text('state_province'),
    postalCode: text('postal_code'),
    location: geography('location'),
    // Metadata
    logoUrl: text('logo_url'),
    lastFilingDate: date('last_filing_date'),
    dataCompleteness: real('data_completeness').default(0),
    embedding: vector1536('embedding'),
    // Full-text search (GENERATED ALWAYS AS … STORED in migration 00001)
    searchVector: tsvector('search_vector'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
    index('idx_org_country').on(table.countryCode),
    index('idx_org_status').on(table.status),
    index('idx_org_slug').on(table.slug),
    // GIN trigram, PostGIS GIST, ivfflat, and GIN FTS indexes are created by
    // the SQL migrations; Drizzle cannot express these index types natively.
    uniqueIndex('organizations_registry_source_registry_id_key').on(table.registrySource, table.registryId),
]);
// ---------------------------------------------------------------------------
// Table: people (migration 00001)
// ---------------------------------------------------------------------------
export const people = pgTable('people', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    nameNormalized: text('name_normalized').notNull(),
    entityClusterId: uuid('entity_cluster_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// Table: organization_people (migration 00001)
// ---------------------------------------------------------------------------
export const organizationPeople = pgTable('organization_people', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
        onDelete: 'cascade',
    }),
    personId: uuid('person_id').references(() => people.id, {
        onDelete: 'cascade',
    }),
    role: text('role').notNull(),
    title: text('title'),
    compensation: numeric('compensation', { precision: 15, scale: 2 }),
    currency: text('currency').default('USD'),
    startDate: date('start_date'),
    endDate: date('end_date'),
    isCurrent: boolean('is_current').default(true),
    filingYear: integer('filing_year'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
    index('idx_org_people_org_id').on(table.organizationId),
    index('idx_org_people_person_id').on(table.personId),
]);
// ---------------------------------------------------------------------------
// Table: financial_filings (migration 00002)
// ---------------------------------------------------------------------------
export const financialFilings = pgTable('financial_filings', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
        onDelete: 'cascade',
    }),
    // Period
    fiscalYear: integer('fiscal_year').notNull(),
    periodStart: date('period_start'),
    periodEnd: date('period_end'),
    filingType: text('filing_type'),
    // Revenue
    totalRevenue: numeric('total_revenue', { precision: 15, scale: 2 }),
    contributionsGrants: numeric('contributions_grants', {
        precision: 15,
        scale: 2,
    }),
    programServiceRevenue: numeric('program_service_revenue', {
        precision: 15,
        scale: 2,
    }),
    investmentIncome: numeric('investment_income', { precision: 15, scale: 2 }),
    otherRevenue: numeric('other_revenue', { precision: 15, scale: 2 }),
    // Expenses
    totalExpenses: numeric('total_expenses', { precision: 15, scale: 2 }),
    programExpenses: numeric('program_expenses', { precision: 15, scale: 2 }),
    adminExpenses: numeric('admin_expenses', { precision: 15, scale: 2 }),
    fundraisingExpenses: numeric('fundraising_expenses', {
        precision: 15,
        scale: 2,
    }),
    // Balance sheet
    totalAssets: numeric('total_assets', { precision: 15, scale: 2 }),
    totalLiabilities: numeric('total_liabilities', { precision: 15, scale: 2 }),
    netAssets: numeric('net_assets', { precision: 15, scale: 2 }),
    // Computed ratios
    programExpenseRatio: real('program_expense_ratio'),
    adminExpenseRatio: real('admin_expense_ratio'),
    fundraisingEfficiency: real('fundraising_efficiency'),
    workingCapitalRatio: real('working_capital_ratio'),
    // Currency and source
    currency: text('currency').default('USD'),
    currencyOriginal: text('currency_original'),
    exchangeRate: real('exchange_rate'),
    sourceUrl: text('source_url'),
    rawFilingKey: text('raw_filing_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
    index('idx_financials_org_id').on(table.organizationId),
    index('idx_financials_year').on(table.fiscalYear),
    index('idx_financials_filing_type').on(table.filingType),
    uniqueIndex('financial_filings_organization_id_fiscal_year_filing_type_key').on(table.organizationId, table.fiscalYear, table.filingType),
]);
// ---------------------------------------------------------------------------
// Table: grants (migration 00003)
// ---------------------------------------------------------------------------
export const grants = pgTable('grants', {
    id: uuid('id').primaryKey().defaultRandom(),
    funderOrgId: uuid('funder_org_id').references(() => organizations.id),
    recipientOrgId: uuid('recipient_org_id').references(() => organizations.id),
    recipientName: text('recipient_name'),
    recipientCountry: text('recipient_country'),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    currency: text('currency').default('USD'),
    amountUsd: numeric('amount_usd', { precision: 15, scale: 2 }),
    grantDate: date('grant_date'),
    fiscalYear: integer('fiscal_year'),
    purpose: text('purpose'),
    programArea: text('program_area'),
    grantType: text('grant_type'),
    source: text('source').notNull(),
    sourceId: text('source_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
    index('idx_grants_funder').on(table.funderOrgId),
    index('idx_grants_recipient').on(table.recipientOrgId),
    index('idx_grants_year').on(table.fiscalYear),
    index('idx_grants_amount').on(table.amountUsd),
    uniqueIndex('grants_source_source_id_key').on(table.source, table.sourceId),
]);
// ---------------------------------------------------------------------------
// Table: anomaly_alerts (migration 00004)
// ---------------------------------------------------------------------------
export const anomalyAlerts = pgTable('anomaly_alerts', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
        onDelete: 'cascade',
    }),
    fiscalYear: integer('fiscal_year'),
    alertType: text('alert_type', {
        enum: [
            'overhead_manipulation',
            'related_party',
            'compensation_outlier',
            'revenue_expense_mismatch',
            'benford_violation',
            'network_anomaly',
            'filing_inconsistency',
            'geographic_discrepancy',
            'zero_fundraising',
            'rapid_growth',
            'shell_indicator',
            'other',
        ],
    }).notNull(),
    severity: text('severity', {
        enum: ['low', 'medium', 'high', 'critical'],
    }).notNull(),
    confidence: real('confidence').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    evidence: jsonb('evidence').notNull().default({}),
    methodology: text('methodology').notNull(),
    isReviewed: boolean('is_reviewed').default(false),
    reviewedBy: uuid('reviewed_by'),
    reviewNotes: text('review_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
    index('idx_anomaly_org_id').on(table.organizationId),
    index('idx_anomaly_severity').on(table.severity),
    index('idx_anomaly_alert_type').on(table.alertType),
    index('idx_anomaly_year').on(table.fiscalYear),
]);
// ---------------------------------------------------------------------------
// Table: organization_scores (migration 00004)
// ---------------------------------------------------------------------------
export const organizationScores = pgTable('organization_scores', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
        onDelete: 'cascade',
    }),
    fiscalYear: integer('fiscal_year').notNull(),
    overallScore: real('overall_score'),
    financialHealthScore: real('financial_health_score'),
    transparencyScore: real('transparency_score'),
    governanceScore: real('governance_score'),
    efficiencyScore: real('efficiency_score'),
    scoreBreakdown: jsonb('score_breakdown').notNull().default({}),
    methodologyVersion: text('methodology_version').notNull().default('v1'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
    index('idx_scores_org_id').on(table.organizationId),
    index('idx_scores_year').on(table.fiscalYear),
    uniqueIndex('organization_scores_organization_id_fiscal_year_methodology_version_key').on(table.organizationId, table.fiscalYear, table.methodologyVersion),
]);
// ---------------------------------------------------------------------------
// Table: entity_matches (migration 00004)
// ---------------------------------------------------------------------------
export const entityMatches = pgTable('entity_matches', {
    id: uuid('id').primaryKey().defaultRandom(),
    orgAId: uuid('org_a_id').references(() => organizations.id),
    orgBId: uuid('org_b_id').references(() => organizations.id),
    matchProbability: real('match_probability').notNull(),
    matchType: text('match_type'),
    matchedFields: text('matched_fields').array(),
    reviewed: boolean('reviewed').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
    index('idx_entity_matches_org_a').on(table.orgAId),
    index('idx_entity_matches_org_b').on(table.orgBId),
    uniqueIndex('entity_matches_org_a_id_org_b_id_key').on(table.orgAId, table.orgBId),
]);
// ---------------------------------------------------------------------------
// Table: scrape_runs (migration 00004)
// ---------------------------------------------------------------------------
export const scrapeRuns = pgTable('scrape_runs', {
    id: uuid('id').primaryKey().defaultRandom(),
    source: text('source').notNull(),
    spiderName: text('spider_name'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    status: text('status', {
        enum: ['running', 'completed', 'failed', 'cancelled'],
    }).default('running'),
    recordsFound: integer('records_found').default(0),
    recordsNew: integer('records_new').default(0),
    recordsUpdated: integer('records_updated').default(0),
    recordsFailed: integer('records_failed').default(0),
    errorLog: text('error_log'),
    metadata: jsonb('metadata').default({}),
}, (table) => [
    index('idx_scrape_runs_source').on(table.source),
    index('idx_scrape_runs_status').on(table.status),
]);
// ---------------------------------------------------------------------------
// Table: embeddings (migration 00005)
// ---------------------------------------------------------------------------
export const embeddings = pgTable('embeddings', {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    modelName: text('model_name').notNull(),
    modelVersion: text('model_version').notNull().default('v1'),
    dimensions: integer('dimensions').notNull(),
    embedding: vector1536('embedding').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
    // ivfflat ANN index created by migration 00005; Drizzle cannot express it.
    index('idx_embeddings_entity').on(table.entityType, table.entityId),
    uniqueIndex('embeddings_entity_type_entity_id_model_name_model_version_key').on(table.entityType, table.entityId, table.modelName, table.modelVersion),
]);
// ---------------------------------------------------------------------------
// Table: user_profiles (migration 00006)
// ---------------------------------------------------------------------------
export const userProfiles = pgTable('user_profiles', {
    // PK is also an FK to auth.users(id); Drizzle cannot reference auth schema
    // tables directly. The constraint is enforced by the SQL migration.
    id: uuid('id').primaryKey(),
    displayName: text('display_name'),
    role: text('role', { enum: ['viewer', 'analyst', 'admin'] }).default('viewer'),
    preferences: jsonb('preferences').default({}),
    apiKeyHash: text('api_key_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// Table: saved_investigations (migration 00006)
// ---------------------------------------------------------------------------
export const savedInvestigations = pgTable('saved_investigations', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => userProfiles.id, {
        onDelete: 'cascade',
    }),
    title: text('title').notNull(),
    description: text('description'),
    queryState: jsonb('query_state').notNull(),
    organizationIds: uuid('organization_ids').array(),
    isPublic: boolean('is_public').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
    index('idx_saved_investigations_user_id').on(table.userId),
    // Partial index (WHERE is_public = true) is created by the SQL migration.
    // Drizzle supports it but only in newer versions; we declare a plain index
    // here and let the migration own the partial variant.
    index('idx_saved_investigations_public').on(table.isPublic),
]);
//# sourceMappingURL=schema.js.map