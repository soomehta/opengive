# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenGive is an open-source global charity accountability dashboard that aggregates public charity data from 30+ national registries, applies AI-powered forensic analysis, and visualizes money flows. Licensed under Apache 2.0.

The full PRD with database schema, API contracts, design system tokens, agent roles, and data source details is in `PRD.md` — read it before making architectural decisions.

## Architecture

**Turborepo monorepo with pnpm workspaces.** Three layers:

- **Frontend (Next.js 15, App Router)** — deployed to Vercel. Uses tRPC internally, Hono for public REST API. State: Zustand + TanStack Query. Styling: Tailwind CSS v4 + Radix UI. Charts: ECharts + D3. Maps: MapLibre GL JS + deck.gl. i18n: next-intl.
- **Data Layer (Supabase)** — PostgreSQL 15 with pgvector, PostGIS, pg_trgm, pg_cron. Supabase Auth, Storage, Realtime.
- **ML/Pipeline (Railway)** — FastAPI ML service + Dagster orchestration + Scrapy/Playwright scrapers. AI agents via LangGraph. Entity resolution via Splink.

## Monorepo Layout

```
apps/web/          — Next.js 15 dashboard (App Router)
apps/api/          — Standalone Hono public API
apps/docs/         — Docusaurus documentation
packages/ui/       — Shared component library (Radix + CVA + Tailwind)
packages/db/       — Supabase migrations, Drizzle ORM schema, query builders
packages/config/   — Validated env vars (zod), registry definitions, constants
packages/types/    — Shared TypeScript types (the inter-agent contract)
packages/analytics/ — Isomorphic scoring/ratio/Benford logic
services/ml-api/   — FastAPI ML service (anomaly detection, embeddings, entity resolution, LangGraph agents)
services/pipeline/ — Dagster assets + Scrapy spiders + Playwright scrapers
scripts/           — setup.sh, seed-dev.ts, deploy scripts, migrate.sh
```

## Build & Dev Commands

```bash
pnpm install                          # Install all dependencies
pnpm turbo build                      # Build all packages
pnpm turbo build --filter=web         # Build only the web app
pnpm turbo dev                        # Dev server for all apps
pnpm turbo dev --filter=web           # Dev server for web app only
pnpm turbo lint                       # Lint all packages
pnpm turbo test                       # Run all tests

# Database
supabase db push                      # Apply migrations
./scripts/migrate.sh                  # Run Supabase migrations
pnpm --filter=@opengive/db generate   # Generate TS types from schema

# Python services (from services/ml-api/ or services/pipeline/)
uvicorn app.main:app --reload         # ML API dev server
dagster dev                           # Dagster UI + scheduler

# Deployment
vercel --prod                         # Deploy web (from apps/web/)
railway up                            # Deploy ML/pipeline services

# Local stack
docker compose up                     # Full local development environment
./scripts/setup.sh                    # One-command local setup
```

## Testing

- **Frontend/API:** Vitest + React Testing Library. Run: `pnpm turbo test`, single test: `pnpm vitest run path/to/test`
- **E2E:** Playwright (critical paths only)
- **UI components:** Storybook for visual testing. `packages/ui/` requires >80% coverage.
- **Python:** pytest. Run: `pytest` from `services/ml-api/` or `services/pipeline/`
- **Pipeline:** Dagster's built-in asset testing

## Coding Standards

### TypeScript
- Strict mode, no `any` (use `unknown` + type guards)
- Prefer `interface` over `type` for object shapes
- Named exports only (no default exports)
- File naming: `kebab-case.ts` for utilities, `PascalCase.tsx` for components
- Zod for all runtime validation of external inputs
- React Server Components by default; `'use client'` only when needed
- All user-facing strings through next-intl (no hardcoded strings)
- Use logical CSS properties for RTL support (`ms-4` not `ml-4`, `ps-4` not `pl-4`, `text-start` not `text-left`)
- Components use CVA (class-variance-authority) for variant styling

### Python
- Python 3.11+, Pydantic v2, Ruff for linting/formatting
- Async by default for FastAPI endpoints
- structlog for logging (no print statements)
- Type hints on all function signatures

### Git
- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- Branch naming: `feat/short-description`, `fix/issue-number-description`
- Squash merge to main

## Key Design Decisions

- **Design system "Clarity"**: dark-first, editorial intelligence aesthetic. Colors are semantic (never decorative). All design tokens are CSS custom properties defined in `PRD.md` section 5.
- **Accessibility**: WCAG 2.1 AA minimum. Color-blind safe (always pair color with icon/text). Keyboard navigable. Screen-reader summaries on all charts. `prefers-reduced-motion` respected.
- **Dashboard is desktop-first**, public pages are mobile-first.
- **Cursor-based pagination** (not offset) for all list endpoints.
- **API error format**: `{ error: { code: string, message: string, details?: unknown } }`
- **Public API versioned** at `/v1/`, rate limited: 100 req/min anon, 1000/min authenticated.
- **Database migrations must be idempotent** (`IF NOT EXISTS`). All tables have `created_at`/`updated_at` with triggers. UUIDs via `gen_random_uuid()`.
- **Scrapers** must respect robots.txt, 2s minimum delay, be idempotent, and use SHA-256 content hashing for change detection.
- **All env vars** centralized in `packages/config/src/env.ts` with zod validation.
- **Types in `packages/types/`** are the contract between agents/services. Changes must be backward-compatible.

## Agent Roles

The project is designed to be built by 5 specialized agents (see PRD.md section 6):
1. **Foundation** — infra, DB, config, deployment (`packages/db/`, `packages/config/`, `packages/types/`)
2. **Atlas** — frontend dashboard + UI library (`apps/web/`, `packages/ui/`)
3. **Conduit** — API layer, tRPC + Hono (`apps/api/`, `apps/web/app/api/`)
4. **Sentinel** — ML & analysis engine (`services/ml-api/`, `packages/analytics/`)
5. **Harvester** — data pipeline & scraping (`services/pipeline/`)

## Phase 1 Scope (Build First)

Monorepo scaffold, Supabase schema + seed data, core UI shell (DashboardShell, landing page, search, org detail), tRPC routers for organizations/financials/search, ProPublica + UK Charity Commission data ingestion, deploy to Vercel + Supabase + Railway.
