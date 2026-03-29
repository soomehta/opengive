---
sidebar_position: 2
---

# Architecture Overview

OpenGive uses a modern three-layer architecture optimized for performance, scalability, and transparency.

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js 15)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ Command  │ │  Entity  │ │  Flow    │ │  Investigation   │   │
│  │ Center   │ │  Explorer│ │  Mapper  │ │  Workbench       │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
│                    Vercel (Edge + SSR)                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │ tRPC / REST
┌──────────────────────────┴──────────────────────────────────────┐
│                      API LAYER (Node.js)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │  tRPC    │ │  Hono    │ │  Auth    │ │  Rate Limiting   │   │
│  │ Internal │ │ Public   │ │ Supabase │ │  + API Keys      │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
│               Vercel Functions + Supabase Edge Functions         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────────┐
│                    DATA LAYER (Supabase)                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              PostgreSQL 15 (Supabase)                     │   │
│  │  + pg_cron  + pgvector  + PostGIS  + pg_trgm             │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Supabase     │  │ Supabase     │  │ Supabase             │   │
│  │ Storage      │  │ Realtime     │  │ Auth                 │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                 ML / ANALYSIS (Railway)                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ FastAPI  │ │ Dagster  │ │ Scrapy   │ │  AI Agents       │   │
│  │ ML API   │ │ Orchest. │ │ Workers  │ │  (LangGraph)     │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
│                Railway (Docker containers)                       │
└─────────────────────────────────────────────────────────────────┘
```

## Layer Details

### 1. Frontend Layer (Next.js 15)

**Location:** `apps/web/`

The frontend is a responsive web application deployed to Vercel with four main dashboards:

- **Command Center** — Global overview of all charity data with real-time alerts
- **Entity Explorer** — Advanced search and filtering across all registries
- **Flow Mapper** — Sankey diagrams visualizing money flows between organizations
- **Investigation Workbench** — Collaborative analysis tool for complex investigations

**Tech Stack:**
- **Framework:** Next.js 15 with App Router (React Server Components by default)
- **State:** Zustand + TanStack Query for data fetching and caching
- **Styling:** Tailwind CSS v4 + Radix UI primitives + CVA for component variants
- **Charts:** Apache ECharts (Sankey, heatmaps) + D3.js (custom visualizations)
- **Maps:** MapLibre GL JS + deck.gl for geospatial data
- **i18n:** next-intl with support for English, Arabic, Hindi, French, Spanish, German

**Deployment:** Vercel with auto-preview on PRs and production deploys on main branch merges.

### 2. API Layer (Node.js)

**Locations:** `apps/web/app/api/`, `apps/api/` (optional standalone)

Two APIs serve different purposes:

#### tRPC (Internal)
- Server-to-frontend communication with full TypeScript type safety
- Used for authenticated dashboard operations
- Automatic code generation and inference

#### Hono (Public REST)
- Public-facing `/v1/*` API with OpenAPI 3.1 documentation
- Rate limiting: 100 req/min (anonymous), 1000 req/min (authenticated)
- API keys issued through user dashboard
- Standard error format: `{ error: { code, message, details } }`

**Authentication:** Supabase Auth with JWT tokens and email/magic link providers

**Deployment:** Vercel Functions (automatically deployed with frontend)

### 3. Data Layer (Supabase PostgreSQL)

**Location:** `packages/db/`

PostgreSQL 15 with specialized extensions for charity data analysis:

#### Core Extensions
- **pgvector** — Vector similarity search for embeddings (used in anomaly detection)
- **PostGIS** — Geographic queries and spatial operations
- **pg_trgm** — Full-text search optimization
- **pg_cron** — Scheduled tasks for data refresh

#### Key Tables
- `organizations` — Charity master records with registry sources
- `financial_filings` — Annual financial statements
- `grants` — Grant relationships between organizations
- `organization_scores` — Composite quality scores by methodology version
- `anomaly_alerts` — Flagged suspicious patterns
- `entity_matches` — Cross-registry probabilistic matches
- `scrape_runs` — Data ingestion audit trail

#### Row-Level Security
- All financial data is publicly readable (transparency principle)
- Service role (backend) has write access
- Users own their investigation workspaces

**Deployment:** Managed Supabase instance with automated backups and point-in-time recovery.

### 4. ML & Analysis Layer (Railway)

**Locations:** `services/ml-api/`, `services/pipeline/`

Async services for data processing and AI-powered analysis:

#### FastAPI ML Service
- Anomaly detection using statistical rules and ML models
- Embedding generation for similarity search
- Entity resolution via probabilistic record linkage (Splink)
- Explainability endpoints for score breakdowns

#### Dagster Orchestration
- Asset-centric data pipeline (not job-based)
- Daily runs for scrapers, parsers, and analysis
- Built-in error handling, retries, and observability
- Native dbt integration for transformations

#### Scrapers
- Scrapy + Playwright for structured data extraction
- Respect robots.txt and rate limits
- SHA-256 content hashing for change detection
- Idempotent runs for reliability

**Deployment:** Railway containers with persistent Docker volumes for Dagster state.

## Key Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Frontend framework | Next.js 15 (App Router) | Largest contributor pool, SSR/RSC, Vercel native |
| Database | Supabase PostgreSQL | Managed, free tier, pgvector/PostGIS built-in |
| Vector search | pgvector (Supabase) | No separate vector DB; SQL joins with relational data |
| API (internal) | tRPC v11 | End-to-end TypeScript type safety, less boilerplate |
| API (public) | Hono | Lightweight, OpenAPI 3.1, edge-compatible |
| ML services | FastAPI (Python) | Ecosystem, async, type hints, familiar to data teams |
| Orchestration | Dagster | Asset-centric, modern UI, native dbt support |
| Scraping | Scrapy + Playwright | Structured data + JS-heavy portals |
| Entity resolution | Splink | Probabilistic matching at scale, explainable |
| Hosting (frontend) | Vercel | Free tier, CLI deploy, edge functions |
| Hosting (backend) | Railway | Docker-native, CLI deploy, persistent services |

## Data Flow

### Ingestion Pipeline

```
RAW DATA (Supabase Storage)
  ↓
PARSED (Staging tables, structured extraction)
  ↓
NORMALIZED (Core tables, currency conversion, deduplication)
  ↓
ENRICHED (Analysis tables, ratios, scores, embeddings)
  ↓
INDEXED (Full-text search vectors, vector embeddings)
```

Every record maintains provenance:
```
organizations.registry_source → scrape_runs.id → raw file in Storage
```

### User Query Flow

```
1. User searches for "Red Cross" in frontend
2. Next.js sends tRPC query to backend
3. tRPC router queries PostgreSQL with full-text search
4. Results ranked by pgvector similarity (if embeddings available)
5. Frontend displays results with financial summary cards
6. User clicks org → detailed view triggers additional data fetches
7. Anomaly alerts, related entities, and grant flows loaded in parallel
```

### Real-Time Updates

Supabase Realtime subscriptions notify frontend of:
- New anomaly alerts for saved organizations
- Updated financial filings from data pipeline
- Entity match confirmations from analysts

## Monorepo Structure

```
opengive/
├── apps/
│   ├── web/                  # Next.js 15 dashboard
│   ├── api/                  # Standalone API (optional)
│   └── docs/                 # Docusaurus documentation
├── packages/
│   ├── ui/                   # Shared component library
│   ├── db/                   # Database schema & migrations
│   ├── config/               # Validated environment variables
│   ├── types/                # Inter-service TypeScript types
│   └── analytics/            # Scoring & ratio calculations
├── services/
│   ├── ml-api/               # FastAPI service
│   └── pipeline/             # Dagster orchestration
├── scripts/                  # Setup, migration, seed scripts
└── .github/
    └── workflows/            # GitHub Actions CI/CD
```

## Scalability Considerations

### Frontend
- Vercel Edge Functions for geographic distribution
- Next.js Image Optimization for logo/chart rendering
- Client-side search with Algolia (future enhancement)

### Database
- Connection pooling via Supabase Pooler (PgBouncer)
- Partitioning by year for large tables (financial_filings)
- Indexed searches on full-text and vector columns

### API
- Cursor-based pagination (not offset) for large result sets
- Response caching via Vercel Edge Cache headers
- Request deduplication via TanStack Query on client

### ML Pipeline
- Async task queue for long-running analysis
- GPU availability for embedding generation
- Distributed scraping across multiple workers

## Security

- **All data is public** (transparency principle) with public read policies
- **No authentication required** for search and view operations
- **User authentication** only for saving investigations and API keys
- **Service role key** on backend only for writes
- **Rate limiting** on public API endpoints
- **CORS** configured for specified frontend origins

## Development vs Production

| Aspect | Development | Production |
|--------|-------------|-----------|
| **Database** | Local Supabase (Docker) | Managed Supabase instance |
| **Storage** | Supabase Storage (local) | Supabase Storage (cloud) |
| **Frontend** | localhost:3000 | opengive.org |
| **API** | localhost:3000/api | api.opengive.org (Vercel) |
| **Docs** | localhost:3001 | docs.opengive.org (Vercel) |
| **ML API** | localhost:8000 | ml.opengive.org (Railway, private) |
| **Scrapers** | Manual via Dagster UI | Scheduled pg_cron jobs |
| **Realtime** | Enabled | Enabled |

## Next Steps

- Review [Data Sources](./data-sources.md) to understand ingestion
- Study [Scoring Methodology](./methodology.md) for analysis logic
- Read [API Reference](./api-reference.md) for integration details
