# CLAUDE.md — OpenGive: Global Charity Accountability Dashboard

> **This is the master context document for Claude Code agents building OpenGive.**
> Every agent working on any part of this codebase must read this file first.
> It contains the project vision, architecture, design system, coding standards, deployment targets, and agent coordination protocol.

---

## Table of Contents

1. [Project Identity](#1-project-identity)
2. [Product Vision & Core Problem](#2-product-vision--core-problem)
3. [Architecture Overview](#3-architecture-overview)
4. [Monorepo Structure](#4-monorepo-structure)
5. [Design System — "Clarity"](#5-design-system--clarity)
6. [Agent Roles & Coordination](#6-agent-roles--coordination)
7. [Database Schema](#7-database-schema)
8. [Data Sources & Ingestion](#8-data-sources--ingestion)
9. [API Design](#9-api-design)
10. [Frontend Application](#10-frontend-application)
11. [AI Analysis Engine](#11-ai-analysis-engine)
12. [Scraping Pipeline](#12-scraping-pipeline)
13. [Deployment & Infrastructure](#13-deployment--infrastructure)
14. [Coding Standards](#14-coding-standards)
15. [Testing Strategy](#15-testing-strategy)
16. [Open Source & Community](#16-open-source--community)
17. [Phase Plan](#17-phase-plan)
18. [Glossary](#18-glossary)

---

## 1. Project Identity

**Name:** OpenGive
**Tagline:** "Follow the money. Demand transparency."
**Repo:** `opengive` (monorepo)
**License:** Apache 2.0
**Domain:** TBD (target: `opengive.org` or `opengive.io`)
**Primary language:** English, with i18n architecture for Arabic, Hindi, French, Spanish, German from day one.

OpenGive is an open-source, community-driven command center for visualizing and analyzing the global flow of charitable donations. It aggregates publicly available data from 30+ national charity registries, applies AI-powered forensic analysis to detect anomalies and potential misappropriation, and presents everything through an accessible, beautiful, inclusive dashboard that any donor, journalist, researcher, or regulator can use without a paywall.

---

## 2. Product Vision & Core Problem

### The Problem

Global charitable giving exceeds $500 billion annually. The data about where this money goes is:
- **Fragmented** — scattered across 30+ national registries with incompatible formats
- **Paywalled** — commercial platforms like Candid charge $2,000–4,200+/year for deep access
- **Opaque** — entire regions (GCC, Sub-Saharan Africa, Latin America, Southeast Asia) have zero systematic accountability infrastructure
- **Stale** — annual filing cycles mean 12–18 month data lags
- **Unconnected** — no tool cross-references charities across jurisdictions to detect shell networks, circular funding, or shared-director patterns

### What OpenGive Does

1. **Aggregates** public charity data from every available global registry into a unified, normalized database
2. **Visualizes** money flows through Sankey diagrams, geographic maps, network graphs, and time-series charts — a "command center" for charity accountability
3. **Analyzes** filings using AI agents that detect financial anomalies, flag red-flag patterns (overhead manipulation, related-party transactions, shell structures), and generate plain-language risk assessments
4. **Connects** entities across borders using probabilistic entity resolution — matching organizations, directors, and addresses across jurisdictions
5. **Opens** everything — data, algorithms, scoring methodology, and codebase — under Apache 2.0 with full audit trails

### Who It Serves

- **Individual donors** wanting to verify where their money goes
- **Investigative journalists** following cross-border money trails
- **Regulators** needing cross-jurisdictional oversight tools
- **Researchers** studying the nonprofit sector at scale
- **Charity watchdog organizations** needing open infrastructure
- **The charities themselves** — good actors benefit from transparent ecosystems

### Core Principles

- **Transparency of methodology** — every algorithm, weight, and threshold is inspectable and adjustable
- **No paywall, ever** — core functionality is free forever
- **Inclusive by design** — RTL support, screen-reader accessible, mobile-first, low-bandwidth modes
- **Global perspective** — not US-centric; every jurisdiction is a first-class citizen
- **Data, not opinions** — surface patterns and anomalies; let users draw conclusions

---

## 3. Architecture Overview

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

### Key Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frontend framework | Next.js 15 (App Router) | Largest contributor pool, SSR/RSC, Vercel-native |
| Primary database | Supabase PostgreSQL | Managed, free tier, built-in auth/storage/realtime, pgvector |
| Vector search | pgvector (Supabase-native) | No separate vector DB needed; SQL joins with relational data |
| Geospatial | PostGIS (Supabase-native) | Built into Supabase PostgreSQL |
| Hosting (frontend) | Vercel | Free tier, CLI deploy, edge functions |
| Hosting (ML/pipelines) | Railway | Docker support, CLI deploy, persistent services |
| API (internal) | tRPC v11 | End-to-end TypeScript type safety |
| API (public) | Hono | Lightweight, OpenAPI 3.1, edge-compatible |
| ML services | FastAPI (Python) | Ecosystem for ML/AI, async, type hints |
| Orchestration | Dagster | Asset-centric, modern UI, native dbt support |
| Scraping | Scrapy + Playwright | Structured data + JS-heavy portals |
| AI agents | LangGraph | Stateful multi-agent orchestration |
| Entity resolution | Splink | Probabilistic record linkage at scale |
| State management | Zustand + TanStack Query | Simple, performant, no boilerplate |
| Styling | Tailwind CSS v4 | Utility-first, tree-shakeable, design tokens |
| Component library | Radix UI + custom | Accessible primitives, fully custom styling |
| Charts | Apache ECharts + D3 | Sankey/heatmap built-in (ECharts), custom viz (D3) |
| Maps | MapLibre GL JS + deck.gl | Open-source, WebGL, no license costs |
| i18n | next-intl | Server component support, ICU message format |
| Monorepo | Turborepo | Fast builds, Vercel-native, simple config |

---

## 4. Monorepo Structure

```
opengive/
├── CLAUDE.md                          ← THIS FILE (master context)
├── turbo.json                         ← Turborepo pipeline config
├── package.json                       ← Root workspace config
├── pnpm-workspace.yaml                ← pnpm workspace definition
├── .env.example                       ← Environment variable template
├── docker-compose.yml                 ← Local development stack
├── LICENSE                            ← Apache 2.0
├── CONTRIBUTING.md                    ← Contributor guide
├── README.md                          ← Public readme
│
├── apps/
│   ├── web/                           ← Next.js 15 dashboard application
│   │   ├── app/                       ← App Router pages and layouts
│   │   │   ├── (dashboard)/           ← Authenticated dashboard routes
│   │   │   │   ├── command-center/    ← Main command center view
│   │   │   │   ├── explore/           ← Entity explorer & search
│   │   │   │   ├── flows/             ← Sankey flow mapper
│   │   │   │   ├── investigate/       ← Investigation workbench
│   │   │   │   ├── alerts/            ← Anomaly alerts feed
│   │   │   │   └── settings/          ← User preferences
│   │   │   ├── (public)/              ← Public-facing pages
│   │   │   │   ├── page.tsx           ← Landing / marketing homepage
│   │   │   │   ├── about/             ← Mission, methodology, team
│   │   │   │   ├── api-docs/          ← Interactive API documentation
│   │   │   │   └── org/[slug]/        ← Public charity profile pages
│   │   │   ├── api/                   ← API routes (tRPC + Hono)
│   │   │   │   ├── trpc/[trpc]/       ← tRPC handler
│   │   │   │   └── v1/               ← Public REST API (Hono)
│   │   │   ├── layout.tsx             ← Root layout with providers
│   │   │   └── globals.css            ← Global styles + design tokens
│   │   ├── components/                ← App-specific components
│   │   │   ├── charts/                ← ECharts + D3 visualizations
│   │   │   ├── maps/                  ← MapLibre + deck.gl components
│   │   │   ├── dashboard/             ← Dashboard shell, sidebar, etc.
│   │   │   └── investigation/         ← Investigation-specific UI
│   │   ├── lib/                       ← App utilities
│   │   │   ├── trpc.ts               ← tRPC client setup
│   │   │   ├── supabase.ts           ← Supabase client (browser + server)
│   │   │   └── stores/               ← Zustand stores
│   │   ├── messages/                  ← i18n message files
│   │   │   ├── en.json
│   │   │   ├── ar.json
│   │   │   ├── hi.json
│   │   │   ├── fr.json
│   │   │   ├── es.json
│   │   │   └── de.json
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── api/                           ← Standalone Hono public API (optional, can be Vercel function)
│   │   ├── src/
│   │   │   ├── index.ts               ← Hono app entry
│   │   │   ├── routes/                ← API route modules
│   │   │   │   ├── organizations.ts
│   │   │   │   ├── financials.ts
│   │   │   │   ├── flows.ts
│   │   │   │   ├── alerts.ts
│   │   │   │   └── search.ts
│   │   │   └── middleware/            ← Auth, rate limiting, CORS
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── docs/                          ← Docusaurus documentation site
│       ├── docs/
│       │   ├── getting-started.md
│       │   ├── architecture.md
│       │   ├── data-sources.md
│       │   ├── methodology.md         ← CRITICAL: transparent scoring methodology
│       │   ├── api-reference.md
│       │   └── contributing.md
│       └── package.json
│
├── packages/
│   ├── ui/                            ← Shared component library
│   │   ├── src/
│   │   │   ├── primitives/            ← Base components (Button, Input, Dialog, etc.)
│   │   │   ├── data-display/          ← Table, Card, Badge, Stat, etc.
│   │   │   ├── navigation/            ← Sidebar, Tabs, Breadcrumb, CommandPalette
│   │   │   ├── feedback/              ← Toast, Alert, Skeleton, Progress
│   │   │   ├── charts/                ← Chart wrapper components
│   │   │   │   ├── SankeyFlow.tsx     ← Sankey diagram for money flows
│   │   │   │   ├── NetworkGraph.tsx   ← Force-directed org relationship graph
│   │   │   │   ├── GeoMap.tsx         ← MapLibre geographic visualization
│   │   │   │   ├── TimelineSpark.tsx  ← Sparkline financial timeline
│   │   │   │   ├── AnomalyRadar.tsx   ← Radar chart for anomaly scoring
│   │   │   │   └── RatioGauge.tsx     ← Gauge for financial ratios
│   │   │   ├── layout/                ← Grid, Stack, Container, Divider
│   │   │   └── index.ts              ← Barrel export
│   │   ├── tailwind.config.ts         ← Shared Tailwind preset
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── db/                            ← Database schema, migrations, types
│   │   ├── supabase/
│   │   │   ├── migrations/            ← Numbered SQL migrations
│   │   │   │   ├── 00001_initial_schema.sql
│   │   │   │   ├── 00002_financial_tables.sql
│   │   │   │   ├── 00003_grants_and_flows.sql
│   │   │   │   ├── 00004_analysis_tables.sql
│   │   │   │   ├── 00005_pgvector_embeddings.sql
│   │   │   │   └── 00006_rls_policies.sql
│   │   │   ├── seed.sql               ← Development seed data
│   │   │   └── config.toml            ← Supabase project config
│   │   ├── src/
│   │   │   ├── schema.ts             ← Drizzle ORM schema definitions
│   │   │   ├── client.ts             ← Database client factory
│   │   │   ├── types.ts              ← Generated TypeScript types
│   │   │   └── queries/              ← Reusable query builders
│   │   │       ├── organizations.ts
│   │   │       ├── financials.ts
│   │   │       ├── flows.ts
│   │   │       └── analysis.ts
│   │   ├── drizzle.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── config/                        ← Shared configuration
│   │   ├── src/
│   │   │   ├── env.ts                ← Validated environment variables (zod)
│   │   │   ├── registries.ts         ← Registry source definitions
│   │   │   └── constants.ts          ← Shared constants
│   │   └── package.json
│   │
│   ├── types/                         ← Shared TypeScript types
│   │   ├── src/
│   │   │   ├── organization.ts       ← Core entity types
│   │   │   ├── financial.ts          ← Financial data types
│   │   │   ├── flow.ts              ← Grant/donation flow types
│   │   │   ├── analysis.ts          ← Anomaly/scoring types
│   │   │   ├── registry.ts          ← Data source registry types
│   │   │   └── api.ts               ← API request/response types
│   │   └── package.json
│   │
│   └── analytics/                     ← Shared analytics/scoring logic (isomorphic)
│       ├── src/
│       │   ├── ratios.ts             ← Financial ratio calculations
│       │   ├── benchmarks.ts         ← Peer benchmarking logic
│       │   ├── scoring.ts            ← Transparency/health score algorithms
│       │   └── benford.ts            ← Benford's Law analysis (JS implementation)
│       └── package.json
│
├── services/
│   ├── ml-api/                        ← FastAPI ML service (Railway)
│   │   ├── app/
│   │   │   ├── main.py              ← FastAPI app entry
│   │   │   ├── routers/
│   │   │   │   ├── analysis.py       ← Anomaly detection endpoints
│   │   │   │   ├── embeddings.py     ← Text embedding generation
│   │   │   │   ├── entities.py       ← Entity resolution endpoints
│   │   │   │   └── agents.py         ← AI agent orchestration
│   │   │   ├── models/               ← ML model definitions
│   │   │   │   ├── anomaly.py        ← Isolation Forest / autoencoder
│   │   │   │   ├── benford.py        ← Benford's Law analysis
│   │   │   │   └── network.py        ← Graph analysis models
│   │   │   ├── agents/               ← LangGraph agent definitions
│   │   │   │   ├── filing_parser.py
│   │   │   │   ├── financial_analyst.py
│   │   │   │   ├── network_investigator.py
│   │   │   │   ├── claims_verifier.py
│   │   │   │   └── report_generator.py
│   │   │   ├── services/
│   │   │   │   ├── splink_resolver.py ← Entity resolution with Splink
│   │   │   │   ├── embedding_svc.py  ← Embedding generation
│   │   │   │   └── supabase_client.py
│   │   │   └── config.py
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   ├── railway.toml
│   │   └── pyproject.toml
│   │
│   └── pipeline/                      ← Dagster + Scrapy pipeline (Railway)
│       ├── dagster_pipeline/
│       │   ├── __init__.py
│       │   ├── assets/               ← Dagster software-defined assets
│       │   │   ├── us_irs990.py       ← IRS 990 bulk ingest
│       │   │   ├── uk_charity_commission.py
│       │   │   ├── uk_360giving.py
│       │   │   ├── canada_cra.py
│       │   │   ├── australia_acnc.py
│       │   │   ├── india_fcra.py
│       │   │   ├── iati.py
│       │   │   ├── unocha_fts.py
│       │   │   └── oecd_dac.py
│       │   ├── resources/            ← Shared resources (DB, storage, etc.)
│       │   ├── jobs/                 ← Job definitions
│       │   └── schedules/            ← Cron schedules
│       ├── scrapers/
│       │   ├── spiders/              ← Scrapy spiders
│       │   │   ├── india_ngo_darpan.py
│       │   │   ├── india_mca.py
│       │   │   ├── gcc_directories.py
│       │   │   ├── france_rna.py
│       │   │   └── eu_registries.py
│       │   ├── playwright_scrapers/  ← Playwright for JS-heavy portals
│       │   │   ├── india_fcra_portal.py
│       │   │   └── gcc_ministry_portals.py
│       │   ├── middlewares.py
│       │   ├── pipelines.py          ← Item processing pipelines
│       │   └── settings.py
│       ├── Dockerfile
│       ├── requirements.txt
│       ├── railway.toml
│       └── pyproject.toml
│
├── scripts/
│   ├── setup.sh                       ← One-command local setup
│   ├── seed-dev.ts                    ← Generate development seed data
│   ├── deploy-vercel.sh               ← Vercel deployment script
│   ├── deploy-railway.sh              ← Railway deployment script
│   └── migrate.sh                     ← Run Supabase migrations
│
└── .github/
    ├── workflows/
    │   ├── ci.yml                     ← Lint, type-check, test on PR
    │   ├── deploy-preview.yml         ← Vercel preview on PR
    │   └── deploy-production.yml      ← Production deploy on main merge
    └── ISSUE_TEMPLATE/
        ├── bug_report.md
        ├── feature_request.md
        └── data_source_request.md
```

---

## 5. Design System — "Clarity"

### Design Philosophy

OpenGive's design system is called **"Clarity"** — named for its core mission of making opaque financial data transparent and understandable. The aesthetic is **editorial intelligence**: think Bloomberg Terminal meets The Guardian's data journalism, made humane and accessible.

**Design pillars:**
1. **Legibility over decoration** — every pixel serves comprehension
2. **Data density without overwhelm** — command centers need information, not emptiness
3. **Global inclusivity** — RTL-ready, color-blind safe, screen-reader first
4. **Trust through restraint** — muted palette communicates seriousness; color signals meaning

### Color System

The palette is built on **semantic meaning**. Colors are never decorative — they always encode information.

```css
:root {
  /* === SURFACE SYSTEM === */
  --surface-ground: #0C0E12;          /* Deepest background */
  --surface-base: #12151B;            /* Primary background */
  --surface-raised: #1A1E27;          /* Cards, panels */
  --surface-overlay: #232833;         /* Modals, dropdowns */
  --surface-elevated: #2C3240;        /* Hover states on raised */

  /* === TEXT HIERARCHY === */
  --text-primary: #E8ECF1;            /* Primary content */
  --text-secondary: #9BA3B5;          /* Supporting text */
  --text-tertiary: #636D82;           /* Disabled, hints */
  --text-inverse: #0C0E12;            /* Text on light backgrounds */

  /* === SEMANTIC ACCENT COLORS === */
  --accent-trust: #3B82F6;            /* Links, primary actions, informational */
  --accent-trust-subtle: #1E3A5F;     /* Trust backgrounds */

  --signal-healthy: #22C55E;          /* Good financial health, passing */
  --signal-healthy-subtle: #14532D;

  --signal-caution: #F59E0B;          /* Anomalies, warnings */
  --signal-caution-subtle: #78350F;

  --signal-danger: #EF4444;           /* Red flags, critical alerts */
  --signal-danger-subtle: #7F1D1D;

  --signal-neutral: #8B5CF6;          /* Informational, entity types */
  --signal-neutral-subtle: #3B1F6E;

  /* === BORDER & DIVIDERS === */
  --border-subtle: #1F2533;           /* Light dividers */
  --border-default: #2C3240;          /* Standard borders */
  --border-emphasis: #3D4556;         /* Emphasized borders */

  /* === DATA VISUALIZATION PALETTE === */
  /* Categorical — 8 distinguishable colors, color-blind safe (simulated for deuteranopia, protanopia, tritanopia) */
  --viz-1: #3B82F6;                   /* Blue */
  --viz-2: #F59E0B;                   /* Amber */
  --viz-3: #22C55E;                   /* Green */
  --viz-4: #EF4444;                   /* Red */
  --viz-5: #8B5CF6;                   /* Purple */
  --viz-6: #EC4899;                   /* Pink */
  --viz-7: #06B6D4;                   /* Cyan */
  --viz-8: #F97316;                   /* Orange */

  /* Sequential — for heatmaps and density (dark low → bright high) */
  --seq-1: #1A1E27;
  --seq-2: #1E3A5F;
  --seq-3: #2563EB;
  --seq-4: #3B82F6;
  --seq-5: #60A5FA;
  --seq-6: #93C5FD;

  /* Diverging — for comparison (negative ← neutral → positive) */
  --div-negative: #EF4444;
  --div-neutral: #2C3240;
  --div-positive: #22C55E;

  /* === LIGHT MODE (accessible alternative) === */
  /* Toggle via `data-theme="light"` on <html> */
}

[data-theme="light"] {
  --surface-ground: #F5F6F8;
  --surface-base: #FFFFFF;
  --surface-raised: #F0F1F4;
  --surface-overlay: #FFFFFF;
  --surface-elevated: #E8E9ED;
  --text-primary: #111827;
  --text-secondary: #4B5563;
  --text-tertiary: #9CA3AF;
  --border-subtle: #E5E7EB;
  --border-default: #D1D5DB;
  --border-emphasis: #9CA3AF;
}
```

### Typography

**Font stack — chosen for global script support, readability at data-dense sizes, and distinctive character:**

```css
:root {
  /* Display / headings — DM Sans: geometric, modern, friendly without being casual */
  --font-display: 'DM Sans', 'Noto Sans Arabic', 'Noto Sans Devanagari', system-ui, sans-serif;

  /* Body / data — IBM Plex Sans: designed for data-heavy UIs, excellent tabular figures */
  --font-body: 'IBM Plex Sans', 'Noto Sans Arabic', 'Noto Sans Devanagari', system-ui, sans-serif;

  /* Monospace / code / numbers in tables — IBM Plex Mono */
  --font-mono: 'IBM Plex Mono', 'Fira Code', monospace;

  /* Type scale — uses clamp() for fluid sizing */
  --text-xs: clamp(0.625rem, 0.6rem + 0.125vw, 0.75rem);     /* 10-12px */
  --text-sm: clamp(0.75rem, 0.725rem + 0.125vw, 0.875rem);    /* 12-14px */
  --text-base: clamp(0.875rem, 0.85rem + 0.125vw, 1rem);      /* 14-16px */
  --text-lg: clamp(1rem, 0.95rem + 0.25vw, 1.25rem);          /* 16-20px */
  --text-xl: clamp(1.25rem, 1.15rem + 0.5vw, 1.75rem);        /* 20-28px */
  --text-2xl: clamp(1.5rem, 1.3rem + 1vw, 2.5rem);            /* 24-40px */
  --text-3xl: clamp(2rem, 1.6rem + 2vw, 4rem);                /* 32-64px */
}
```

### Spacing & Layout

```css
:root {
  /* 4px base unit */
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */

  /* Border radius */
  --radius-sm: 0.375rem;  /* 6px — inputs, small cards */
  --radius-md: 0.5rem;    /* 8px — cards, panels */
  --radius-lg: 0.75rem;   /* 12px — modals, large containers */
  --radius-full: 9999px;  /* Pills, avatars */

  /* Shadows — subtle, layered for depth */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.3), 0 2px 4px -2px rgba(0,0,0,0.2);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.3), 0 4px 6px -4px rgba(0,0,0,0.2);
  --shadow-glow: 0 0 20px rgba(59,130,246,0.15); /* For focused/active states */
}
```

### Component Patterns

All components MUST follow these patterns:

**Cards (the primary data container):**
```tsx
// Every card follows this anatomy:
<div className="bg-surface-raised border border-border-subtle rounded-md overflow-hidden">
  {/* Card header — always has bottom border */}
  <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
    <h3 className="text-sm font-medium text-text-primary">{title}</h3>
    <div className="flex items-center gap-2">{/* actions */}</div>
  </div>
  {/* Card body */}
  <div className="p-4">{children}</div>
</div>
```

**Data tables:**
- Use monospace font for numerical columns (`font-mono tabular-nums`)
- Right-align numerical columns
- Sticky headers on scroll
- Zebra striping via `even:bg-surface-base`
- Row hover: `hover:bg-surface-elevated`
- Always include a "last updated" timestamp in table header

**Status indicators:**
- Green dot + "Healthy" for signal-healthy
- Amber triangle + "Caution" for signal-caution
- Red circle + "Alert" for signal-danger
- Always pair color with icon/text (never color-only — accessibility)

**Loading states:**
- Skeleton animations using `animate-pulse` with surface-raised → surface-elevated gradient
- Never show empty containers — always skeleton or "No data available" with explanation

### Accessibility Requirements (Non-Negotiable)

- **WCAG 2.1 AA minimum** — all contrast ratios must pass
- **Keyboard navigation** — every interactive element focusable, visible focus rings (`ring-2 ring-accent-trust ring-offset-2 ring-offset-surface-base`)
- **Screen reader** — all charts have `aria-label` with textual summary of data
- **Reduced motion** — respect `prefers-reduced-motion` media query; disable all animations
- **RTL** — use logical properties everywhere (`ms-4` not `ml-4`, `ps-4` not `pl-4`, `text-start` not `text-left`)
- **Color-blind safe** — never use color as the sole differentiator; always pair with shape/icon/text
- **Font scaling** — all text in `rem`; layout must not break at 200% zoom

### Responsive Breakpoints

```
sm: 640px   — Mobile landscape
md: 768px   — Tablet portrait
lg: 1024px  — Tablet landscape / small desktop
xl: 1280px  — Desktop
2xl: 1536px — Large desktop / command center displays
```

The dashboard is designed **desktop-first** (command center pattern) but the public-facing pages (landing, org profiles, about) are **mobile-first**.

### Motion & Animation

```css
/* Standardized transitions */
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-base: 250ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-slow: 350ms cubic-bezier(0.4, 0, 0.2, 1);

/* Entry animations — staggered reveals for command center panels */
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Chart data transitions — smooth number counting */
@keyframes countUp {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
```

All animations must be wrapped in:
```css
@media (prefers-reduced-motion: no-preference) { ... }
```

---

## 6. Agent Roles & Coordination

This project is built by a team of specialized Claude Code agents. Each agent owns a specific domain and communicates via the shared type system and this document.

### Agent 1: "Foundation" — Infrastructure & Database

**Owns:** `packages/db/`, `packages/config/`, `packages/types/`, root config files, Supabase setup, deployment scripts

**Responsibilities:**
- Initialize the Turborepo monorepo with pnpm workspaces
- Set up Supabase project (CLI: `supabase init`, `supabase db push`)
- Write all SQL migrations in `packages/db/supabase/migrations/`
- Define Drizzle ORM schemas matching migrations
- Generate TypeScript types from database schema
- Set up Row Level Security policies
- Configure environment variables with zod validation
- Write `docker-compose.yml` for local development
- Create deployment scripts for Vercel CLI and Railway CLI
- Set up GitHub Actions CI/CD workflows

**Key constraints:**
- All migrations must be idempotent (use `IF NOT EXISTS`)
- Enable pgvector, PostGIS, pg_trgm, pg_cron extensions in first migration
- All tables need `created_at`, `updated_at` timestamps with triggers
- Use `gen_random_uuid()` for primary keys
- Include comprehensive seed data for development (at least 50 orgs across 5 countries)

### Agent 2: "Atlas" — Frontend Dashboard

**Owns:** `apps/web/`, `packages/ui/`

**Responsibilities:**
- Build the Next.js 15 application with App Router
- Implement the complete Clarity design system in Tailwind
- Build all shared UI components in `packages/ui/`
- Implement all dashboard views (Command Center, Explorer, Flows, Investigation, Alerts)
- Build the public-facing pages (Landing, About, Org Profiles, API Docs)
- Set up next-intl for i18n with initial English strings
- Implement Supabase Auth integration (email + magic link)
- Set up tRPC client and TanStack Query
- Build all chart components (ECharts wrappers, D3 custom viz)
- Build map components (MapLibre + deck.gl)
- Implement dark/light theme toggle
- Ensure full accessibility compliance
- Implement CommandPalette (Cmd+K) for global search

**Key constraints:**
- Use React Server Components by default; `'use client'` only when needed (interactivity, hooks)
- All chart components must include an `aria-label` text summary fallback
- Every page must work without JavaScript (graceful degradation for SSR content)
- Use `next/image` for all images with appropriate `sizes` and `priority`
- No hardcoded strings — all user-facing text through next-intl
- Pages must achieve Lighthouse scores: Performance ≥90, Accessibility 100, Best Practices ≥95

### Agent 3: "Conduit" — API Layer

**Owns:** `apps/api/`, tRPC routers in `apps/web/app/api/`

**Responsibilities:**
- Define tRPC routers for internal frontend consumption
- Build Hono public REST API with OpenAPI 3.1 spec generation
- Implement authentication middleware (Supabase JWT verification)
- Implement rate limiting (Upstash Redis or in-memory for MVP)
- Build API key management for public API consumers
- Define Zod schemas for all request/response types
- Implement pagination (cursor-based for large datasets)
- Build search endpoint with full-text search (pg_trgm + tsvector)
- Implement data export endpoints (CSV, JSON)

**Key constraints:**
- All endpoints must return consistent error format: `{ error: { code: string, message: string, details?: unknown } }`
- Pagination must use cursor-based approach (not offset) for performance
- Public API must be versioned (`/v1/`)
- Rate limits: 100 requests/minute for anonymous, 1000/minute for authenticated
- All list endpoints must support `?fields=` sparse fieldsets
- Generate OpenAPI 3.1 spec automatically from Hono route definitions

### Agent 4: "Sentinel" — ML & Analysis Engine

**Owns:** `services/ml-api/`, `packages/analytics/`

**Responsibilities:**
- Build FastAPI service with anomaly detection endpoints
- Implement Isolation Forest model for financial ratio anomalies
- Implement Benford's Law analysis (both Python service and isomorphic JS package)
- Build Splink entity resolution pipeline
- Implement LangGraph multi-agent system (Filing Parser, Financial Analyst, Network Investigator, Claims Verifier, Report Generator)
- Build embedding generation service (for pgvector)
- Implement financial ratio calculations and peer benchmarking
- Build the transparency/health scoring algorithm
- Write Dockerfile for Railway deployment

**Key constraints:**
- FastAPI service must be stateless — all state in Supabase
- Use Pydantic v2 for all request/response models
- LLM calls must use tiered strategy: small models for classification, large for generation
- All scoring algorithms must be fully documented with mathematical notation in `apps/docs/`
- Entity resolution confidence thresholds must be configurable via environment variables
- Include health check endpoint at `/health`
- Service must start in <30 seconds

### Agent 5: "Harvester" — Data Pipeline & Scraping

**Owns:** `services/pipeline/`

**Responsibilities:**
- Build Dagster assets for all bulk-download data sources (IRS 990, UK Charity Commission, Canada CRA, Australia ACNC, IATI, OCHA FTS, OECD DAC)
- Build Scrapy spiders for structured web sources
- Build Playwright scrapers for JavaScript-heavy portals (India FCRA, GCC ministry sites)
- Implement data normalization pipeline (raw → parsed → curated)
- Build change detection and incremental update logic
- Implement data quality validation checks
- Store raw data in Supabase Storage, parsed data in PostgreSQL
- Write Dockerfile for Railway deployment

**Key constraints:**
- All scrapers must respect robots.txt and implement minimum 2-second delays
- Store raw HTML/PDF/JSON in Supabase Storage with metadata (source URL, fetch timestamp, HTTP headers)
- Scrapers must be idempotent — re-running should not create duplicates
- Use content hashing (SHA-256) to detect changes between scrape runs
- Dagster assets must have clear dependencies and be individually materializable
- Log all scrape runs with success/failure counts to a `scrape_runs` table
- Include circuit breaker pattern for sources that become temporarily unavailable

### Agent Coordination Protocol

1. **Types are the contract.** All agents share types through `packages/types/`. Any type change must be backward-compatible or coordinated across agents.

2. **Database schema is authoritative.** `packages/db/` migrations are the source of truth. The Drizzle schema must match exactly. TypeScript types must be generated from the schema.

3. **API routes are the interface.** Frontend (Atlas) and backend (Conduit) agents coordinate through tRPC router type signatures. ML service (Sentinel) exposes a documented REST API that Conduit calls.

4. **Environment variables are centralized.** All env vars are defined in `packages/config/src/env.ts` with zod validation. No agent should introduce env vars without adding them here.

5. **Feature flags.** Use a simple `features.ts` config for enabling/disabling data sources, analysis features, and UI experiments. No complex feature flag service needed at MVP.

---

## 7. Database Schema

### Core Entity Model

```sql
-- Enable extensions (migration 00001)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";          -- pgvector
CREATE EXTENSION IF NOT EXISTS "postgis";         -- geospatial
CREATE EXTENSION IF NOT EXISTS "pg_trgm";         -- fuzzy text search
CREATE EXTENSION IF NOT EXISTS "pg_cron";         -- scheduled jobs

-- ==========================================
-- ORGANIZATIONS — the central entity
-- ==========================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name TEXT NOT NULL,
  name_local TEXT,                                 -- Name in local language/script
  slug TEXT UNIQUE NOT NULL,                       -- URL-friendly identifier
  aliases TEXT[] DEFAULT '{}',                     -- Alternative names

  -- Classification
  org_type TEXT NOT NULL CHECK (org_type IN (
    'charity', 'foundation', 'ngo', 'nonprofit', 'association',
    'trust', 'cooperative', 'social_enterprise', 'religious', 'other'
  )),
  sector TEXT,                                     -- NTEE or ICNPO classification
  subsector TEXT,
  mission TEXT,                                    -- Mission statement
  description TEXT,

  -- Registration
  country_code TEXT NOT NULL,                      -- ISO 3166-1 alpha-2
  jurisdiction TEXT,                               -- State/province/region
  registry_source TEXT NOT NULL,                   -- e.g. 'us_irs', 'uk_charity_commission'
  registry_id TEXT NOT NULL,                       -- ID within source registry (EIN, charity number, etc.)
  registration_date DATE,
  dissolution_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'dissolved', 'suspended', 'unknown')),

  -- Contact & location
  website TEXT,
  email TEXT,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state_province TEXT,
  postal_code TEXT,
  location GEOGRAPHY(POINT, 4326),                 -- PostGIS point for mapping

  -- Metadata
  logo_url TEXT,
  last_filing_date DATE,
  data_completeness REAL DEFAULT 0,                -- 0-1 score of how complete our data is
  embedding VECTOR(1536),                          -- For semantic search

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(registry_source, registry_id)
);

-- Indexes
CREATE INDEX idx_org_country ON organizations(country_code);
CREATE INDEX idx_org_status ON organizations(status);
CREATE INDEX idx_org_name_trgm ON organizations USING gin(name gin_trgm_ops);
CREATE INDEX idx_org_slug ON organizations(slug);
CREATE INDEX idx_org_location ON organizations USING gist(location);
CREATE INDEX idx_org_embedding ON organizations USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);

-- Full-text search
ALTER TABLE organizations ADD COLUMN search_vector TSVECTOR
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(mission, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) STORED;
CREATE INDEX idx_org_search ON organizations USING gin(search_vector);

-- ==========================================
-- PEOPLE — directors, trustees, officers
-- ==========================================
CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,                   -- Lowercased, stripped of honorifics
  entity_cluster_id UUID,                          -- Links resolved duplicates (Splink output)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE organization_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  person_id UUID REFERENCES people(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                              -- 'director', 'trustee', 'officer', 'ceo', 'cfo', etc.
  title TEXT,                                      -- Exact reported title
  compensation NUMERIC(15,2),
  currency TEXT DEFAULT 'USD',
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT true,
  filing_year INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- FINANCIALS — annual financial data
-- ==========================================
CREATE TABLE financial_filings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Period
  fiscal_year INTEGER NOT NULL,
  period_start DATE,
  period_end DATE,
  filing_type TEXT,                                -- '990', '990-EZ', '990-PF', 'annual_return', etc.

  -- Revenue
  total_revenue NUMERIC(15,2),
  contributions_grants NUMERIC(15,2),
  program_service_revenue NUMERIC(15,2),
  investment_income NUMERIC(15,2),
  other_revenue NUMERIC(15,2),

  -- Expenses
  total_expenses NUMERIC(15,2),
  program_expenses NUMERIC(15,2),
  admin_expenses NUMERIC(15,2),
  fundraising_expenses NUMERIC(15,2),

  -- Balance sheet
  total_assets NUMERIC(15,2),
  total_liabilities NUMERIC(15,2),
  net_assets NUMERIC(15,2),

  -- Computed ratios (denormalized for query performance)
  program_expense_ratio REAL,                      -- program_expenses / total_expenses
  admin_expense_ratio REAL,
  fundraising_efficiency REAL,                     -- fundraising_expenses / contributions_grants
  working_capital_ratio REAL,

  -- Currency and source
  currency TEXT DEFAULT 'USD',
  currency_original TEXT,                          -- Original filing currency
  exchange_rate REAL,                              -- Rate used for conversion
  source_url TEXT,                                 -- Link to original filing
  raw_filing_key TEXT,                             -- Supabase Storage key for raw filing

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, fiscal_year, filing_type)
);

-- ==========================================
-- GRANTS & FLOWS — money movement
-- ==========================================
CREATE TABLE grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funder_org_id UUID REFERENCES organizations(id),
  recipient_org_id UUID REFERENCES organizations(id),
  recipient_name TEXT,                             -- When recipient isn't in our DB
  recipient_country TEXT,

  amount NUMERIC(15,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  amount_usd NUMERIC(15,2),                       -- Normalized to USD

  grant_date DATE,
  fiscal_year INTEGER,
  purpose TEXT,
  program_area TEXT,
  grant_type TEXT,                                 -- 'general_support', 'project', 'capital', 'endowment', etc.

  source TEXT NOT NULL,                            -- 'irs_990_schedule_i', '360giving', 'iati', etc.
  source_id TEXT,                                  -- ID within source dataset

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source, source_id)
);

CREATE INDEX idx_grants_funder ON grants(funder_org_id);
CREATE INDEX idx_grants_recipient ON grants(recipient_org_id);
CREATE INDEX idx_grants_year ON grants(fiscal_year);
CREATE INDEX idx_grants_amount ON grants(amount_usd);

-- ==========================================
-- ANALYSIS — AI-generated insights
-- ==========================================
CREATE TABLE anomaly_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  fiscal_year INTEGER,

  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'overhead_manipulation', 'related_party', 'compensation_outlier',
    'revenue_expense_mismatch', 'benford_violation', 'network_anomaly',
    'filing_inconsistency', 'geographic_discrepancy', 'zero_fundraising',
    'rapid_growth', 'shell_indicator', 'other'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  confidence REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),

  title TEXT NOT NULL,
  description TEXT NOT NULL,                       -- Plain-language explanation
  evidence JSONB NOT NULL DEFAULT '{}',            -- Structured evidence data
  methodology TEXT NOT NULL,                       -- Which algorithm generated this

  is_reviewed BOOLEAN DEFAULT false,
  reviewed_by UUID,
  review_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE organization_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,

  -- Composite scores (0-100)
  overall_score REAL,
  financial_health_score REAL,
  transparency_score REAL,
  governance_score REAL,
  efficiency_score REAL,

  -- Score breakdown (JSONB for flexibility as methodology evolves)
  score_breakdown JSONB NOT NULL DEFAULT '{}',
  methodology_version TEXT NOT NULL DEFAULT 'v1',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, fiscal_year, methodology_version)
);

-- ==========================================
-- ENTITY RESOLUTION — cross-registry matching
-- ==========================================
CREATE TABLE entity_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_a_id UUID REFERENCES organizations(id),
  org_b_id UUID REFERENCES organizations(id),
  match_probability REAL NOT NULL,                 -- Splink probability
  match_type TEXT,                                 -- 'confirmed', 'probable', 'possible'
  matched_fields TEXT[],                           -- Which fields matched
  reviewed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_a_id, org_b_id)
);

-- ==========================================
-- DATA PROVENANCE — track all source data
-- ==========================================
CREATE TABLE scrape_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  spider_name TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  records_found INTEGER DEFAULT 0,
  records_new INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_log TEXT,
  metadata JSONB DEFAULT '{}'
);

-- ==========================================
-- USER & WORKSPACE (Supabase Auth integration)
-- ==========================================
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('viewer', 'analyst', 'admin')),
  preferences JSONB DEFAULT '{}',
  api_key_hash TEXT,                               -- For public API access
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE saved_investigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  query_state JSONB NOT NULL,                      -- Serialized investigation state
  organization_ids UUID[],                         -- Organizations in this investigation
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_filings ENABLE ROW LEVEL SECURITY;
ALTER TABLE grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_alerts ENABLE ROW LEVEL SECURITY;

-- Public data: everyone can read
CREATE POLICY "Public read access" ON organizations FOR SELECT USING (true);
CREATE POLICY "Public read access" ON financial_filings FOR SELECT USING (true);
CREATE POLICY "Public read access" ON grants FOR SELECT USING (true);
CREATE POLICY "Public read access" ON anomaly_alerts FOR SELECT USING (true);

-- Write access: service role only (backend services)
CREATE POLICY "Service write access" ON organizations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write access" ON financial_filings FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write access" ON grants FOR ALL USING (auth.role() = 'service_role');

-- User-specific data
CREATE POLICY "Users own profiles" ON user_profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users own investigations" ON saved_investigations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public investigations readable" ON saved_investigations FOR SELECT USING (is_public = true);
```

---

## 8. Data Sources & Ingestion

### Priority 1 — API-accessible sources (Phase 1)

| Source | Registry | Coverage | API | Format | Update Frequency |
|--------|----------|----------|-----|--------|------------------|
| IRS 990 (via GivingTuesday Data Lake) | US | 1.8M+ orgs | S3 bulk download | XML | Monthly |
| ProPublica Nonprofit Explorer | US | 1.8M+ orgs | REST (no auth) | JSON | Weekly |
| UK Charity Commission | England & Wales | ~170K charities | REST (API key) | JSON | Daily |
| OSCR | Scotland | ~25K charities | REST (beta) | JSON | Monthly |
| 360Giving GrantNav | UK grants | 200+ funders | PostgreSQL / JSON | JSON | Daily |
| IATI Datastore | International aid | ~1M activities | Solr REST | XML/JSON | Daily |
| UN OCHA FTS | Humanitarian | Global since 1992 | REST (no auth) | JSON | Daily |
| OECD DAC CRS | ODA flows | 31 DAC members | SDMX REST | CSV/Parquet | Quarterly |
| ACNC Register | Australia | ~60K charities | CKAN API | CSV | Weekly |
| CRA T3010 | Canada | ~87K charities | Bulk download | CSV | Bi-annual |
| France RNA | France | All associations | REST API | JSON | Daily |

### Priority 2 — Scraping-required sources (Phase 2)

| Source | Challenge Level | Method | Data Quality |
|--------|----------------|--------|--------------|
| India NGO Darpan | Medium | Scrapy | Low (self-declared, no financials) |
| India FCRA Portal | Hard | Playwright | Medium (aggregate data only) |
| India MCA (Section 8) | Hard | Playwright + PDF parse | Medium (paid per document) |
| Netherlands ANBI | Easy | Bulk Excel download | Medium (registration only) |
| Germany Vereinsregister | Hard | Per-court portals | Low (basic registration) |
| GCC Directories | Very Hard | Playwright + arabic OCR | Very Low (names/addresses only) |

### Data Normalization Pipeline

```
RAW (Supabase Storage)
  ↓ Preserve original format with metadata
PARSED (staging tables)
  ↓ Extract structured fields, validate types
NORMALIZED (core tables)
  ↓ Currency conversion, field mapping, deduplication
ENRICHED (analysis tables)
  ↓ Ratios computed, scores generated, embeddings created
INDEXED (search + vector)
  ↓ Full-text search vectors, embedding index updated
```

Every record maintains a provenance chain:
```
organizations.registry_source → scrape_runs.id → raw file in Supabase Storage
```

---

## 9. API Design

### Internal API (tRPC)

```typescript
// apps/web/server/routers/_app.ts
export const appRouter = router({
  organizations: router({
    search: publicProcedure
      .input(z.object({
        query: z.string().optional(),
        country: z.string().optional(),
        sector: z.string().optional(),
        status: z.enum(['active', 'inactive', 'dissolved']).optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(25),
      }))
      .query(/* ... */),

    getBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(/* ... */),

    getFinancials: publicProcedure
      .input(z.object({ orgId: z.string().uuid(), years: z.number().default(5) }))
      .query(/* ... */),

    getRelatedEntities: publicProcedure
      .input(z.object({ orgId: z.string().uuid() }))
      .query(/* ... */),

    getAlerts: publicProcedure
      .input(z.object({ orgId: z.string().uuid() }))
      .query(/* ... */),
  }),

  flows: router({
    getGrantFlows: publicProcedure
      .input(z.object({
        orgId: z.string().uuid().optional(),
        country: z.string().optional(),
        year: z.number().optional(),
        minAmount: z.number().optional(),
      }))
      .query(/* ... */),
  }),

  analysis: router({
    getAnomalyFeed: publicProcedure
      .input(z.object({
        severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        type: z.string().optional(),
        cursor: z.string().optional(),
        limit: z.number().default(20),
      }))
      .query(/* ... */),

    runBenfordAnalysis: protectedProcedure
      .input(z.object({ orgId: z.string().uuid() }))
      .mutation(/* ... */),
  }),

  investigations: router({
    list: protectedProcedure.query(/* ... */),
    create: protectedProcedure.input(/* ... */).mutation(/* ... */),
    update: protectedProcedure.input(/* ... */).mutation(/* ... */),
    delete: protectedProcedure.input(/* ... */).mutation(/* ... */),
  }),
});
```

### Public API (Hono + OpenAPI)

```
GET    /v1/organizations                     — Search organizations
GET    /v1/organizations/:slug               — Get organization details
GET    /v1/organizations/:slug/financials     — Get financial history
GET    /v1/organizations/:slug/grants         — Get grants given/received
GET    /v1/organizations/:slug/people         — Get officers/directors
GET    /v1/organizations/:slug/alerts         — Get anomaly alerts
GET    /v1/organizations/:slug/score          — Get transparency score

GET    /v1/flows                              — Query grant flows (Sankey data)
GET    /v1/flows/by-country                   — Aggregate flows by country pair

GET    /v1/alerts                             — Global anomaly feed
GET    /v1/alerts/stats                       — Aggregate alert statistics

GET    /v1/search                             — Full-text + semantic search
GET    /v1/registries                         — List available data sources
GET    /v1/registries/:source/status          — Data freshness for a source

GET    /v1/export/:format                     — Bulk export (CSV, JSON)

Headers:
  X-API-Key: <key>                            — Required for elevated rate limits
  Accept-Language: en|ar|hi|fr|es|de          — Response language preference
```

---

## 10. Frontend Application

### Page Architecture

#### Landing Page (`/`)
- Hero: animated globe visualization showing live donation flow lines between countries
- Headline: "Follow the money. Demand transparency."
- Search bar: immediate org search with typeahead
- Key stats: total orgs tracked, total $amount tracked, countries covered, alerts generated
- "How it works" section: 3 steps (Search → Analyze → Investigate)
- Featured investigations / recent anomalies
- CTA: "Explore the Dashboard" + "Get API Access"

#### Command Center (`/command-center`)
The primary dashboard view. Dense, Bloomberg-terminal inspired. Multi-panel layout:

```
┌─────────────────────────────────────────────────────────┐
│  HEADER: Search (Cmd+K) | Notifications | Theme | User │
├──────────┬──────────────────────────────────────────────┤
│          │  ┌─────────────┐ ┌─────────────┐            │
│  SIDEBAR │  │ GLOBAL MAP  │ │ TOP ALERTS  │            │
│          │  │ (deck.gl)   │ │ (feed)      │            │
│  - Cmd   │  └─────────────┘ └─────────────┘            │
│    Center│  ┌─────────────┐ ┌─────────────┐            │
│  - Explore  │ FLOW SANKEY │ │ STATS GRID  │            │
│  - Flows │  │ (ECharts)   │ │ (sparklines)│            │
│  - Invest│  └─────────────┘ └─────────────┘            │
│  - Alerts│  ┌─────────────────────────────┐            │
│          │  │ RECENT ACTIVITY TABLE       │            │
│          │  │ (new filings, score changes)│            │
│          │  └─────────────────────────────┘            │
└──────────┴──────────────────────────────────────────────┘
```

#### Entity Explorer (`/explore`)
- Faceted search with filters: country, sector, size, score range, date range
- Results as cards or table (toggleable)
- Each result shows: name, country flag, sector badge, latest revenue, score gauge, alert count
- Click → organization detail page

#### Organization Detail (`/explore/[slug]`)
- Header: org name, logo, country, status, registration IDs
- Score card: overall score with breakdown radar chart
- Financial timeline: multi-year revenue/expense line chart
- Expense breakdown: stacked bar chart (program/admin/fundraising)
- Officers & Directors: table with tenure, compensation
- Related entities: mini network graph
- Grants given/received: sortable table
- Anomaly alerts: chronological list with severity badges
- Raw filings: links to original source documents
- "Investigate" button → opens in Investigation Workbench

#### Flow Mapper (`/flows`)
- Full-screen Sankey diagram showing donation flows
- Controls: filter by country, year, sector, amount range
- Click node → drill into that entity
- Toggle: aggregate by country or show individual orgs
- Map overlay mode: flows rendered as arcs on geographic map

#### Investigation Workbench (`/investigate`)
- Persistent workspace for building investigations
- Drag & drop organizations onto a canvas
- Auto-generate network graph between selected entities
- Side panel: shared directors, addresses, grants between entities
- Timeline view: events across all selected entities
- Export: generate shareable investigation report (PDF)
- Save/load investigations to user account

#### Alerts Feed (`/alerts`)
- Real-time feed of anomaly detections
- Filter by: severity, type, country, date range
- Each alert: org name, alert type badge, severity indicator, confidence %, plain-language description
- Click → jumps to org detail with alert highlighted
- Subscribe: email notifications for specific alert types or organizations

### Key UI Components to Build

**Priority order for Agent 2 (Atlas):**

1. `CommandPalette` — Cmd+K global search modal
2. `DashboardShell` — sidebar nav + header + content area
3. `OrgCard` — compact organization summary card
4. `ScoreGauge` — circular gauge for 0-100 scores
5. `SankeyFlow` — ECharts Sankey wrapper with OpenGive styling
6. `NetworkGraph` — D3 force-directed graph for entity relationships
7. `GeoMap` — MapLibre + deck.gl with flow arcs and org markers
8. `FinancialTimeline` — multi-line chart for revenue/expenses over time
9. `ExpenseBreakdown` — stacked bar chart for expense categories
10. `AnomalyRadar` — radar chart for multi-dimensional anomaly visualization
11. `AlertCard` — compact alert display with severity and confidence
12. `DataTable` — sortable, filterable, paginated data table with sticky headers
13. `StatCard` — large number + sparkline + trend indicator
14. `CountryFlag` — inline flag emoji/SVG by country code
15. `ThemeToggle` — dark/light mode switch with system preference detection

---

## 11. AI Analysis Engine

### Scoring Methodology (v1)

The OpenGive Transparency Score is a composite 0-100 score computed from four pillars:

```
Overall Score = (0.35 × Financial Health) + (0.25 × Transparency) + (0.25 × Governance) + (0.15 × Efficiency)
```

**Financial Health (0-100):**
- Revenue trend (3-year) — growth vs. decline
- Working capital ratio — assets vs. liabilities
- Revenue diversification — Herfindahl index of revenue sources
- Cash reserve months — net assets / monthly expenses

**Transparency (0-100):**
- Filing completeness — % of expected fields populated
- Filing timeliness — days between fiscal year end and filing date
- Audit status — independent audit vs. self-reported
- Data availability — do we have multi-year history?

**Governance (0-100):**
- Board size adequacy — between 5-25 is optimal
- Board independence — % non-compensated directors
- Officer disclosure — named officers with titles
- Conflict of interest policy — disclosed on filing

**Efficiency (0-100):**
- Program expense ratio — higher is better (benchmark: >75%)
- Fundraising efficiency — lower is better (benchmark: <$0.25 per $1 raised)
- Admin expense ratio — lower is better (benchmark: <15%)
- Joint cost flag — penalize if joint costs exceed 20% of total expenses

All thresholds, weights, and benchmarks are documented in `apps/docs/docs/methodology.md` and configurable via `packages/config/src/scoring.ts`.

### Anomaly Detection Rules

```python
# services/ml-api/app/models/anomaly.py

ANOMALY_RULES = {
    "zero_fundraising": {
        "condition": "fundraising_expenses == 0 AND contributions_grants > 500000",
        "severity": "high",
        "description": "Organization reports zero fundraising costs despite receiving over $500K in contributions"
    },
    "overhead_flip": {
        "condition": "year_over_year admin_expense_ratio change > 20 percentage points",
        "severity": "medium",
        "description": "Dramatic shift in administrative expense ratio suggests reclassification"
    },
    "compensation_outlier": {
        "condition": "ceo_compensation > 2x peer_median AND total_revenue < $5M",
        "severity": "high",
        "description": "Executive compensation significantly exceeds peer benchmarks relative to organization size"
    },
    "benford_violation": {
        "condition": "benford_chi_squared p_value < 0.01",
        "severity": "medium",
        "description": "Financial figures do not follow expected digit distribution patterns"
    },
    "shell_indicator": {
        "condition": "shared_address_count > 3 AND shared_director_count > 2",
        "severity": "critical",
        "description": "Organization shares address and directors with multiple other entities"
    },
    "revenue_cliff": {
        "condition": "year_over_year total_revenue decline > 50%",
        "severity": "medium",
        "description": "Sudden and dramatic revenue decline may indicate organizational distress"
    }
}
```

---

## 12. Scraping Pipeline

### Dagster Asset DAG

```
                ┌──────────────┐
                │   Schedule   │
                │  (pg_cron)   │
                └──────┬───────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │  US IRS  │  │  UK CC   │  │   IATI   │  ... (one asset per source)
  │  990s    │  │  API     │  │  Dstore  │
  └────┬─────┘  └────┬─────┘  └────┬─────┘
       │              │              │
       ▼              ▼              ▼
  ┌──────────────────────────────────────┐
  │         RAW → Supabase Storage       │
  │      (HTML, XML, JSON, PDF)          │
  └──────────────────┬───────────────────┘
                     │
                     ▼
  ┌──────────────────────────────────────┐
  │        PARSE → Staging Tables        │
  │   (Extract structured fields)        │
  └──────────────────┬───────────────────┘
                     │
                     ▼
  ┌──────────────────────────────────────┐
  │      NORMALIZE → Core Tables         │
  │  (Currency convert, deduplicate,     │
  │   entity resolve, compute ratios)    │
  └──────────────────┬───────────────────┘
                     │
                     ▼
  ┌──────────────────────────────────────┐
  │       ANALYZE → Analysis Tables      │
  │  (Score, detect anomalies,           │
  │   generate embeddings)               │
  └──────────────────────────────────────┘
```

---

## 13. Deployment & Infrastructure

### Vercel (Frontend + API)

```bash
# Deploy from apps/web/
cd apps/web
vercel --prod

# Environment variables to set in Vercel:
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ML_API_URL=                          # Railway ML service URL
NEXT_PUBLIC_MAPLIBRE_STYLE_URL=      # MapLibre style JSON URL
```

Vercel configuration (`apps/web/vercel.json`):
```json
{
  "buildCommand": "cd ../.. && pnpm turbo build --filter=web",
  "installCommand": "cd ../.. && pnpm install",
  "framework": "nextjs",
  "regions": ["iad1"],
  "crons": []
}
```

### Supabase

```bash
# Initialize
supabase init
supabase link --project-ref <project-id>
supabase db push

# Key settings:
# - Enable pgvector, PostGIS, pg_trgm, pg_cron in dashboard
# - Set up Storage buckets: 'raw-filings', 'parsed-data', 'org-logos'
# - Configure Auth: enable email + magic link providers
# - Set up Edge Functions if needed for webhooks
```

### Railway (ML Service + Pipeline)

```bash
# services/ml-api/railway.toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "./Dockerfile"

[deploy]
startCommand = "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3

# services/pipeline/railway.toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "./Dockerfile"

[deploy]
startCommand = "dagster dev -h 0.0.0.0 -p $PORT"
```

Railway environment variables:
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=                        # Direct PostgreSQL connection string
ANTHROPIC_API_KEY=                   # For AI agents
OPENAI_API_KEY=                      # Backup LLM provider
```

### Domain & DNS

```
opengive.org (or .io)
├── @ → Vercel (main app)
├── api.opengive.org → Vercel (public API, via rewrite or separate deployment)
├── docs.opengive.org → Vercel (Docusaurus)
└── ml.opengive.org → Railway (ML API, internal only)
```

---

## 14. Coding Standards

### TypeScript (Frontend + API)

- **Strict mode** — `"strict": true` in all tsconfigs
- **No `any`** — use `unknown` and narrow with type guards
- **Prefer `interface`** over `type` for object shapes (better error messages, extendable)
- **Zod for runtime validation** — every external input validated
- **Named exports only** — no default exports (better refactoring, grep-ability)
- **File naming:** `kebab-case.ts` for utilities, `PascalCase.tsx` for components
- **Component pattern:**

```tsx
// packages/ui/src/primitives/Button.tsx
import { type VariantProps, cva } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-trust disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-accent-trust text-white hover:bg-accent-trust/90',
        secondary: 'bg-surface-elevated text-text-primary hover:bg-surface-overlay',
        ghost: 'hover:bg-surface-elevated text-text-secondary hover:text-text-primary',
        danger: 'bg-signal-danger text-white hover:bg-signal-danger/90',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export function Button({ variant, size, isLoading, className, children, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} disabled={isLoading} {...props}>
      {isLoading ? <Spinner className="me-2 h-4 w-4" /> : null}
      {children}
    </button>
  );
}
```

### Python (ML + Pipeline)

- **Python 3.11+** — use modern syntax (match statements, `Self` type, `type` aliases)
- **Pydantic v2** — all models use `BaseModel` with `model_config`
- **Ruff** for linting and formatting (replaces black + isort + flake8)
- **Type hints on all function signatures** — use `from __future__ import annotations`
- **Async by default** — FastAPI endpoints are `async def`
- **No print statements** — use `structlog` for structured logging
- **Docstrings** — Google style on all public functions

### Git Conventions

- **Commit messages:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`)
- **Branch naming:** `feat/short-description`, `fix/issue-number-description`
- **PR titles:** same as commit convention
- **Squash merge** to main
- **No force pushes** to main

---

## 15. Testing Strategy

### Frontend

- **Vitest** for unit tests (fast, Vite-native)
- **React Testing Library** for component tests
- **Playwright** for E2E tests (critical paths only)
- **Storybook** for visual testing of all UI components

Required test coverage for `packages/ui/`: >80%
Required E2E tests: search flow, org detail page, authentication, investigation save/load

### Backend

- **Vitest** for tRPC router tests (with MSW for mocking)
- **Supertest** for Hono API integration tests
- **pytest** for Python services
- **Dagster's built-in testing** for asset/job tests

### Data Quality

- **Great Expectations** or custom validation for data pipeline outputs
- Checks: null rates, type conformity, value ranges, referential integrity, freshness

---

## 16. Open Source & Community

### README.md Structure

```markdown
# OpenGive 🌍
> Follow the money. Demand transparency.

[Badge: License] [Badge: CI] [Badge: Contributors] [Badge: Discord]

## What is OpenGive?
One paragraph.

## Quick Start
docker compose up → open localhost:3000

## Architecture
Link to docs.

## Contributing
Link to CONTRIBUTING.md.

## Data Sources
Table of currently supported registries.

## License
Apache 2.0
```

### CONTRIBUTING.md Highlights

- One-command setup: `./scripts/setup.sh`
- "Good First Issue" labels for newcomers
- Data source requests via issue template
- Code review required from one maintainer
- All discussions in GitHub Discussions (not Slack/Discord initially)

---

## 17. Phase Plan

### Phase 1 — Foundation (Weeks 1-4) ← **BUILD THIS FIRST**

**Goal:** Monorepo scaffold, database, core UI shell, US + UK data ingestion, basic search and org detail pages live on Vercel.

- [ ] Foundation agent: monorepo init, Supabase schema, seed data, deploy scripts
- [ ] Atlas agent: Next.js app, design system, DashboardShell, landing page, search, org detail
- [ ] Conduit agent: tRPC routers for organizations, financials, search
- [ ] Harvester agent: ProPublica API ingest, UK Charity Commission API ingest
- [ ] Deploy: Vercel (web), Supabase (db), Railway (placeholder for ML)

**Deliverable:** Live site with ~2M searchable organizations (US + UK), basic financial data, public org profiles.

### Phase 2 — Visualization (Weeks 5-8)

- Command Center dashboard with all panels
- Sankey flow visualization (360Giving + IATI data)
- Geographic map with org markers and flow arcs
- Additional data sources: Canada, Australia, France, IATI, OCHA FTS
- Entity resolution (Splink) — first pass matching US/UK entities

### Phase 3 — Intelligence (Weeks 9-12)

- FastAPI ML service deployed to Railway
- Anomaly detection pipeline (Isolation Forest + rules)
- Benford's Law screening
- Transparency scoring algorithm (v1)
- Alerts feed
- Investigation Workbench (save/load investigations)

### Phase 4 — Scale & Community (Weeks 13-16)

- India data sources (NGO Darpan, FCRA scraping)
- GCC directory scraping (best-effort)
- LangGraph AI agents (Filing Parser, Report Generator)
- Network graph analysis
- Public API launch with API key management
- Documentation site (Docusaurus)
- Community onboarding: CONTRIBUTING.md, issue templates, discussion forums

---

## 18. Glossary

| Term | Definition |
|------|-----------|
| **990** | IRS Form 990, the annual tax filing for US nonprofit organizations |
| **Benford's Law** | Statistical law predicting the frequency of leading digits in naturally occurring datasets; deviations may indicate fabrication |
| **CCEW** | Charity Commission for England and Wales |
| **Entity Resolution** | The process of determining that two records in different databases refer to the same real-world entity |
| **FCRA** | Foreign Contribution Regulation Act (India) — governs foreign donations to Indian NGOs |
| **IATI** | International Aid Transparency Initiative — global standard for publishing development aid data |
| **Joint Costs** | Expenses shared between program and fundraising activities; a common vector for overhead manipulation |
| **NTEE** | National Taxonomy of Exempt Entities — classification system for US nonprofits |
| **OSCR** | Office of the Scottish Charity Regulator |
| **Program Expense Ratio** | Program expenses ÷ total expenses; measures what % of spending goes to mission |
| **RLS** | Row Level Security — PostgreSQL feature for access control at the row level |
| **Sankey Diagram** | Flow diagram where the width of arrows represents the quantity of flow |
| **Splink** | Open-source Python library for probabilistic record linkage |
| **SORP** | Statement of Recommended Practice — UK charity accounting standard |
| **360Giving** | UK open data standard for grant-making data |

---

## Environment Variables Reference

```bash
# === SUPABASE ===
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres

# === VERCEL ===
VERCEL_URL=                          # Auto-set by Vercel

# === RAILWAY ML SERVICE ===
ML_API_URL=https://ml-api-xxx.railway.app
ML_API_SECRET=                       # Shared secret for service-to-service auth

# === EXTERNAL APIS ===
UK_CHARITY_COMMISSION_API_KEY=
ANTHROPIC_API_KEY=                   # For AI agents (Claude)
OPENAI_API_KEY=                      # Backup / embeddings

# === MAPS ===
NEXT_PUBLIC_MAPLIBRE_STYLE_URL=https://demotiles.maplibre.org/style.json

# === FEATURE FLAGS ===
FEATURE_AI_ANALYSIS=false            # Enable AI analysis features
FEATURE_INVESTIGATION_WORKBENCH=false
FEATURE_PUBLIC_API=false
```

---

**This document is the single source of truth. When in doubt, follow CLAUDE.md.**
**When CLAUDE.md is ambiguous, ask — don't guess.**
