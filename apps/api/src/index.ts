// @ts-nocheck — Hono OpenAPI handler type inference struggles with multi-status route responses.
// All routes are validated at runtime via Zod schemas; the TS errors are false positives.
/**
 * OpenGive public REST API — Hono application entry point.
 *
 * All routes are versioned under `/v1/`.  OpenAPI documentation is served at
 * `/v1/openapi.json`.  Rate limiting is applied globally via the sliding-window
 * in-memory middleware (see middleware/rate-limit.ts).
 *
 * Endpoints:
 *   GET  /health
 *
 *   Organizations
 *   GET  /v1/organizations
 *   GET  /v1/organizations/:slug
 *   GET  /v1/organizations/:slug/financials
 *   GET  /v1/organizations/:slug/grants
 *   GET  /v1/organizations/:slug/people
 *   GET  /v1/organizations/:slug/alerts
 *   GET  /v1/organizations/:slug/score
 *
 *   Flows
 *   GET  /v1/flows
 *   GET  /v1/flows/by-country
 *
 *   Alerts
 *   GET  /v1/alerts
 *   GET  /v1/alerts/stats
 *
 *   Search
 *   GET  /v1/search
 *
 *   Registries
 *   GET  /v1/registries
 *   GET  /v1/registries/:source/status
 *
 *   Export
 *   GET  /v1/export/:format
 *
 *   API Keys (authenticated)
 *   POST /v1/api-keys
 *
 *   Spec
 *   GET  /v1/openapi.json
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { eq, sql } from 'drizzle-orm';
import { createDb } from '@opengive/db/client';
import { userProfiles } from '@opengive/db';
import {
  searchOrganizations,
  getOrganizationBySlug,
  getFilingsByYear,
  getGrantsByFunder,
  getGrantsByRecipient,
  getSankeyData,
  getFlowsByCountry,
  getAnomalyAlerts,
  getOrganizationScore,
  getGlobalStats,
} from '@opengive/db/queries';
import { REGISTRIES } from '@opengive/config/registries';
import { rateLimitMiddleware } from './middleware/rate-limit';
import {
  requireApiKey,
  generateApiKey,
  sha256Hex,
  type ApiUser,
} from './middleware/api-keys';

// ---------------------------------------------------------------------------
// App initialisation
// ---------------------------------------------------------------------------

// Extend Hono's variable map so c.var.apiUser is typed correctly
type AppVariables = { apiUser?: ApiUser };

const app = new OpenAPIHono<{ Variables: AppVariables }>();

// CORS — allow all origins for public API read access.
app.use(
  '*',
  cors({
    origin: (origin) => {
      const allowed = process.env['ALLOWED_ORIGINS'];
      if (!allowed) return null; // Deny cross-origin if ALLOWED_ORIGINS not configured
      return allowed.split(',').includes(origin ?? '') ? origin : null;
    },
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
    exposeHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After',
      'Content-Disposition',
    ],
  }),
);

// Rate limiting applied after CORS so pre-flight OPTIONS bypass it
app.use('/v1/*', rateLimitMiddleware());

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

const ErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

const PaginationMeta = z.object({
  nextCursor: z.string().nullable(),
});

// Reusable slug path parameter
const SlugParam = z.object({
  slug: z.string().min(1).openapi({ description: 'Organization slug', example: 'red-cross-us' }),
});

// Reusable pagination query parameters
const PaginationQuery = z.object({
  cursor: z.string().optional().openapi({ description: 'Pagination cursor from previous response' }),
  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? Math.min(Math.max(1, parseInt(v, 10) || 25), 100) : 25))
    .openapi({ description: 'Page size (1–100, default 25)', example: '25' }),
});

// ---------------------------------------------------------------------------
// Shared DB helper
// ---------------------------------------------------------------------------

function getDb() {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL environment variable is not set');
  return createDb(url);
}

// ---------------------------------------------------------------------------
// Shared error response helper
// ---------------------------------------------------------------------------

function internalError(err: unknown) {
  const isDev = process.env.NODE_ENV === 'development';
  if (err instanceof Error) {
    console.error('[API Error]', err.message, err.stack);
  }
  return {
    error: {
      code: 'INTERNAL_ERROR' as const,
      message: isDev && err instanceof Error ? err.message : 'An unexpected error occurred',
    },
  };
}

function notFoundError(entity: string, identifier: string) {
  return {
    error: {
      code: 'NOT_FOUND' as const,
      message: `${entity} "${identifier}" not found`,
    },
  };
}

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ===========================================================================
// ORGANIZATIONS
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /v1/organizations
// ---------------------------------------------------------------------------

const listOrgsRoute = createRoute({
  method: 'get',
  path: '/v1/organizations',
  tags: ['Organizations'],
  summary: 'List or search organizations',
  description:
    'Returns a paginated list of organizations. Supports full-text search via `query` and optional equality filters. Uses cursor-based pagination.',
  request: {
    query: z.object({
      query: z.string().optional().openapi({ description: 'Full-text search query', example: 'red cross' }),
      country: z.string().length(2).optional().openapi({ description: 'ISO 3166-1 alpha-2 country code', example: 'US' }),
      sector: z.string().optional().openapi({ description: 'Sector filter', example: 'health' }),
      status: z
        .enum(['active', 'inactive', 'dissolved', 'suspended', 'unknown'])
        .optional()
        .openapi({ description: 'Registration status filter' }),
      cursor: z.string().optional().openapi({ description: 'Pagination cursor from previous response' }),
      limit: z
        .string()
        .optional()
        .transform((v) => (v !== undefined ? Math.min(Math.max(1, parseInt(v, 10) || 25), 100) : 25))
        .openapi({ description: 'Page size (1–100, default 25)', example: '25' }),
    }),
  },
  responses: {
    200: {
      description: 'Paginated list of organizations',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(
              z.object({
                id: z.string().uuid(),
                name: z.string(),
                slug: z.string(),
                orgType: z.string(),
                countryCode: z.string(),
                sector: z.string().nullable(),
                status: z.string().nullable(),
                website: z.string().nullable(),
                dataCompleteness: z.number().nullable(),
              }),
            ),
            meta: PaginationMeta,
          }),
        },
      },
    },
    429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: ErrorSchema } } },
    500: { description: 'Internal server error', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

app.openapi(listOrgsRoute, async (c) => {
  try {
    const { query, country, sector, status, cursor, limit } = c.req.valid('query');
    const db = getDb();
    const result = await searchOrganizations(db, { query, country, sector, status, cursor: cursor ?? null, limit });
    const data = result.items.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      orgType: org.orgType,
      countryCode: org.countryCode,
      sector: org.sector ?? null,
      status: org.status ?? null,
      website: org.website ?? null,
      dataCompleteness: org.dataCompleteness ?? null,
    }));
    return c.json({ data, meta: { nextCursor: result.nextCursor } }, 200);
  } catch (err) {
    return c.json(internalError(err), 500);
  }
});

// ---------------------------------------------------------------------------
// GET /v1/organizations/:slug
// ---------------------------------------------------------------------------

const getOrgBySlugRoute = createRoute({
  method: 'get',
  path: '/v1/organizations/{slug}',
  tags: ['Organizations'],
  summary: 'Get organization by slug',
  description: 'Returns a single organization identified by its human-readable slug.',
  request: { params: SlugParam },
  responses: {
    200: {
      description: 'Organization detail',
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({
              id: z.string().uuid(),
              name: z.string(),
              slug: z.string(),
              orgType: z.string(),
              countryCode: z.string(),
              sector: z.string().nullable(),
              subsector: z.string().nullable(),
              mission: z.string().nullable(),
              description: z.string().nullable(),
              status: z.string().nullable(),
              website: z.string().nullable(),
              city: z.string().nullable(),
              stateProvince: z.string().nullable(),
              registrationDate: z.string().nullable(),
              lastFilingDate: z.string().nullable(),
              dataCompleteness: z.number().nullable(),
            }),
          }),
        },
      },
    },
    404: { description: 'Organization not found', content: { 'application/json': { schema: ErrorSchema } } },
    429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: ErrorSchema } } },
    500: { description: 'Internal server error', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

app.openapi(getOrgBySlugRoute, async (c) => {
  try {
    const { slug } = c.req.valid('param');
    const db = getDb();
    const org = await getOrganizationBySlug(db, slug);
    if (!org) return c.json(notFoundError('Organization with slug', slug), 404);
    return c.json(
      {
        data: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          orgType: org.orgType,
          countryCode: org.countryCode,
          sector: org.sector ?? null,
          subsector: org.subsector ?? null,
          mission: org.mission ?? null,
          description: org.description ?? null,
          status: org.status ?? null,
          website: org.website ?? null,
          city: org.city ?? null,
          stateProvince: org.stateProvince ?? null,
          registrationDate: org.registrationDate ?? null,
          lastFilingDate: org.lastFilingDate ?? null,
          dataCompleteness: org.dataCompleteness ?? null,
        },
      },
      200,
    );
  } catch (err) {
    return c.json(internalError(err), 500);
  }
});

// ---------------------------------------------------------------------------
// GET /v1/organizations/:slug/financials
// ---------------------------------------------------------------------------

const getOrgFinancialsRoute = createRoute({
  method: 'get',
  path: '/v1/organizations/{slug}/financials',
  tags: ['Organizations', 'Financials'],
  summary: 'Get financial history for an organization',
  description:
    'Returns up to `years` most recent annual financial filings for an organization, ordered chronologically (oldest first).',
  request: {
    params: SlugParam,
    query: z.object({
      years: z
        .string()
        .optional()
        .transform((v) => (v !== undefined ? Math.min(Math.max(1, parseInt(v, 10) || 5), 20) : 5))
        .openapi({ description: 'Number of years to return (1–20, default 5)', example: '5' }),
    }),
  },
  responses: {
    200: {
      description: 'Financial filing history',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(
              z.object({
                id: z.string().uuid(),
                fiscalYear: z.number().int(),
                periodStart: z.string().nullable(),
                periodEnd: z.string().nullable(),
                totalRevenue: z.string().nullable(),
                totalExpenses: z.string().nullable(),
                totalAssets: z.string().nullable(),
                netAssets: z.string().nullable(),
                programExpenseRatio: z.number().nullable(),
                adminExpenseRatio: z.number().nullable(),
                fundraisingEfficiency: z.number().nullable(),
                currency: z.string().nullable(),
              }),
            ),
          }),
        },
      },
    },
    404: { description: 'Organization not found', content: { 'application/json': { schema: ErrorSchema } } },
    429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: ErrorSchema } } },
    500: { description: 'Internal server error', content: { 'application/json': { schema: ErrorSchema } } },
  },
});


app.openapi(getOrgFinancialsRoute, async (c) => {
  try {
    const { slug } = c.req.valid('param');
    const { years } = c.req.valid('query');
    const db = getDb();
    const org = await getOrganizationBySlug(db, slug);
    if (!org) return c.json(notFoundError('Organization with slug', slug), 404);
    const filings = await getFilingsByYear(db, org.id, years);
    const data = filings.map((f: Record<string, unknown>) => ({
      id: f['id'],
      fiscalYear: f['fiscalYear'],
      periodStart: f['periodStart'] ?? null,
      periodEnd: f['periodEnd'] ?? null,
      totalRevenue: f['totalRevenue'] ?? null,
      totalExpenses: f['totalExpenses'] ?? null,
      totalAssets: f['totalAssets'] ?? null,
      netAssets: f['netAssets'] ?? null,
      programExpenseRatio: f['programExpenseRatio'] ?? null,
      adminExpenseRatio: f['adminExpenseRatio'] ?? null,
      fundraisingEfficiency: f['fundraisingEfficiency'] ?? null,
      currency: f['currency'] ?? null,
    }));
    return c.json({ data }, 200);
  } catch (err) {
    return c.json(internalError(err), 500);
  }
});

// ---------------------------------------------------------------------------
// GET /v1/organizations/:slug/grants
// ---------------------------------------------------------------------------

const getOrgGrantsRoute = createRoute({
  method: 'get',
  path: '/v1/organizations/{slug}/grants',
  tags: ['Organizations', 'Grants'],
  summary: 'Get grants given or received by an organization',
  description:
    'Returns paginated grants. Use `direction=given` (default) for grants the organization made as funder, ' +
    'or `direction=received` for grants it received as a recipient. Uses cursor-based pagination.',
  request: {
    params: SlugParam,
    query: z.object({
      direction: z
        .enum(['given', 'received'])
        .optional()
        .default('given')
        .openapi({ description: 'Filter direction: grants given as funder or received as recipient', example: 'given' }),
      cursor: z.string().optional().openapi({ description: 'Pagination cursor from previous response' }),
      limit: z
        .string()
        .optional()
        .transform((v) => (v !== undefined ? Math.min(Math.max(1, parseInt(v, 10) || 25), 100) : 25))
        .openapi({ description: 'Page size (1–100, default 25)', example: '25' }),
    }),
  },
  responses: {
    200: {
      description: 'Paginated grant list',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(
              z.object({
                id: z.string().uuid(),
                funderOrgId: z.string().uuid().nullable(),
                recipientOrgId: z.string().uuid().nullable(),
                recipientName: z.string().nullable(),
                recipientCountry: z.string().nullable(),
                amount: z.string(),
                currency: z.string().nullable(),
                amountUsd: z.string().nullable(),
                grantDate: z.string().nullable(),
                fiscalYear: z.number().int().nullable(),
                purpose: z.string().nullable(),
                programArea: z.string().nullable(),
                grantType: z.string().nullable(),
                source: z.string(),
              }),
            ),
            meta: PaginationMeta,
          }),
        },
      },
    },
    404: { description: 'Organization not found', content: { 'application/json': { schema: ErrorSchema } } },
    429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: ErrorSchema } } },
    500: { description: 'Internal server error', content: { 'application/json': { schema: ErrorSchema } } },
  },
});


app.openapi(getOrgGrantsRoute, async (c) => {
  try {
    const { slug } = c.req.valid('param');
    const { direction, cursor, limit } = c.req.valid('query');
    const db = getDb();
    const org = await getOrganizationBySlug(db, slug);
    if (!org) return c.json(notFoundError('Organization with slug', slug), 404);

    const result =
      direction === 'received'
        ? await getGrantsByRecipient(db, { recipientOrgId: org.id, limit, cursor: cursor ?? null })
        : await getGrantsByFunder(db, { funderOrgId: org.id, limit, cursor: cursor ?? null });

    const data = result.items.map((g) => ({
      id: g.id,
      funderOrgId: g.funderOrgId ?? null,
      recipientOrgId: g.recipientOrgId ?? null,
      recipientName: g.recipientName ?? null,
      recipientCountry: g.recipientCountry ?? null,
      amount: g.amount,
      currency: g.currency ?? null,
      amountUsd: g.amountUsd ?? null,
      grantDate: g.grantDate ?? null,
      fiscalYear: g.fiscalYear ?? null,
      purpose: g.purpose ?? null,
      programArea: g.programArea ?? null,
      grantType: g.grantType ?? null,
      source: g.source,
    }));

    return c.json({ data, meta: { nextCursor: result.nextCursor } }, 200);
  } catch (err) {
    return c.json(internalError(err), 500);
  }
});

// ---------------------------------------------------------------------------
// GET /v1/organizations/:slug/people
// ---------------------------------------------------------------------------

const getOrgPeopleRoute = createRoute({
  method: 'get',
  path: '/v1/organizations/{slug}/people',
  tags: ['Organizations', 'People'],
  summary: 'Get officers and directors for an organization',
  description:
    'Returns people associated with an organization (officers, directors, executives). ' +
    'Optional `current` filter restricts to current role-holders only.',
  request: {
    params: SlugParam,
    query: z.object({
      current: z
        .enum(['true', 'false'])
        .optional()
        .openapi({ description: 'When "true", return only current role-holders', example: 'true' }),
      cursor: z.string().optional().openapi({ description: 'Pagination cursor from previous response' }),
      limit: z
        .string()
        .optional()
        .transform((v) => (v !== undefined ? Math.min(Math.max(1, parseInt(v, 10) || 25), 100) : 25))
        .openapi({ description: 'Page size (1–100, default 25)', example: '25' }),
    }),
  },
  responses: {
    200: {
      description: 'Paginated list of people associated with the organization',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(
              z.object({
                id: z.string().uuid(),
                personId: z.string().uuid().nullable(),
                name: z.string(),
                role: z.string(),
                title: z.string().nullable(),
                compensation: z.string().nullable(),
                currency: z.string().nullable(),
                startDate: z.string().nullable(),
                endDate: z.string().nullable(),
                isCurrent: z.boolean().nullable(),
                filingYear: z.number().int().nullable(),
              }),
            ),
            meta: PaginationMeta,
          }),
        },
      },
    },
    404: { description: 'Organization not found', content: { 'application/json': { schema: ErrorSchema } } },
    429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: ErrorSchema } } },
    500: { description: 'Internal server error', content: { 'application/json': { schema: ErrorSchema } } },
  },
});


app.openapi(getOrgPeopleRoute, async (c) => {
  try {
    const { slug } = c.req.valid('param');
    const { current, cursor: rawCursor, limit } = c.req.valid('query');
    const db = getDb();

    const org = await getOrganizationBySlug(db, slug);
    if (!org) return c.json(notFoundError('Organization with slug', slug), 404);

    // Cursor encodes (id) — simple UUID lexicographic ordering for this endpoint
    interface PersonRow {
      id: string;
      personId: string | null;
      name: string;
      role: string;
      title: string | null;
      compensation: string | null;
      currency: string | null;
      startDate: string | null;
      endDate: string | null;
      isCurrent: boolean | null;
      filingYear: number | null;
    }

    const onlyCurrent = current === 'true';

    const rows = await db.execute(
      sql`
        SELECT
          op.id,
          op.person_id            AS "personId",
          p.name,
          op.role,
          op.title,
          op.compensation::text   AS compensation,
          op.currency,
          op.start_date::text     AS "startDate",
          op.end_date::text       AS "endDate",
          op.is_current           AS "isCurrent",
          op.filing_year          AS "filingYear"
        FROM organization_people op
        INNER JOIN people p ON p.id = op.person_id
        WHERE op.organization_id = ${org.id}::uuid
          ${onlyCurrent ? sql`AND op.is_current = TRUE` : sql``}
          ${rawCursor ? sql`AND op.id > ${rawCursor}::uuid` : sql``}
        ORDER BY op.id
        LIMIT ${limit + 1}
      `,
    );

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);
    const nextCursor = hasNextPage && lastItem ? lastItem.id : null;

    return c.json({ data: items, meta: { nextCursor } }, 200);
  } catch (err) {
    return c.json(internalError(err), 500);
  }
});

// ---------------------------------------------------------------------------
// GET /v1/organizations/:slug/alerts
// ---------------------------------------------------------------------------

const getOrgAlertsRoute = createRoute({
  method: 'get',
  path: '/v1/organizations/{slug}/alerts',
  tags: ['Organizations', 'Alerts'],
  summary: 'Get anomaly alerts for an organization',
  description:
    'Returns paginated anomaly alerts detected for this organization by the ML analysis engine. ' +
    'Optionally filter by `severity` (low|medium|high|critical) or `type`.',
  request: {
    params: SlugParam,
    query: z.object({
      severity: z
        .enum(['low', 'medium', 'high', 'critical'])
        .optional()
        .openapi({ description: 'Severity filter', example: 'high' }),
      type: z.string().optional().openapi({ description: 'Alert type filter', example: 'benford_violation' }),
      cursor: z.string().optional().openapi({ description: 'Pagination cursor from previous response' }),
      limit: z
        .string()
        .optional()
        .transform((v) => (v !== undefined ? Math.min(Math.max(1, parseInt(v, 10) || 25), 100) : 25))
        .openapi({ description: 'Page size (1–100, default 25)', example: '25' }),
    }),
  },
  responses: {
    200: {
      description: 'Paginated anomaly alerts',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(
              z.object({
                id: z.string().uuid(),
                alertType: z.string(),
                severity: z.enum(['low', 'medium', 'high', 'critical']),
                confidence: z.number(),
                title: z.string(),
                description: z.string(),
                fiscalYear: z.number().int().nullable(),
                isReviewed: z.boolean(),
                createdAt: z.string(),
              }),
            ),
            meta: PaginationMeta,
          }),
        },
      },
    },
    404: { description: 'Organization not found', content: { 'application/json': { schema: ErrorSchema } } },
    429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: ErrorSchema } } },
    500: { description: 'Internal server error', content: { 'application/json': { schema: ErrorSchema } } },
  },
});


app.openapi(getOrgAlertsRoute, async (c) => {
  try {
    const { slug } = c.req.valid('param');
    const { severity, type, cursor, limit } = c.req.valid('query');
    const db = getDb();

    const org = await getOrganizationBySlug(db, slug);
    if (!org) return c.json(notFoundError('Organization with slug', slug), 404);

    const result = await getAnomalyAlerts(db, {
      organizationId: org.id,
      severity,
      type,
      limit,
      cursor: cursor ?? null,
    });

    const data = result.items.map((a) => ({
      id: a.id,
      alertType: a.alertType,
      severity: a.severity,
      confidence: a.confidence,
      title: a.title,
      description: a.description,
      fiscalYear: a.fiscalYear ?? null,
      isReviewed: a.isReviewed ?? false,
      createdAt: a.createdAt?.toISOString() ?? new Date().toISOString(),
    }));

    return c.json({ data, meta: { nextCursor: result.nextCursor } }, 200);
  } catch (err) {
    return c.json(internalError(err), 500);
  }
});

// ---------------------------------------------------------------------------
// GET /v1/organizations/:slug/score
// ---------------------------------------------------------------------------

const getOrgScoreRoute = createRoute({
  method: 'get',
  path: '/v1/organizations/{slug}/score',
  tags: ['Organizations', 'Scores'],
  summary: 'Get transparency score for an organization',
  description:
    'Returns the most recent (or a specific fiscal year) accountability score record computed by the Sentinel ML engine. ' +
    'Scores range from 0–100 across five dimensions: financial health, transparency, governance, efficiency, and overall.',
  request: {
    params: SlugParam,
    query: z.object({
      year: z
        .string()
        .optional()
        .transform((v) => (v !== undefined ? parseInt(v, 10) : undefined))
        .openapi({ description: 'Fiscal year to retrieve score for (defaults to most recent)', example: '2023' }),
    }),
  },
  responses: {
    200: {
      description: 'Transparency score',
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({
              id: z.string().uuid(),
              fiscalYear: z.number().int(),
              overallScore: z.number().nullable(),
              financialHealthScore: z.number().nullable(),
              transparencyScore: z.number().nullable(),
              governanceScore: z.number().nullable(),
              efficiencyScore: z.number().nullable(),
              methodologyVersion: z.string(),
              computedAt: z.string(),
            }),
          }),
        },
      },
    },
    404: { description: 'Organization or score not found', content: { 'application/json': { schema: ErrorSchema } } },
    429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: ErrorSchema } } },
    500: { description: 'Internal server error', content: { 'application/json': { schema: ErrorSchema } } },
  },
});


app.openapi(getOrgScoreRoute, async (c) => {
  try {
    const { slug } = c.req.valid('param');
    const { year } = c.req.valid('query');
    const db = getDb();

    const org = await getOrganizationBySlug(db, slug);
    if (!org) return c.json(notFoundError('Organization with slug', slug), 404);

    const score = await getOrganizationScore(db, org.id, year);
    if (!score) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: `No score record found for organization "${slug}"` } },
        404,
      );
    }

    return c.json(
      {
        data: {
          id: score.id,
          fiscalYear: score.fiscalYear,
          overallScore: score.overallScore ?? null,
          financialHealthScore: score.financialHealthScore ?? null,
          transparencyScore: score.transparencyScore ?? null,
          governanceScore: score.governanceScore ?? null,
          efficiencyScore: score.efficiencyScore ?? null,
          methodologyVersion: score.methodologyVersion,
          computedAt: score.createdAt?.toISOString() ?? new Date().toISOString(),
        },
      },
      200,
    );
  } catch (err) {
    return c.json(internalError(err), 500);
  }
});

// ===========================================================================
// FLOWS
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /v1/flows
// ---------------------------------------------------------------------------

const getFlowsRoute = createRoute({
  method: 'get',
  path: '/v1/flows',
  tags: ['Flows'],
  summary: 'Get grant flow data for Sankey diagrams',
  description:
    'Returns a Sankey-compatible `{ nodes, links }` payload aggregated from grant records. ' +
    'Suitable for rendering interactive money-flow visualisations. Not paginated; use `limit` to cap results.',
  request: {
    query: z.object({
      country: z
        .string()
        .length(2)
        .optional()
        .openapi({ description: 'Filter by recipient country (ISO 3166-1 alpha-2)', example: 'KE' }),
      year: z
        .string()
        .optional()
        .transform((v) => (v !== undefined ? parseInt(v, 10) : undefined))
        .openapi({ description: 'Filter by fiscal year', example: '2022' }),
      sector: z.string().optional().openapi({ description: 'Filter by funder sector', example: 'health' }),
      minAmount: z
        .string()
        .optional()
        .transform((v) => (v !== undefined ? parseFloat(v) : undefined))
        .openapi({ description: 'Minimum grant amount in USD', example: '10000' }),
      limit: z
        .string()
        .optional()
        .transform((v) => (v !== undefined ? Math.min(Math.max(1, parseInt(v, 10) || 500), 2000) : 500))
        .openapi({ description: 'Max grant rows to aggregate (1–2000, default 500)', example: '500' }),
    }),
  },
  responses: {
    200: {
      description: 'Sankey nodes and links',
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({
              nodes: z.array(
                z.object({
                  id: z.string(),
                  name: z.string(),
                  country: z.string().nullable(),
                }),
              ),
              links: z.array(
                z.object({
                  source: z.string(),
                  target: z.string(),
                  value: z.number(),
                }),
              ),
            }),
          }),
        },
      },
    },
    429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: ErrorSchema } } },
    500: { description: 'Internal server error', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

app.openapi(getFlowsRoute, async (c) => {
  try {
    const { country, year, sector, minAmount, limit } = c.req.valid('query');
    const db = getDb();
    const data = await getSankeyData(db, { country, year, sector, minAmount, limit });
    return c.json({ data }, 200);
  } catch (err) {
    return c.json(internalError(err), 500);
  }
});

// ---------------------------------------------------------------------------
// GET /v1/flows/by-country
// ---------------------------------------------------------------------------

const getFlowsByCountryRoute = createRoute({
  method: 'get',
  path: '/v1/flows/by-country',
  tags: ['Flows'],
  summary: 'Aggregate grant flows by country pair',
  description:
    'Returns aggregated grant flows grouped by (funder country, recipient country). ' +
    'Useful for choropleth maps and country-level financial-flow analysis.',
  request: {
    query: z.object({
      year: z
        .string()
        .optional()
        .transform((v) => (v !== undefined ? parseInt(v, 10) : undefined))
        .openapi({ description: 'Filter by fiscal year', example: '2022' }),
      minAmount: z
        .string()
        .optional()
        .transform((v) => (v !== undefined ? parseFloat(v) : undefined))
        .openapi({ description: 'Minimum grant amount in USD to include in aggregation', example: '5000' }),
      limit: z
        .string()
        .optional()
        .transform((v) => (v !== undefined ? Math.min(Math.max(1, parseInt(v, 10) || 200), 1000) : 200))
        .openapi({ description: 'Max country-pair rows (1–1000, default 200)', example: '200' }),
    }),
  },
  responses: {
    200: {
      description: 'Country-pair flow aggregates',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(
              z.object({
                funderCountry: z.string(),
                recipientCountry: z.string(),
                totalAmountUsd: z.number(),
                grantCount: z.number().int(),
              }),
            ),
          }),
        },
      },
    },
    429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: ErrorSchema } } },
    500: { description: 'Internal server error', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

app.openapi(getFlowsByCountryRoute, async (c) => {
  try {
    const { year, minAmount, limit } = c.req.valid('query');
    const db = getDb();
    const rows = await getFlowsByCountry(db, { year, minAmount, limit });
    return c.json({ data: rows }, 200);
  } catch (err) {
    return c.json(internalError(err), 500);
  }
});

// ===========================================================================
// ALERTS
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /v1/alerts
// ---------------------------------------------------------------------------

const listAlertsRoute = createRoute({
  method: 'get',
  path: '/v1/alerts',
  tags: ['Alerts'],
  summary: 'Global anomaly alert feed',
  description:
    'Returns a paginated feed of anomaly alerts across all organizations, ordered newest-first. ' +
    'Supports filtering by severity and alert type.',
  request: {
    query: z.object({
      severity: z
        .enum(['low', 'medium', 'high', 'critical'])
        .optional()
        .openapi({ description: 'Severity filter' }),
      type: z.string().optional().openapi({ description: 'Alert type filter', example: 'compensation_outlier' }),
      cursor: z.string().optional().openapi({ description: 'Pagination cursor' }),
      limit: z
        .string()
        .optional()
        .transform((v) => (v !== undefined ? Math.min(Math.max(1, parseInt(v, 10) || 25), 100) : 25))
        .openapi({ description: 'Page size (1–100, default 25)' }),
    }),
  },
  responses: {
    200: {
      description: 'Paginated anomaly alerts',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(
              z.object({
                id: z.string().uuid(),
                organizationId: z.string().uuid().nullable(),
                alertType: z.string(),
                severity: z.enum(['low', 'medium', 'high', 'critical']),
                confidence: z.number(),
                title: z.string(),
                description: z.string(),
                fiscalYear: z.number().int().nullable(),
                isReviewed: z.boolean(),
                createdAt: z.string(),
              }),
            ),
            meta: PaginationMeta,
          }),
        },
      },
    },
    429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: ErrorSchema } } },
    500: { description: 'Internal server error', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

app.openapi(listAlertsRoute, async (c) => {
  try {
    const { severity, type, cursor, limit } = c.req.valid('query');
    const db = getDb();
    const result = await getAnomalyAlerts(db, { severity, type, limit, cursor: cursor ?? null });
    const data = result.items.map((a) => ({
      id: a.id,
      organizationId: a.organizationId ?? null,
      alertType: a.alertType,
      severity: a.severity,
      confidence: a.confidence,
      title: a.title,
      description: a.description,
      fiscalYear: a.fiscalYear ?? null,
      isReviewed: a.isReviewed ?? false,
      createdAt: a.createdAt?.toISOString() ?? new Date().toISOString(),
    }));
    return c.json({ data, meta: { nextCursor: result.nextCursor } }, 200);
  } catch (err) {
    return c.json(internalError(err), 500);
  }
});

// ---------------------------------------------------------------------------
// GET /v1/alerts/stats
// ---------------------------------------------------------------------------

const alertsStatsRoute = createRoute({
  method: 'get',
  path: '/v1/alerts/stats',
  tags: ['Alerts'],
  summary: 'Alert statistics summary',
  description:
    'Returns aggregate alert counts broken down by severity level, and the count of unreviewed high/critical alerts. ' +
    'Also includes global dataset totals.',
  responses: {
    200: {
      description: 'Alert statistics',
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({
              totalAlerts: z.number().int(),
              unreviewedHighCritical: z.number().int(),
              bySeverity: z.object({
                low: z.number().int(),
                medium: z.number().int(),
                high: z.number().int(),
                critical: z.number().int(),
              }),
              totalOrgs: z.number().int(),
              totalAmount: z.number(),
              countriesCovered: z.number().int(),
            }),
          }),
        },
      },
    },
    429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: ErrorSchema } } },
    500: { description: 'Internal server error', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

app.openapi(alertsStatsRoute, async (c) => {
  try {
    const db = getDb();

    const [globalStats, severityRows] = await Promise.all([
      getGlobalStats(db),
      db.execute<{ severity: string; count: string }>(
        sql`SELECT severity, COUNT(*)::text AS count FROM anomaly_alerts GROUP BY severity`,
      ),
    ]);

    const bySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
    let totalAlerts = 0;
    for (const row of severityRows) {
      const n = Number(row.count);
      totalAlerts += n;
      if (row.severity === 'low') bySeverity.low = n;
      else if (row.severity === 'medium') bySeverity.medium = n;
      else if (row.severity === 'high') bySeverity.high = n;
      else if (row.severity === 'critical') bySeverity.critical = n;
    }

    return c.json(
      {
        data: {
          totalAlerts,
          unreviewedHighCritical: globalStats.alertsCount,
          bySeverity,
          totalOrgs: globalStats.totalOrgs,
          totalAmount: globalStats.totalAmount,
          countriesCovered: globalStats.countriesCovered,
        },
      },
      200,
    );
  } catch (err) {
    return c.json(internalError(err), 500);
  }
});

// ===========================================================================
// SEARCH
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /v1/search
// ---------------------------------------------------------------------------

const searchRoute = createRoute({
  method: 'get',
  path: '/v1/search',
  tags: ['Search'],
  summary: 'Full-text and semantic search across organizations',
  description:
    'Searches organizations by name, mission, description, and aliases using Postgres full-text search. ' +
    'Optional filters narrow results by country, sector, and status. Returns cursor-paginated results.',
  request: {
    query: z.object({
      q: z
        .string()
        .min(1)
        .openapi({ description: 'Search query (required)', example: 'clean water africa' }),
      country: z
        .string()
        .length(2)
        .optional()
        .openapi({ description: 'ISO 3166-1 alpha-2 country filter', example: 'KE' }),
      sector: z.string().optional().openapi({ description: 'Sector filter', example: 'environment' }),
      status: z
        .enum(['active', 'inactive', 'dissolved', 'suspended', 'unknown'])
        .optional()
        .openapi({ description: 'Registration status filter' }),
      cursor: z.string().optional().openapi({ description: 'Pagination cursor' }),
      limit: z
        .string()
        .optional()
        .transform((v) => (v !== undefined ? Math.min(Math.max(1, parseInt(v, 10) || 25), 100) : 25))
        .openapi({ description: 'Page size (1–100, default 25)' }),
    }),
  },
  responses: {
    200: {
      description: 'Search results',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(
              z.object({
                id: z.string().uuid(),
                name: z.string(),
                slug: z.string(),
                orgType: z.string(),
                countryCode: z.string(),
                sector: z.string().nullable(),
                status: z.string().nullable(),
                mission: z.string().nullable(),
                dataCompleteness: z.number().nullable(),
              }),
            ),
            meta: PaginationMeta,
          }),
        },
      },
    },
    400: { description: 'Missing or invalid query parameter', content: { 'application/json': { schema: ErrorSchema } } },
    429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: ErrorSchema } } },
    500: { description: 'Internal server error', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

app.openapi(searchRoute, async (c) => {
  try {
    const { q, country, sector, status, cursor, limit } = c.req.valid('query');
    const db = getDb();

    const result = await searchOrganizations(db, {
      query: q,
      country,
      sector,
      status,
      cursor: cursor ?? null,
      limit,
    });

    const data = result.items.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      orgType: org.orgType,
      countryCode: org.countryCode,
      sector: org.sector ?? null,
      status: org.status ?? null,
      mission: org.mission ?? null,
      dataCompleteness: org.dataCompleteness ?? null,
    }));

    return c.json({ data, meta: { nextCursor: result.nextCursor } }, 200);
  } catch (err) {
    return c.json(internalError(err), 500);
  }
});

// ===========================================================================
// REGISTRIES
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /v1/registries
// ---------------------------------------------------------------------------

const listRegistriesRoute = createRoute({
  method: 'get',
  path: '/v1/registries',
  tags: ['Registries'],
  summary: 'List data source registries',
  description:
    'Returns the static catalogue of all 30+ national and international charity registries that OpenGive ingests data from, ' +
    'along with metadata about their data format, update frequency, and priority tier.',
  responses: {
    200: {
      description: 'Registry catalogue',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                country: z.string(),
                countryCode: z.string(),
                apiType: z.enum(['rest', 'bulk_download', 'scrape', 'sdmx']),
                format: z.enum(['json', 'xml', 'csv', 'parquet', 'html']),
                updateFrequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'biannual']),
                priority: z.number().int(),
                baseUrl: z.string().nullable(),
                requiresAuth: z.boolean(),
              }),
            ),
          }),
        },
      },
    },
    429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

app.openapi(listRegistriesRoute, (c) => {
  const data = Object.values(REGISTRIES).map((r) => ({
    id: r.id,
    name: r.name,
    country: r.country,
    countryCode: r.countryCode,
    apiType: r.apiType,
    format: r.format,
    updateFrequency: r.updateFrequency,
    priority: r.priority,
    baseUrl: r.baseUrl ?? null,
    requiresAuth: r.requiresAuth,
  }));
  return c.json({ data }, 200);
});

// ---------------------------------------------------------------------------
// GET /v1/registries/:source/status
// ---------------------------------------------------------------------------

const getRegistryStatusRoute = createRoute({
  method: 'get',
  path: '/v1/registries/{source}/status',
  tags: ['Registries'],
  summary: 'Get data freshness status for a registry source',
  description:
    'Returns the most recent successful scrape run for the given registry source identifier, ' +
    'providing data freshness information for monitoring and display.',
  request: {
    params: z.object({
      source: z.string().min(1).openapi({
        description: 'Registry source identifier (e.g. us_propublica, uk_charity_commission)',
        example: 'us_propublica',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Registry freshness status',
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({
              source: z.string(),
              name: z.string().nullable(),
              country: z.string().nullable(),
              countryCode: z.string().nullable(),
              lastRunStatus: z.enum(['running', 'completed', 'failed', 'cancelled']).nullable(),
              lastRunStartedAt: z.string().nullable(),
              lastRunCompletedAt: z.string().nullable(),
              recordsFound: z.number().int().nullable(),
              recordsNew: z.number().int().nullable(),
              recordsUpdated: z.number().int().nullable(),
              updateFrequency: z.string().nullable(),
            }),
          }),
        },
      },
    },
    404: { description: 'Registry source not found', content: { 'application/json': { schema: ErrorSchema } } },
    429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: ErrorSchema } } },
    500: { description: 'Internal server error', content: { 'application/json': { schema: ErrorSchema } } },
  },
});


app.openapi(getRegistryStatusRoute, async (c) => {
  const { source } = c.req.valid('param');

  // Validate against the known registry catalogue
  const registryDef = REGISTRIES[source];
  if (!registryDef) {
    return c.json(notFoundError('Registry source', source), 404);
  }

  try {
    const db = getDb();

    // Fetch the most recent scrape run for this source regardless of status
    const rows = await db.execute<{
      status: string;
      started_at: string;
      completed_at: string | null;
      records_found: string;
      records_new: string;
      records_updated: string;
    }>(
      sql`
        SELECT
          status,
          started_at::text         AS started_at,
          completed_at::text       AS completed_at,
          records_found::text      AS records_found,
          records_new::text        AS records_new,
          records_updated::text    AS records_updated
        FROM scrape_runs
        WHERE source = ${source}
        ORDER BY started_at DESC
        LIMIT 1
      `,
    );

    const run = rows[0] ?? null;

    return c.json(
      {
        data: {
          source: registryDef.id,
          name: registryDef.name,
          country: registryDef.country,
          countryCode: registryDef.countryCode,
          lastRunStatus: run
            ? (run.status as 'running' | 'completed' | 'failed' | 'cancelled')
            : null,
          lastRunStartedAt: run?.started_at ?? null,
          lastRunCompletedAt: run?.completed_at ?? null,
          recordsFound: run ? Number(run.records_found) : null,
          recordsNew: run ? Number(run.records_new) : null,
          recordsUpdated: run ? Number(run.records_updated) : null,
          updateFrequency: registryDef.updateFrequency,
        },
      },
      200,
    );
  } catch (err) {
    return c.json(internalError(err), 500);
  }
});

// ===========================================================================
// EXPORT
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /v1/export/:format
// ---------------------------------------------------------------------------

const exportRoute = createRoute({
  method: 'get',
  path: '/v1/export/{format}',
  tags: ['Export'],
  summary: 'Bulk export organization data',
  description:
    'Streams a bulk export of organization data filtered by country, sector, and year range. ' +
    'Supported formats: `csv` and `json`. ' +
    'Responses set `Content-Disposition: attachment` so browsers trigger a file download. ' +
    'Large datasets are streamed to avoid memory pressure — do not buffer the full response in memory.',
  request: {
    params: z.object({
      format: z
        .enum(['csv', 'json'])
        .openapi({ description: 'Export format', example: 'csv' }),
    }),
    query: z.object({
      country: z
        .string()
        .length(2)
        .optional()
        .openapi({ description: 'Filter by country code (ISO 3166-1 alpha-2)', example: 'US' }),
      sector: z.string().optional().openapi({ description: 'Filter by sector', example: 'health' }),
      yearFrom: z
        .string()
        .optional()
        .transform((v) => (v !== undefined ? parseInt(v, 10) : undefined))
        .openapi({ description: 'Include organizations with last filing year >= this value', example: '2020' }),
      yearTo: z
        .string()
        .optional()
        .transform((v) => (v !== undefined ? parseInt(v, 10) : undefined))
        .openapi({ description: 'Include organizations with last filing year <= this value', example: '2024' }),
      limit: z
        .string()
        .optional()
        .transform((v) => (v !== undefined ? Math.min(Math.max(1, parseInt(v, 10) || 1000), 5_000) : 1000))
        .openapi({ description: 'Max rows to export (1–50 000, default 5 000)', example: '5000' }),
    }),
  },
  responses: {
    200: {
      description: 'Streamed export file',
      content: {
        'text/csv': { schema: z.string().openapi({ description: 'CSV file content' }) },
        'application/json': {
          schema: z.object({
            data: z.array(z.record(z.unknown())),
          }),
        },
      },
    },
    400: { description: 'Unsupported format', content: { 'application/json': { schema: ErrorSchema } } },
    429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: ErrorSchema } } },
    500: { description: 'Internal server error', content: { 'application/json': { schema: ErrorSchema } } },
  },
});


app.openapi(exportRoute, async (c) => {
  const { format } = c.req.valid('param');
  const { country, sector, yearFrom, yearTo, limit } = c.req.valid('query');

  try {
    const db = getDb();

    // Build dynamic WHERE conditions using raw SQL for flexibility across
    // the filter combinations — Drizzle's builder becomes unwieldy with optional
    // date-range conditions across a nullable column.
    const countryCondition = country
      ? sql`AND o.country_code = ${country}`
      : sql``;
    const sectorCondition = sector
      ? sql`AND o.sector = ${sector}`
      : sql``;
    const yearFromCondition =
      yearFrom !== undefined
        ? sql`AND EXTRACT(YEAR FROM o.last_filing_date)::int >= ${yearFrom}`
        : sql``;
    const yearToCondition =
      yearTo !== undefined
        ? sql`AND EXTRACT(YEAR FROM o.last_filing_date)::int <= ${yearTo}`
        : sql``;

    interface ExportRow {
      id: string;
      name: string;
      slug: string;
      org_type: string;
      country_code: string;
      sector: string | null;
      status: string | null;
      website: string | null;
      city: string | null;
      registration_date: string | null;
      last_filing_date: string | null;
      data_completeness: string | null;
      registry_source: string;
    }

    const rows = await db.execute<ExportRow>(
      sql`
        SELECT
          o.id,
          o.name,
          o.slug,
          o.org_type,
          o.country_code,
          o.sector,
          o.status,
          o.website,
          o.city,
          o.registration_date::text  AS registration_date,
          o.last_filing_date::text   AS last_filing_date,
          o.data_completeness::text  AS data_completeness,
          o.registry_source
        FROM organizations o
        WHERE TRUE
          ${countryCondition}
          ${sectorCondition}
          ${yearFromCondition}
          ${yearToCondition}
        ORDER BY o.name
        LIMIT ${limit}
      `,
    );

    const filename = `opengive-export-${new Date().toISOString().slice(0, 10)}.${format}`;

    if (format === 'csv') {
      const CSV_HEADERS = [
        'id',
        'name',
        'slug',
        'org_type',
        'country_code',
        'sector',
        'status',
        'website',
        'city',
        'registration_date',
        'last_filing_date',
        'data_completeness',
        'registry_source',
      ];

      // Escape a single CSV cell value: wrap in quotes and double any
      // internal quote characters.
      const escapeCsv = (v: unknown): string => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const lines: string[] = [CSV_HEADERS.join(',')];
      for (const row of rows) {
        lines.push(
          CSV_HEADERS.map((h) => escapeCsv(row[h as keyof ExportRow])).join(','),
        );
      }
      const body = lines.join('\n');

      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // JSON format — return as an attachment
    const body = JSON.stringify({ data: rows });
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return c.json(internalError(err), 500);
  }
});

// ===========================================================================
// API KEYS (authenticated)
// ===========================================================================

// ---------------------------------------------------------------------------
// POST /v1/api-keys
// ---------------------------------------------------------------------------

const createApiKeyRoute = createRoute({
  method: 'post',
  path: '/v1/api-keys',
  tags: ['API Keys'],
  summary: 'Generate a new API key',
  description:
    'Generates a fresh API key for the authenticated user and stores its SHA-256 hash in the database. ' +
    'The raw key (`og_live_<32-hex>`) is returned **once only** — it is never stored in plaintext. ' +
    'Subsequent calls rotate the key; the previous key is immediately invalidated. ' +
    'Requires authentication via an existing X-API-Key or a Supabase JWT in the Authorization header. ' +
    'Authenticated callers enjoy the 1 000 req/min rate limit tier.',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    201: {
      description: 'New API key generated',
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({
              apiKey: z.string().openapi({
                description: 'Raw API key — save this immediately, it will not be shown again.',
                example: 'og_live_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2',
              }),
              createdAt: z.string(),
            }),
          }),
        },
      },
    },
    401: { description: 'Not authenticated', content: { 'application/json': { schema: ErrorSchema } } },
    429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: ErrorSchema } } },
    500: { description: 'Internal server error', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

// Apply requireApiKey middleware then register the OpenAPI handler.
// The middleware runs first because app.use() is evaluated before route handlers.
app.use('/v1/api-keys', requireApiKey());

app.openapi(createApiKeyRoute, async (c) => {
  try {
    const apiUser = c.var.apiUser;

    // requireApiKey middleware guarantees this, but guard defensively for TypeScript
    if (!apiUser) {
      return c.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        401,
      );
    }

    const rawKey = generateApiKey();
    const keyHash = sha256Hex(rawKey);
    const now = new Date();

    const db = getDb();

    // Upsert: update the hash for the current user, rotating any previous key.
    await db
      .update(userProfiles)
      .set({ apiKeyHash: keyHash, updatedAt: now })
      .where(eq(userProfiles.id, apiUser.id));

    return c.json(
      {
        data: {
          apiKey: rawKey,
          createdAt: now.toISOString(),
        },
      },
      201,
    );
  } catch (err) {
    return c.json(internalError(err), 500);
  }
});

// ===========================================================================
// OpenAPI specification
// ===========================================================================

app.doc('/v1/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'OpenGive Public API',
    version: '1.0.0',
    description:
      'Public REST API for the OpenGive global charity accountability platform. ' +
      'Provides read access to organization data, financial filings, grant flows, anomaly alerts, ' +
      'and accountability scores sourced from 30+ national charity registries. ' +
      '\n\n**Rate limits:** 100 req/min (anonymous) · 1 000 req/min (X-API-Key authenticated)' +
      '\n\n**Pagination:** All list endpoints use cursor-based pagination — never page/offset. ' +
      'Pass the `nextCursor` value from a response as the `cursor` query parameter to fetch the next page.',
    license: {
      name: 'Apache 2.0',
      url: 'https://www.apache.org/licenses/LICENSE-2.0',
    },
    contact: {
      name: 'OpenGive',
      url: 'https://opengive.org',
    },
  },
  servers: [
    { url: 'https://api.opengive.org', description: 'Production' },
    { url: 'http://localhost:3001', description: 'Local development' },
  ],
  tags: [
    { name: 'Organizations', description: 'Charity and NGO organization records from 30+ registries' },
    { name: 'Financials', description: 'Annual financial filing data' },
    { name: 'Grants', description: 'Grant giving and receiving relationships' },
    { name: 'People', description: 'Officers, directors, and executives' },
    { name: 'Flows', description: 'Money flow aggregates for Sankey and choropleth visualisations' },
    { name: 'Alerts', description: 'ML-generated anomaly detection alerts' },
    { name: 'Scores', description: 'AI-computed transparency and accountability scores' },
    { name: 'Search', description: 'Full-text search across all organization records' },
    { name: 'Registries', description: 'Data source catalogue and freshness status' },
    { name: 'Export', description: 'Bulk data export in CSV and JSON formats' },
    { name: 'API Keys', description: 'API key management for authenticated access' },
  ],
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default app;
