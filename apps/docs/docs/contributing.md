---
sidebar_position: 6
---

# Contributing Guide

OpenGive is built by a global community. We welcome contributions of all kinds — code, documentation, translations, data sources, and ideas.

## Code of Conduct

We are committed to providing a welcoming and inspiring community for all. Please read and adhere to our [Code of Conduct](https://github.com/opengive/opengive/blob/main/CODE_OF_CONDUCT.md).

## How to Contribute

### 1. Report Issues

Found a bug or have a feature request? Open a GitHub issue:

- **Bugs:** [Bug Report Template](https://github.com/opengive/opengive/issues/new?template=bug_report.md)
- **Features:** [Feature Request Template](https://github.com/opengive/opengive/issues/new?template=feature_request.md)
- **Data Sources:** [New Data Source Template](https://github.com/opengive/opengive/issues/new?template=data_source_request.md)

### 2. Improve Documentation

Documentation is never perfect. If you see unclear explanations, outdated examples, or missing content:

1. Open the `.md` file directly in GitHub
2. Click "Edit this file" (pencil icon)
3. Make your changes
4. Submit a pull request with a clear description

Examples of valuable doc contributions:
- Clarifying confusing sections
- Adding code examples
- Fixing typos and grammar
- Translating to other languages
- Adding diagrams or screenshots

### 3. Contribute Code

#### Getting Started

1. **Set up development environment**

```bash
# Clone repository
git clone https://github.com/opengive/opengive.git
cd opengive

# Run setup script
./scripts/setup.sh

# Start development server
pnpm turbo dev
```

2. **Understand the codebase**

Read the [Architecture Overview](./architecture.md) to understand the three-layer system. Code is organized as:

```
apps/web/          # Next.js 15 frontend
apps/api/          # Hono public API
apps/docs/         # Docusaurus documentation
packages/ui/       # Shared components
packages/db/       # Database schema
packages/config/   # Configuration
services/ml-api/   # FastAPI ML service
services/pipeline/ # Dagster pipeline
```

#### Branch Naming & Commits

Follow conventional commit style:

```bash
# Create feature branch
git checkout -b feat/organization-filtering

# Or fix branch
git checkout -b fix/score-calculation-bug

# Or documentation branch
git checkout -b docs/api-reference-update

# Branch naming: feat/, fix/, docs/, refactor/, test/, chore/
```

Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add organization filtering by sector

- Add sector parameter to search endpoint
- Implement sector dropdown in UI
- Add tests for sector filtering
- Update API documentation

Fixes #123
```

Common commit prefixes:
- **feat:** New feature
- **fix:** Bug fix
- **docs:** Documentation only
- **refactor:** Code restructuring (no behavior change)
- **test:** Add or fix tests
- **chore:** Dependencies, build scripts, etc.

#### Code Style

**TypeScript (Frontend/API):**

```typescript
// ✅ Good
interface SearchParams {
  query: string;
  limit: number;
}

export function useOrganizations(params: SearchParams) {
  // ...
}

// ❌ Bad
export default (params) => {
  // no types, default export
};

// Named exports only
// Type everything
// Use interfaces for objects (extendable, better errors)
```

**Python (ML/Pipeline):**

```python
# ✅ Good
from typing import Optional
from pydantic import BaseModel

class OrganizationScore(BaseModel):
    organization_id: str
    overall_score: float
    components: dict

async def calculate_score(org_id: str) -> OrganizationScore:
    """Calculate composite score for organization.

    Args:
        org_id: UUID of organization

    Returns:
        Score breakdown with component details
    """
    # ...

# ❌ Bad
def calc_score(id):  # no types, unclear name
    # ...
```

**Styling & Components:**

All components use Tailwind + CVA (class-variance-authority):

```tsx
// ✅ Good
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md transition-colors',
  {
    variants: {
      variant: {
        primary: 'bg-accent-trust text-white hover:bg-accent-trust/90',
        secondary: 'bg-surface-elevated hover:bg-surface-overlay',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
      },
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return (
    <button className={buttonVariants({ variant, size, className })} {...props} />
  );
}
```

#### Testing

Write tests for all new features:

```bash
# Frontend tests (Vitest + React Testing Library)
pnpm turbo test

# Specific test file
pnpm vitest run packages/ui/src/Button.test.tsx

# Python tests
pytest services/ml-api/tests/
```

Test coverage requirements:
- **UI components:** >80%
- **Utility functions:** >90%
- **API routes:** >75%
- **Python services:** >70%

#### Pull Request Process

1. **Create branch and make changes**

```bash
git checkout -b feat/new-feature
# Make changes, commit with conventional commits
```

2. **Push and open PR**

```bash
git push origin feat/new-feature
```

3. **PR checklist**

Before submitting, ensure:
- [ ] Code follows style guide
- [ ] Tests pass: `pnpm turbo test`
- [ ] Linting passes: `pnpm turbo lint`
- [ ] Commit messages follow conventions
- [ ] Documentation updated if needed
- [ ] No unrelated changes

4. **PR description**

Write a clear description:

```markdown
## Description
Adds organization filtering by sector to improve search precision.

## Changes
- Add `sector` parameter to search endpoint
- Implement sector filter UI with dropdown
- Add validation and tests

## Related Issue
Fixes #123

## Testing
- Unit tests: ✅ passing
- E2E tests: ✅ passing
- Manual testing: ✅ verified locally
```

5. **Review & merge**

- Address reviewer feedback
- Ensure CI passes
- Squash and merge to main

### 4. Add a New Data Source

Contributing a new registry is highly valuable:

1. **Research the source**

```markdown
**Proposed Data Source: India NGO Darpan**

- **Coverage:** India, 500K+ NGOs
- **API:** https://data.niti.gov.in/darpan
- **Format:** REST JSON
- **Update Frequency:** Weekly
- **Financial Data:** No (names/addresses only)
- **License:** CC0 / Public Domain
- **Documentation:** https://data.niti.gov.in/documentation
```

2. **Create an issue** with the [Data Source Template](https://github.com/opengive/opengive/issues/new?template=data_source_request.md)

3. **Build the parser/scraper**

Create `services/pipeline/src/scrapers/india_darpan.py`:

```python
import httpx
import structlog
from typing import AsyncGenerator
from pydantic import BaseModel

logger = structlog.get_logger()

class IndiaOrganization(BaseModel):
    name: str
    registration_number: str
    address: str
    sector: str | None

async def scrape_india_darpan() -> AsyncGenerator[IndiaOrganization, None]:
    """Scrape India NGO Darpan registry."""
    async with httpx.AsyncClient() as client:
        offset = 0
        limit = 100

        while True:
            response = await client.get(
                f"https://data.niti.gov.in/darpan/api/v1/organizations",
                params={"offset": offset, "limit": limit}
            )
            response.raise_for_status()

            data = response.json()
            if not data['results']:
                break

            for org in data['results']:
                yield IndiaOrganization(
                    name=org['name'],
                    registration_number=org['id'],
                    address=org['address'],
                    sector=org.get('sector')
                )

            offset += limit
            logger.info("scraped_india_darpan", offset=offset)
```

4. **Add to Dagster pipeline**

Edit `services/pipeline/src/assets.py`:

```python
from dagster import asset, daily_schedule

@asset(group_name="scrapers")
async def india_darpan_raw() -> None:
    """Scrape India NGO Darpan daily."""
    async for org in scrape_india_darpan():
        # Store to database or Supabase Storage
        await store_organization(
            registry_source="india_darpan",
            data=org.dict()
        )

@daily_schedule(
    job_name="india_darpan_job",
    start_date=datetime(2024, 1, 1)
)
def india_darpan_schedule():
    return {}
```

5. **Write tests**

```python
# services/pipeline/tests/test_india_darpan.py
import pytest
from scrapers.india_darpan import scrape_india_darpan

@pytest.mark.asyncio
async def test_india_darpan_scraper(httpx_mock):
    """Test India Darpan scraper with mock API."""
    httpx_mock.add_response(
        method="GET",
        json={
            "results": [
                {
                    "id": "001",
                    "name": "Test NGO",
                    "address": "123 Main St"
                }
            ]
        }
    )

    orgs = []
    async for org in scrape_india_darpan():
        orgs.append(org)

    assert len(orgs) == 1
    assert orgs[0].name == "Test NGO"
```

6. **Document the source**

Update `apps/docs/docs/data-sources.md` with:
- Coverage and API details
- Update frequency
- Data quality notes
- Known limitations

7. **Open PR**

Include in description:
- Why this source is important
- Coverage and quality
- Testing approach
- Documentation updates

### 5. Improve Scoring Methodology

The scoring system is intentionally transparent so users can propose improvements:

1. **Understand current methodology**

Read [Scoring Methodology](./methodology.md) thoroughly.

2. **Identify improvement**

Examples:
- Better weight distribution for components
- New anomaly detection rules
- Sector-specific adjustments
- Benchmark updates

3. **Propose with evidence**

Create an issue with:
- Current behavior and limitation
- Proposed change with formula
- Reasoning and academic citations
- Impact on benchmark scores

4. **Implementation**

Update `packages/config/src/scoring.ts`:

```typescript
export const SCORING_CONFIG_V2 = {
  version: 'v2',
  weights: {
    // New weights backed by research
  },
  thresholds: {
    // Updated benchmarks
  }
}
```

Add new version without breaking old version. Users can recalculate with either methodology.

5. **Update documentation**

- Add explanation to methodology.md
- Include references and citations
- Document decision rationale

## Development Workflow

### Local Development

```bash
# Install dependencies
pnpm install

# Start all services
docker compose up          # Database, storage, auth
pnpm turbo dev             # All apps in watch mode

# Run tests
pnpm turbo test
pnpm turbo test -- --watch

# Lint and format
pnpm turbo lint
pnpm prettier --write .    # Auto-format

# Build for production
pnpm turbo build
```

### Database Changes

If you modify the database schema:

```bash
# Create migration
supabase migration new add_new_column

# Edit migration file
# apps/web/supabase/migrations/YYYY_MM_DD_add_new_column.sql

# Apply locally
supabase db push

# Generate TypeScript types
pnpm --filter=@opengive/db generate

# Commit migration file
git add supabase/migrations/
git commit -m "chore: add_new_column migration"
```

### Frontend Development

```bash
# Start just the frontend
pnpm turbo dev --filter=web

# Open http://localhost:3000

# Build a component story
pnpm turbo storybook --filter=ui
# Open http://localhost:6006
```

### ML Service Development

```bash
# Start just the ML API
cd services/ml-api
uvicorn app.main:app --reload

# Open http://localhost:8000/docs (Swagger UI)

# Run tests
pytest tests/ -v

# Linting
ruff check . --fix
```

## Getting Help

- **Slack/Discord:** [Community Chat](https://discord.gg/opengive) (coming soon)
- **GitHub Discussions:** [Ask questions](https://github.com/opengive/opengive/discussions)
- **GitHub Issues:** [Report problems](https://github.com/opengive/opengive/issues)
- **Email:** hello@opengive.org

## Recognition

Contributors are recognized in:
- [README.md](../README.md) contributors section
- GitHub Contributors page
- Release notes for major contributions
- Monthly community newsletter

## Legal

By contributing to OpenGive, you agree that your contributions will be licensed under the Apache 2.0 License. You represent that you have the right to grant these rights and that your contributions don't violate anyone else's rights.

---

## Next Steps

1. Read [Architecture Overview](./architecture.md) to understand the codebase
2. Look at [open issues](https://github.com/opengive/opengive/issues) for ideas
3. Start with a small contribution (typo fix, test improvement)
4. Join the community to discuss larger features

Thank you for building OpenGive with us!
