---
sidebar_position: 3
---

# Data Sources

OpenGive aggregates public charity data from 30+ national registries. This page documents all sources, their coverage, update frequency, and data quality.

## Priority 1: API-Accessible Sources (Phase 1)

| Source | Registry | Coverage | API | Format | Update Frequency | Records |
|--------|----------|----------|-----|--------|------------------|---------|
| **IRS 990** | GivingTuesday Data Lake | US | S3 bulk download | XML | Monthly | 1.8M+ |
| **ProPublica Nonprofit Explorer** | US | US | REST (no auth) | JSON | Weekly | 1.8M+ |
| **UK Charity Commission** | England & Wales | ~170K | REST (API key) | JSON | Daily | ~170K |
| **OSCR** | Scotland | ~25K | REST (beta) | JSON | Monthly | ~25K |
| **360Giving GrantNav** | UK grants | 200+ funders | PostgreSQL / JSON | JSON | Daily | 1M+ |
| **IATI Datastore** | International aid | Global | Solr REST | XML/JSON | Daily | ~1M |
| **UN OCHA FTS** | Humanitarian | Global | REST (no auth) | JSON | Daily | 50K+ |
| **OECD DAC CRS** | ODA flows | 31 DAC members | SDMX REST | CSV/Parquet | Quarterly | 1M+ |
| **ACNC Register** | Australia | ~60K | CKAN API | CSV | Weekly | ~60K |
| **CRA T3010** | Canada | ~87K | Bulk download | CSV | Bi-annual | ~87K |
| **France RNA** | France | All associations | REST API | JSON | Daily | 1.5M+ |

## Priority 2: Scraping-Required Sources (Phase 2)

| Source | Region | Challenge | Method | Data Quality | Status |
|--------|--------|-----------|--------|--------------|--------|
| **India NGO Darpan** | India | Medium | Scrapy + Playwright | Low (self-declared) | Planned |
| **India FCRA Portal** | India | Hard | Playwright + PDF parse | Medium (aggregate) | Planned |
| **India MCA (Section 8)** | India | Hard | Playwright + PDF parse | Medium | Planned |
| **Netherlands ANBI** | Netherlands | Easy | Bulk Excel | Medium | Planned |
| **Germany Vereinsregister** | Germany | Hard | Per-court portals | Low (registration) | Planned |
| **GCC Directories** | Middle East | Very Hard | Playwright + Arabic OCR | Very Low | Future |

## Data Normalization Pipeline

All data flows through a standardized pipeline to ensure consistency:

```
┌─────────────────────────┐
│   RAW DATA              │
│ (Original format)       │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│   STORAGE                               │
│ Preserve original in Supabase Storage   │
│ with metadata (source, timestamp, hash) │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│   PARSE (Staging Tables)                │
│ Extract structured fields               │
│ Handle source-specific quirks           │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│   NORMALIZE (Core Tables)               │
│ Currency conversion (USD-normalized)    │
│ Field mapping to standard schema        │
│ Deduplication and cleanup               │
│ Entity resolution (cross-registry)      │
│ Compute financial ratios                │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│   ENRICH (Analysis Tables)              │
│ Composite scoring                       │
│ Anomaly detection                       │
│ Embedding generation for similarity     │
│ Governance flag computation             │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│   INDEX (Search)                        │
│ Full-text search vectors                │
│ Vector embedding indexes                │
│ Geographic indexes (PostGIS)            │
└─────────────────────────────────────────┘
```

## Provenance Tracking

Every organization record maintains a full audit trail:

```
organizations.id
├── organizations.registry_source  (e.g., "us_irs", "uk_cc")
├── organizations.registry_id      (e.g., "EX123456")
├── financial_filings[].source_url (Link to original filing)
└── scrape_runs.id (Batch ingestion record)
    ├── scrape_runs.started_at
    ├── scrape_runs.completed_at
    ├── scrape_runs.records_found
    ├── scrape_runs.records_new
    ├── scrape_runs.records_updated
    └── scrape_runs.error_log
```

Users can always trace any data point back to its original source.

## Data Quality Standards

OpenGive applies quality checks at each stage:

### Parsing Stage
- Type conformity (ensure dates are valid, amounts are numeric)
- Required field presence (organization name, fiscal year)
- Encoding validation (UTF-8 compatibility)

### Normalization Stage
- Null rate monitoring (flag sources with >20% missing values)
- Value range checks (negative revenue, impossible percentages)
- Referential integrity (grants reference valid org IDs)

### Enrichment Stage
- Score validity (0-100 range)
- Anomaly threshold testing (Benford's law, statistical outliers)
- Embedding quality (cosine similarity distributions)

### Monitoring
- **Freshness dashboard** — hours since last scrape for each source
- **Completeness dashboard** — % of organizations with multi-year data
- **Alert on anomalies** — automatic flagging if >5% records fail validation

## Geographic Coverage

### Tier 1 (Comprehensive)
- United States
- United Kingdom (England, Wales, Scotland)
- Canada
- Australia
- France

### Tier 2 (Moderate)
- IATI global aid data (150+ countries)
- UN OCHA humanitarian (100+ countries)
- OECD DAC countries (31 members)

### Tier 3 (Planned)
- India (NGO Darpan, FCRA, MCA)
- Netherlands
- Germany
- Middle East/GCC (Arabic-enabled)

## Sector Coverage

Most sources capture all sectors:
- Religious organizations
- Educational institutions
- Healthcare providers
- International aid/development
- Community & social services
- Environment & animal welfare
- Arts, culture, & humanities
- Public & social benefit

Source-specific sector filters are documented in the API reference.

## Financial Data Fields

Across all sources, OpenGive normalizes these financial fields:

```
Revenues
├── Total Revenue
├── Contributions & Grants
├── Program Service Revenue
├── Investment Income
└── Other Revenue

Expenses
├── Total Expenses
├── Program Expenses
├── Fundraising Expenses
├── Management & General Expenses
└── Joint Costs

Assets & Liabilities
├── Total Assets
├── Total Liabilities
├── Net Assets / Equity
├── Cash & Equivalents
└── Investments

Personnel
├── CEO Compensation
├── Total Compensation (all officers)
├── Full-time Employees
└── Part-time Employees
```

## Entity Matching

OpenGive uses probabilistic entity resolution (Splink) to match organizations across registries:

- **Direct matching** — same legal name + address → high confidence
- **Fuzzy matching** — similar name + director overlap → medium confidence
- **Investigative linking** — shared address + director patterns → lower confidence, requires analyst review

All matches are stored in `entity_matches` table with:
- `match_probability` (0-1 score)
- `match_type` ('confirmed', 'probable', 'possible')
- `matched_fields` (which fields triggered the match)
- `reviewed` flag (analyst review status)

## API Rate Limits & Throttling

OpenGive respects all source APIs:

- **ProPublica** — 100 req/min
- **UK Charity Commission** — 600 req/min
- **OSCR** — Public beta, throttled conservatively
- **IATI Datastore** — 30 req/sec
- **UN OCHA FTS** — Rate limit unknown, conservative 5 req/sec
- **All custom scrapers** — 2+ second delay between requests, robots.txt respected

## Known Data Limitations

### United States (IRS 990)
- 12-18 month lag (annual filings)
- Small organizations (<$50K revenue) not required to file
- Private foundations use different form (990-PF)

### United Kingdom
- OSCR (Scotland) API in beta — may change
- 360Giving is grants-based (donor side), not all recipients report

### International Data
- IATI focuses on bilateral aid and NGOs
- UN OCHA FTS primarily humanitarian emergencies
- OECD DAC is government-to-government ODA

### India
- NGO Darpan has no financial data (names/addresses only)
- FCRA portal aggregated data only (no org-level detail)
- MCA Section 8 companies require PDF extraction

## Contributing New Data Sources

Want to add a registry? See the [Contributing Guide](./contributing.md) for the process:

1. **Research** — Document source, coverage, API/scrape approach
2. **Propose** — Create GitHub issue with source details
3. **Build** — Write parser/scraper + tests
4. **Integrate** — Add to Dagster pipeline and validation
5. **Document** — Update this page with details

## Next Steps

- Learn how data is analyzed in [Scoring Methodology](./methodology.md)
- Review the [API Reference](./api-reference.md) to query data
- Check [Architecture](./architecture.md) for the ingestion pipeline
