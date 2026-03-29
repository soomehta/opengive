# OpenGive

> Follow the money. Demand transparency.

OpenGive is an open-source, community-driven global charity accountability dashboard. We aggregate public data from 30+ national charity registries, apply AI-powered forensic analysis to detect anomalies, and visualize money flows through an accessible, beautiful dashboard that anyone can use without a paywall.

![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue)
![Status: Alpha](https://img.shields.io/badge/status-alpha-yellow)
![Contributors: 10+](https://img.shields.io/badge/contributors-10%2B-brightgreen)

## What is OpenGive?

Global charitable giving exceeds $500 billion annually, but the data about where this money goes is:

- **Fragmented** — scattered across incompatible national registries
- **Paywalled** — commercial platforms charge $2,000-4,200+/year for access
- **Opaque** — entire regions (GCC, Sub-Saharan Africa, Southeast Asia) lack systematic accountability
- **Stale** — 12-18 month data lags from annual filing cycles
- **Unconnected** — no cross-border analysis to detect shell networks or shared-director patterns

**OpenGive solves this.** We:

1. **Aggregate** public data from every available global registry into a unified, normalized database
2. **Visualize** money flows with Sankey diagrams, network graphs, and geographic maps
3. **Analyze** filings using AI agents to detect financial anomalies and red-flag patterns
4. **Connect** entities across borders using probabilistic entity resolution
5. **Open** everything — data, algorithms, scoring methodology, and codebase — under Apache 2.0

## Who Uses OpenGive?

- **Individual donors** — Verify where your donations go
- **Investigative journalists** — Follow cross-border money trails
- **Regulators** — Monitor compliance across jurisdictions
- **Researchers** — Study the global nonprofit sector at scale
- **Charity watchdogs** — Leverage open infrastructure for accountability
- **Good charities** — Benefit from transparent ecosystems

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose
- Git

### One-Command Setup

```bash
git clone https://github.com/opengive/opengive.git
cd opengive
./scripts/setup.sh
pnpm turbo dev
```

Open http://localhost:3000

### What You Get

- **Frontend:** Next.js 15 dashboard with real-time search and visualizations
- **Database:** Supabase PostgreSQL with 1M+ organizations and 10M+ financial filings
- **API:** Public REST API at `/v1/` with 1000 req/min rate limit
- **Docs:** Docusaurus documentation at http://localhost:3001
- **ML Pipeline:** Dagster orchestration with anomaly detection

See [Getting Started Guide](./apps/docs/docs/getting-started.md) for detailed setup.

## Data Sources

OpenGive aggregates data from 11+ major registries covering 5M+ organizations globally:

| Source | Coverage | Records | Update Frequency |
|--------|----------|---------|------------------|
| **IRS 990** | US | 1.8M+ | Monthly |
| **ProPublica** | US | 1.8M+ | Weekly |
| **UK Charity Commission** | England & Wales | 170K | Daily |
| **OSCR** | Scotland | 25K | Monthly |
| **360Giving** | UK grants | 200+ funders | Daily |
| **IATI Datastore** | International aid | 1M+ | Daily |
| **UN OCHA FTS** | Humanitarian | 50K+ | Daily |
| **OECD DAC** | ODA flows | 31 countries | Quarterly |
| **ACNC** | Australia | 60K | Weekly |
| **CRA T3010** | Canada | 87K | Bi-annual |
| **France RNA** | France | 1.5M+ | Daily |

[View complete data sources table](./apps/docs/docs/data-sources.md)

## Architecture

Three-layer system optimized for performance and transparency:

```
Frontend (Next.js 15 on Vercel)
         ↓
API Layer (tRPC + Hono)
         ↓
Data Layer (Supabase PostgreSQL + pgvector)
         ↓
ML Analysis (FastAPI + Dagster on Railway)
```

**Tech Stack:**
- **Frontend:** Next.js 15, React 19, Tailwind CSS v4, Radix UI, ECharts, MapLibre GL
- **Database:** Supabase PostgreSQL, pgvector, PostGIS, pg_trgm
- **API:** tRPC v11 (internal), Hono (public REST)
- **ML:** FastAPI, Dagster, Scrapy, Playwright, Splink
- **Deployment:** Vercel (frontend), Railway (ML/pipeline), Supabase (database)

[Read Architecture Overview](./apps/docs/docs/architecture.md)

## Scoring Methodology

OpenGive uses a transparent, auditable 4-component scoring system (0-100):

- **Financial Health (25%)** — Revenue stability, working capital, diversification, cash reserves
- **Transparency (25%)** — Filing completeness, timeliness, audit status, multi-year history
- **Governance (25%)** — Board adequacy, independence, officer disclosure, conflict policies
- **Efficiency (25%)** — Program ratio, fundraising efficiency, admin costs, joint expenses

All formulas, thresholds, and benchmarks are [fully documented](./apps/docs/docs/methodology.md) and configurable.

**Anomaly Detection Rules:**
- Shell indicators (shared address + directors)
- Zero fundraising despite large donations
- Compensation outliers
- Benford's Law violations
- Overhead expense flips
- Revenue cliffs

[Read Scoring Methodology](./apps/docs/docs/methodology.md)

## Core Principles

- **Transparency of methodology** — Every algorithm, weight, and threshold is inspectable
- **No paywall, ever** — Core functionality free forever
- **Inclusive by design** — RTL support, WCAG 2.1 AA accessibility, low-bandwidth modes
- **Global perspective** — Not US-centric; every jurisdiction is first-class
- **Data, not opinions** — Surface patterns and anomalies; let users draw conclusions

## API

Public REST API with 100 req/min (anon) / 1000 req/min (authenticated) rate limits:

```bash
# Search organizations
curl "https://api.opengive.org/v1/organizations/search?query=Red+Cross"

# Get organization details
curl "https://api.opengive.org/v1/organizations/{id}"

# Get financial data
curl "https://api.opengive.org/v1/organizations/{id}/financials"

# Query anomalies
curl "https://api.opengive.org/v1/analysis/anomalies?severity=high"
```

[Complete API Reference](./apps/docs/docs/api-reference.md)

### JavaScript Example

```typescript
import { openGiveClient } from '@opengive/sdk';

const client = openGiveClient({ apiKey: process.env.OPENGIVE_API_KEY });

const results = await client.organizations.search({
  query: 'Red Cross',
  country: 'US',
  limit: 25,
});

console.log(results);
```

## Contributing

We welcome contributions! See [Contributing Guide](./apps/docs/docs/contributing.md) for:

- How to report bugs and suggest features
- How to improve documentation
- How to contribute code
- How to add new data sources
- How to improve scoring methodology

### Quick Contribution Paths

1. **Document improvements** — Fix typos, clarify sections, add examples
2. **Bug fixes** — Issues tagged `good-first-issue`
3. **New data sources** — Use [Data Source Template](https://github.com/opengive/opengive/issues/new?template=data_source_request.md)
4. **Scoring improvements** — Propose evidence-based methodology updates
5. **Translations** — Help localize for other languages

### Development

```bash
# Setup
git clone https://github.com/opengive/opengive.git
cd opengive
./scripts/setup.sh

# Development server
pnpm turbo dev

# Tests
pnpm turbo test

# Linting
pnpm turbo lint

# Build
pnpm turbo build
```

[Read Contributing Guide](./apps/docs/docs/contributing.md)

## Documentation

- [Getting Started](./apps/docs/docs/getting-started.md) — Local setup and first steps
- [Architecture](./apps/docs/docs/architecture.md) — System design and tech stack
- [Data Sources](./apps/docs/docs/data-sources.md) — Registry details and coverage
- [Scoring Methodology](./apps/docs/docs/methodology.md) — Complete scoring formulas and anomaly rules
- [API Reference](./apps/docs/docs/api-reference.md) — All endpoints with examples
- [Contributing Guide](./apps/docs/docs/contributing.md) — How to contribute code, docs, data

Full documentation at https://docs.opengive.org

## Project Status

**Current Phase:** Alpha (Q1 2026)

- [x] Monorepo scaffold with Turborepo
- [x] Supabase schema + seed data (Phase 1 sources)
- [x] Core UI shell (Command Center, Explorer, Flow Mapper)
- [x] tRPC routers for organizations/financials/search
- [x] Public REST API (Hono)
- [x] ProPublica + UK Charity Commission integration
- [x] Scoring methodology v1
- [ ] India/Africa/GCC data sources
- [ ] Advanced anomaly detection
- [ ] Entity resolution UI
- [ ] Investigation workbench
- [ ] Community translation framework

[See full Phase Plan](./PRD.md#17-phase-plan)

## Roadmap

### Q1 2026 (Current)
- Public beta launch
- Core 11 data sources
- Scoring v1

### Q2 2026
- Advanced search and filtering
- Investigation workbench
- Entity resolution improvements
- Community dashboards

### Q3 2026
- India/Africa/GCC data sources
- Anomaly detection ML models
- API SDKs (JS, Python, Go)
- Community translations

### Q4 2026
- 30+ data sources
- Advanced analytics suite
- Blockchain integration (future)
- Sustainability

## License

OpenGive is licensed under the [Apache License 2.0](./LICENSE). All code, data, and documentation are open.

All contributing charities' data is public, publicly available, and made available under a [CC0 license](https://creativecommons.org/publicdomain/zero/1.0/).

## Support

- **Documentation:** https://docs.opengive.org
- **GitHub Issues:** https://github.com/opengive/opengive/issues
- **GitHub Discussions:** https://github.com/opengive/opengive/discussions
- **Email:** hello@opengive.org
- **Community:** Discord (coming soon)

## Contributors

OpenGive is built by a global community of developers, researchers, and nonprofits. [See all contributors](https://github.com/opengive/opengive/graphs/contributors).

Want to help? [Read the Contributing Guide](./apps/docs/docs/contributing.md).

## Acknowledgments

- ProPublica Nonprofit Explorer
- UK Charity Commission
- IATI Initiative
- UN OCHA
- Charity Navigator
- 360Giving
- Splink community
- All data sources and their maintainers

## Security

If you discover a security vulnerability, please email security@opengive.org instead of using the public issue tracker.

---

**Status:** This project is in active development. Features and APIs may change. Report bugs and suggest improvements!

**Follow the money. Demand transparency.**
