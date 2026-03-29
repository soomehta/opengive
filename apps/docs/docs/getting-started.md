---
sidebar_position: 1
---

# Getting Started

Welcome to OpenGive! This guide will get you up and running in minutes.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 20+** — [Download from nodejs.org](https://nodejs.org)
- **pnpm 9+** — Install with `npm install -g pnpm`
- **Docker & Docker Compose** — [Download from docker.com](https://www.docker.com/products/docker-desktop)
- **Git** — [Download from git-scm.com](https://git-scm.com)

## Clone the Repository

```bash
git clone https://github.com/opengive/opengive.git
cd opengive
```

## One-Command Setup

We provide an automated setup script that installs all dependencies and configures your local environment:

```bash
./scripts/setup.sh
```

This script:
1. Installs pnpm dependencies for all workspaces
2. Sets up environment variables from `.env.example`
3. Builds shared packages (types, config, UI library)
4. Initializes the local database with Supabase migrations
5. Seeds development data

## Manual Setup (Alternative)

If you prefer to set up manually:

```bash
# Install dependencies
pnpm install

# Build shared packages
pnpm turbo build --filter=config --filter=types --filter=ui

# Configure environment variables
cp .env.example .env.local

# Apply database migrations (requires Supabase CLI)
supabase db push

# Seed development data (optional)
pnpm seed-dev
```

## Start Development

Start the entire local stack:

```bash
docker compose up
```

Then in another terminal:

```bash
pnpm turbo dev
```

This starts:
- **Frontend (Next.js 15)** at http://localhost:3000
- **API (tRPC/Hono)** at http://localhost:3000/api
- **Docs (Docusaurus)** at http://localhost:3001
- **PostgreSQL** with all extensions (pgvector, PostGIS, pg_trgm)
- **Supabase Studio** at http://localhost:54323

## Verify Installation

Open http://localhost:3000 in your browser. You should see:
- OpenGive landing page with search functionality
- Navigation to explore charities and financial data
- Links to documentation and API reference

## Quick Exploration

1. **Search a charity** — Type an organization name in the search box
2. **View details** — Click on a result to see financial summaries and scores
3. **Check data sources** — Hover over badges to see which registry the data came from
4. **Read the docs** — Visit http://localhost:3001 to explore architecture and methodology

## Next Steps

- Read the [Architecture Overview](./architecture.md) to understand the system design
- Review [Data Sources](./data-sources.md) to see what registries we aggregate
- Study the [Scoring Methodology](./methodology.md) to understand how organizations are evaluated
- Explore the [API Reference](./api-reference.md) to integrate with OpenGive
- Check the [Contributing Guide](./contributing.md) to start building

## Troubleshooting

### Docker fails to start

Ensure Docker daemon is running. On macOS/Windows, open Docker Desktop.

### Port already in use

If port 3000 is already in use:

```bash
# Find and kill the process (macOS/Linux)
lsof -ti:3000 | xargs kill -9

# Or use a different port
pnpm turbo dev -- --port 3001
```

### Database migration errors

Reset the database:

```bash
supabase db reset
./scripts/setup.sh
```

### pnpm: command not found

Install pnpm globally:

```bash
npm install -g pnpm
```

## Need Help?

- Check [GitHub Discussions](https://github.com/opengive/opengive/discussions)
- Review [existing issues](https://github.com/opengive/opengive/issues)
- Read the [Contributing Guide](./contributing.md) for development questions
