---
sidebar_position: 5
---

# API Reference

OpenGive provides a public REST API for programmatic access to charity data, scores, and analysis. All endpoints are versioned at `/v1/`.

## Base URL

**Production:** `https://api.opengive.org/v1/`

**Development:** `http://localhost:3000/api/v1/`

## Authentication

### No Authentication Required

Public search, read, and analysis endpoints require no authentication.

### API Key Authentication

For higher rate limits and access to premium features, include your API key:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.opengive.org/v1/organizations/search
```

Obtain an API key by creating an account and visiting your [account settings](https://opengive.org/account/api-keys).

## Rate Limiting

Rate limits are enforced per IP or API key:

| Tier | Limit | Burst |
|------|-------|-------|
| Anonymous | 100 req/min | 10 req/sec |
| Authenticated | 1,000 req/min | 100 req/sec |
| Premium | Custom | Custom |

Rate limit status is included in response headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1648756832
```

## Response Format

All responses are JSON with this structure:

```json
{
  "success": true,
  "data": { /* endpoint-specific */ },
  "pagination": {
    "cursor": "abcd1234",
    "limit": 25,
    "has_more": true
  }
}
```

### Error Responses

```json
{
  "success": false,
  "error": {
    "code": "INVALID_QUERY",
    "message": "Query must be at least 2 characters",
    "details": {
      "field": "query",
      "received": "a"
    }
  }
}
```

## Endpoints

### Organizations

#### Search Organizations

Search across all registries by name, location, sector, or registration number.

```
GET /organizations/search
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search term (name, address, registration number) |
| `country` | string | No | Filter by country code (US, GB, CA, AU, FR, etc.) |
| `sector` | string | No | Filter by sector (education, healthcare, social_services, etc.) |
| `status` | enum | No | active, inactive, dissolved |
| `min_revenue` | number | No | Minimum annual revenue (USD) |
| `max_revenue` | number | No | Maximum annual revenue (USD) |
| `limit` | number | No | Results per page (1-100, default: 25) |
| `cursor` | string | No | Pagination cursor from previous response |

**Example Request:**

```bash
curl -X GET "https://api.opengive.org/v1/organizations/search" \
  -d "query=Red Cross" \
  -d "country=US" \
  -d "limit=10"
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "American Red Cross",
      "slug": "american-red-cross",
      "country": "US",
      "registry_source": "us_irs",
      "registry_id": "531220849",
      "status": "active",
      "founded_year": 1881,
      "website": "https://www.redcross.org",
      "address": "2025 E St NW, Washington, DC 20006",
      "latitude": 38.8951,
      "longitude": -77.0369,
      "latest_revenue": 3200000000,
      "latest_revenue_year": 2023,
      "overall_score": 78,
      "total_assets": 4100000000
    }
  ],
  "pagination": {
    "cursor": "next_page_token",
    "limit": 10,
    "has_more": true
  }
}
```

---

#### Get Organization Details

Retrieve full details including financial history and scores for a specific organization.

```
GET /organizations/{id}
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Organization ID |

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `include_financials` | boolean | Include 5-year financial history (default: true) |
| `include_related` | boolean | Include entity matches (default: true) |
| `include_anomalies` | boolean | Include flagged anomalies (default: true) |

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "American Red Cross",
    "slug": "american-red-cross",
    "country": "US",
    "registry_source": "us_irs",
    "registry_id": "531220849",
    "status": "active",
    "founded_year": 1881,
    "website": "https://www.redcross.org",
    "description": "Humanitarian organization providing disaster relief...",
    "address": "2025 E St NW, Washington, DC 20006",
    "latitude": 38.8951,
    "longitude": -77.0369,
    "sector": "humanitarian",
    "financials": [
      {
        "fiscal_year": 2023,
        "total_revenue": 3200000000,
        "total_expenses": 3100000000,
        "program_expenses": 2550000000,
        "admin_expenses": 310000000,
        "fundraising_expenses": 240000000,
        "total_assets": 4100000000,
        "total_liabilities": 800000000,
        "net_assets": 3300000000,
        "cash_and_equivalents": 650000000,
        "ceo_compensation": 950000,
        "full_time_employees": 3200,
        "part_time_employees": 5000
      },
      { /* 2022 */ },
      { /* 2021 */ },
      { /* 2020 */ },
      { /* 2019 */ }
    ],
    "scores": {
      "overall_score": 78,
      "financial_health": 75,
      "transparency": 82,
      "governance": 78,
      "efficiency": 76,
      "latest_fiscal_year": 2023,
      "methodology_version": "v1"
    },
    "related_entities": [
      {
        "org_id": "660e8400-e29b-41d4-a716-446655440001",
        "org_name": "Red Cross International",
        "match_probability": 0.92,
        "match_type": "probable",
        "matched_fields": ["name", "address", "sector"]
      }
    ],
    "anomalies": [
      {
        "code": "compensation_outlier",
        "severity": "low",
        "description": "CEO compensation is 15% above peer median for similar-sized organizations",
        "detected_year": 2023
      }
    ]
  }
}
```

---

#### Get Organization Scores

Retrieve detailed score breakdown with configurable weights.

```
POST /organizations/{id}/scores
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Organization ID |

**Request Body (Optional):**

```json
{
  "fiscal_year": 2023,
  "weights": {
    "financial_health": 0.25,
    "transparency": 0.25,
    "governance": 0.25,
    "efficiency": 0.25
  },
  "include_breakdown": true
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "organization_id": "550e8400-e29b-41d4-a716-446655440000",
    "organization_name": "American Red Cross",
    "fiscal_year": 2023,
    "methodology_version": "v1",
    "overall_score": 78,
    "components": {
      "financial_health": {
        "score": 75,
        "breakdown": {
          "revenue_trend": 82,
          "working_capital": 70,
          "diversification": 72,
          "cash_reserves": 72
        }
      },
      "transparency": {
        "score": 82,
        "breakdown": {
          "filing_completeness": 95,
          "filing_timeliness": 90,
          "audit_status": 100,
          "data_availability": 60
        }
      },
      "governance": {
        "score": 78,
        "breakdown": {
          "board_size": 85,
          "board_independence": 75,
          "officer_disclosure": 90,
          "conflict_policy": 60
        }
      },
      "efficiency": {
        "score": 76,
        "breakdown": {
          "program_ratio": 82,
          "fundraising_efficiency": 72,
          "admin_ratio": 75,
          "joint_costs": 65
        }
      }
    }
  }
}
```

---

### Financial Data

#### Get Financial Filings

Retrieve multi-year financial statements for an organization.

```
GET /organizations/{id}/financials
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `years` | number | Number of years to return (1-10, default: 5) |
| `include_ratios` | boolean | Include computed financial ratios (default: true) |

**Response:**

```json
{
  "success": true,
  "data": {
    "organization_id": "550e8400-e29b-41d4-a716-446655440000",
    "filings": [
      {
        "fiscal_year": 2023,
        "filing_date": "2024-02-15",
        "source": "us_irs",
        "source_url": "https://www.irs.gov/...",
        "revenue": {
          "total": 3200000000,
          "contributions_grants": 2100000000,
          "program_services": 900000000,
          "investment_income": 150000000,
          "other": 50000000
        },
        "expenses": {
          "total": 3100000000,
          "program": 2550000000,
          "management_general": 310000000,
          "fundraising": 240000000
        },
        "assets_liabilities": {
          "total_assets": 4100000000,
          "current_assets": 1200000000,
          "total_liabilities": 800000000,
          "current_liabilities": 300000000,
          "net_assets": 3300000000
        },
        "ratios": {
          "program_ratio": 0.823,
          "admin_ratio": 0.100,
          "fundraising_ratio": 0.077,
          "current_ratio": 4.0,
          "debt_to_assets": 0.195,
          "working_capital_months": 4.8,
          "cash_months": 2.5
        }
      }
    ]
  }
}
```

---

#### Compare Organizations

Compare financials and scores across multiple organizations.

```
POST /organizations/compare
```

**Request Body:**

```json
{
  "organization_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e8400-e29b-41d4-a716-446655440001"
  ],
  "fiscal_year": 2023,
  "metrics": [
    "overall_score",
    "program_ratio",
    "total_revenue",
    "admin_ratio"
  ]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "fiscal_year": 2023,
    "organizations": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "American Red Cross",
        "overall_score": 78,
        "program_ratio": 0.823,
        "total_revenue": 3200000000,
        "admin_ratio": 0.100
      },
      {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "name": "Red Cross International",
        "overall_score": 75,
        "program_ratio": 0.805,
        "total_revenue": 1800000000,
        "admin_ratio": 0.115
      }
    ]
  }
}
```

---

### Flows & Relationships

#### Get Grant Flows

Retrieve grant relationships between organizations (who funds whom).

```
GET /flows/grants
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `funder_id` | UUID | Filter by funder (grants given) |
| `grantee_id` | UUID | Filter by grantee (grants received) |
| `country` | string | Filter by country |
| `year` | number | Specific fiscal year |
| `min_amount` | number | Minimum grant amount (USD) |
| `limit` | number | Results per page (1-100) |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "funder_id": "550e8400-e29b-41d4-a716-446655440000",
      "funder_name": "Ford Foundation",
      "grantee_id": "880e8400-e29b-41d4-a716-446655440003",
      "grantee_name": "Community Development Organization",
      "amount": 500000,
      "fiscal_year": 2023,
      "grant_type": "program_support",
      "source": "360giving",
      "source_url": "https://grantnav.org/..."
    }
  ],
  "pagination": {
    "cursor": "next_page_token",
    "has_more": true
  }
}
```

---

#### Get Related Entities

Find organizations that share directors, addresses, or funding relationships.

```
GET /organizations/{id}/related
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `match_type` | enum | confirmed, probable, possible (default: all) |
| `relationship_type` | enum | director, address, funding, all (default: all) |

**Response:**

```json
{
  "success": true,
  "data": {
    "organization_id": "550e8400-e29b-41d4-a716-446655440000",
    "related_entities": [
      {
        "entity_id": "660e8400-e29b-41d4-a716-446655440001",
        "entity_name": "Red Cross International",
        "relationship_type": "director",
        "shared_directors": ["Jane Smith", "John Doe"],
        "match_probability": 0.92,
        "match_type": "probable",
        "country": "GB"
      },
      {
        "entity_id": "770e8400-e29b-41d4-a716-446655440002",
        "entity_name": "Red Cross Foundation",
        "relationship_type": "address",
        "shared_address": "2025 E St NW, Washington, DC",
        "match_probability": 0.87,
        "match_type": "probable",
        "country": "US"
      }
    ]
  }
}
```

---

### Analysis & Anomalies

#### Get Anomaly Alerts

Retrieve organizations with flagged anomalies, optionally filtered by type and severity.

```
GET /analysis/anomalies
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `anomaly_code` | string | Filter by anomaly type (revenue_cliff, shell_indicator, etc.) |
| `severity` | enum | critical, high, medium, low |
| `country` | string | Filter by country |
| `limit` | number | Results per page (default: 25) |
| `cursor` | string | Pagination cursor |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "organization_id": "550e8400-e29b-41d4-a716-446655440000",
      "organization_name": "American Red Cross",
      "anomaly_code": "revenue_cliff",
      "severity": "high",
      "description": "Revenue declined 48% from 2022 to 2023",
      "detected_year": 2023,
      "detected_date": "2024-02-20",
      "supporting_data": {
        "revenue_2022": 6150000000,
        "revenue_2023": 3200000000,
        "percent_change": -0.48
      }
    }
  ]
}
```

---

#### Search by Custom Criteria

Search organizations using multiple filters and custom scoring.

```
POST /organizations/search-advanced
```

**Request Body:**

```json
{
  "filters": {
    "country": ["US", "GB"],
    "sector": ["education", "healthcare"],
    "status": "active",
    "revenue_range": {
      "min": 100000,
      "max": 50000000
    },
    "score_range": {
      "min": 60,
      "max": 100
    },
    "board_size_range": {
      "min": 5,
      "max": 25
    }
  },
  "sort_by": "overall_score",
  "sort_order": "desc",
  "limit": 100
}
```

---

### Bulk Operations

#### Bulk Get Organizations

Retrieve multiple organizations by ID in a single request.

```
POST /organizations/bulk-get
```

**Request Body:**

```json
{
  "organization_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e8400-e29b-41d4-a716-446655440001",
    "770e8400-e29b-41d4-a716-446655440002"
  ],
  "include_financials": true,
  "include_scores": true
}
```

---

#### Export Organizations

Export search results or organization list as CSV.

```
POST /organizations/export
```

**Request Body:**

```json
{
  "organization_ids": [...],
  "format": "csv",
  "fields": [
    "name",
    "country",
    "overall_score",
    "program_ratio",
    "total_revenue",
    "latest_fiscal_year"
  ]
}
```

**Response:** CSV file download

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK — request succeeded |
| 400 | Bad Request — invalid parameters |
| 401 | Unauthorized — missing/invalid API key |
| 403 | Forbidden — insufficient permissions |
| 404 | Not Found — organization doesn't exist |
| 429 | Too Many Requests — rate limit exceeded |
| 500 | Internal Server Error — server issue |
| 503 | Service Unavailable — maintenance |

---

## Pagination

Use cursor-based pagination for consistent results:

```bash
# First request
curl "https://api.opengive.org/v1/organizations/search?query=charity&limit=25"

# Response includes cursor
{
  "data": [...],
  "pagination": {
    "cursor": "abcd1234",
    "has_more": true
  }
}

# Next page
curl "https://api.opengive.org/v1/organizations/search?query=charity&cursor=abcd1234&limit=25"
```

---

## Examples

### JavaScript / Node.js

```javascript
import fetch from 'node-fetch';

async function searchCharities(query) {
  const response = await fetch(
    `https://api.opengive.org/v1/organizations/search`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.OPENGIVE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, limit: 25 }),
    }
  );

  const result = await response.json();
  return result.data;
}

const results = await searchCharities('Red Cross');
console.log(results);
```

### Python

```python
import requests

api_key = os.getenv('OPENGIVE_API_KEY')
headers = {'Authorization': f'Bearer {api_key}'}

response = requests.get(
    'https://api.opengive.org/v1/organizations/search',
    params={'query': 'Red Cross', 'limit': 25},
    headers=headers
)

organizations = response.json()['data']
print(organizations)
```

### cURL

```bash
curl -X GET "https://api.opengive.org/v1/organizations/search" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d "query=Red Cross" \
  -d "limit=25"
```

---

## SDKs & Libraries

Official SDKs coming soon:
- JavaScript/TypeScript
- Python
- Go
- Ruby

Community contributions welcome! See [Contributing Guide](./contributing.md).

---

## Support

- Documentation: https://docs.opengive.org
- GitHub Issues: https://github.com/opengive/opengive/issues
- Discussions: https://github.com/opengive/opengive/discussions
