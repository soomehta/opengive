---
sidebar_position: 4
---

# Scoring Methodology

This document explains OpenGive's transparent, auditable scoring system. Every threshold, weight, and formula is documented here and implemented in code.

## Philosophy

OpenGive scores are **not judgments of quality**. They are **quantitative summaries** of publicly available data. A low score doesn't mean an organization is bad — it means certain financial indicators warrant investigation.

All scores are:
- **Transparent** — every calculation is visible and reproducible
- **Adjustable** — users can recalculate scores with custom weights
- **Explainable** — breakdown shows which factors drove the score
- **Comparable** — normalized 0-100 across all jurisdictions and organization sizes

## Overall Score Formula

```
Overall Score = 0.25 × Financial_Health + 0.25 × Transparency +
                0.25 × Governance + 0.25 × Efficiency
```

Each component scores 0-100 independently, then weighted equally in the composite.

A score of 70+ indicates "healthy and transparent" — the median for most sectors.

---

## 1. Financial Health Score (0-100)

Assesses the organization's financial stability and sustainability.

### Components

#### 1.1 Revenue Trend (Weight: 30%)

Measures multi-year revenue growth stability.

```
years_of_data = count of fiscal years with revenue > $0
if years_of_data < 2:
    return 25  # Not enough history to assess

revenue_trend = (revenue_year_n - revenue_year_1) / revenue_year_1
if revenue_trend >= 0.10:    # 10%+ growth
    growth_score = 100
elif revenue_trend >= 0.00:  # Flat or positive
    growth_score = 75
elif revenue_trend >= -0.10: # Up to 10% decline
    growth_score = 50
elif revenue_trend >= -0.30: # 10-30% decline
    growth_score = 25
else:                         # >30% decline
    growth_score = 0

# Volatility penalty: if year-over-year changes >20%, reduce score
if max_yoy_change > 0.20:
    growth_score *= (1 - max_yoy_change / 2)

return clamp(growth_score, 0, 100)
```

**Interpretation:** Stable or growing revenue is healthy. Volatile or declining revenue suggests organizational stress.

#### 1.2 Working Capital Adequacy (Weight: 30%)

Measures liquid resources relative to annual expenses.

```
working_capital = current_assets - current_liabilities

if total_expenses == 0:
    return 50  # Can't calculate ratio

working_capital_ratio = working_capital / total_expenses

if working_capital_ratio >= 0.50:      # 6+ months of expenses
    wc_score = 100
elif working_capital_ratio >= 0.33:    # 4 months
    wc_score = 85
elif working_capital_ratio >= 0.17:    # 2 months
    wc_score = 70
elif working_capital_ratio >= 0.08:    # 1 month
    wc_score = 50
elif working_capital_ratio >= 0:       # Some WC
    wc_score = 25
else:                                   # Negative WC
    wc_score = 0

return clamp(wc_score, 0, 100)
```

**Benchmark:** Organizations with 2-6 months of expenses in working capital are considered financially stable. Less than 1 month is risky.

#### 1.3 Revenue Diversification (Weight: 20%)

Uses the Herfindahl-Hirschman Index to measure concentration of revenue sources.

```
# Revenue sources: grants, contributions, program revenue, investment income, other
revenue_sources = [grants, contributions, program_revenue, investment, other]
revenue_sources = [s for s in revenue_sources if s > 0]  # Exclude zero sources

if len(revenue_sources) == 0:
    return 25  # No diversification data

# Normalize each source as percentage of total
total_revenue = sum(revenue_sources)
percentages = [s / total_revenue for s in revenue_sources]

# Herfindahl index: HHI = sum of (percentage)^2
# Lower HHI = more diversified; HHI ranges 1/n to 1
hhi = sum(p ** 2 for p in percentages)
n = len(revenue_sources)

# Convert HHI to 0-100 score (1/n = diversified = 100, 1.0 = concentrated = 0)
normalized_hhi = (hhi - (1/n)) / (1 - (1/n))
diversification_score = 100 * (1 - normalized_hhi)

return clamp(diversification_score, 0, 100)
```

**Interpretation:** High HHI (concentrated sources) = vulnerable to loss of major donor. Low HHI (diverse) = resilient.

Example: Organization getting 100% from one government grant = low diversification. Org with equal grants, donations, and program fees = high diversification.

#### 1.4 Cash Reserves Adequacy (Weight: 20%)

Measures cash and liquid investments relative to monthly expenses.

```
cash_and_equivalents = cash_on_hand + short_term_investments

if total_expenses == 0:
    return 50

monthly_expenses = total_expenses / 12
cash_months = cash_and_equivalents / monthly_expenses

if cash_months >= 6:         # 6+ months
    cash_score = 100
elif cash_months >= 3:       # 3-6 months
    cash_score = 85
elif cash_months >= 1:       # 1-3 months
    cash_score = 70
elif cash_months >= 0.5:     # 15+ days
    cash_score = 50
elif cash_months > 0:        # Some cash
    cash_score = 25
else:
    cash_score = 0

return clamp(cash_score, 0, 100)
```

**Benchmark:** Reserve funds of 3-6 months expenses are standard for nonprofits. Less than 1 month is concerning for operational continuity.

### Financial Health Calculation

```
Financial_Health = (
    0.30 × Revenue_Trend +
    0.30 × Working_Capital +
    0.20 × Diversification +
    0.20 × Cash_Reserves
)
```

---

## 2. Transparency Score (0-100)

Assesses the completeness and timeliness of public financial reporting.

### Components

#### 2.1 Filing Completeness (Weight: 40%)

Percentage of expected data fields populated in filings.

```
filing_schema = {
    "organization": ["name", "address", "founded_year", "website"],
    "financials": ["revenue", "expenses", "assets", "liabilities"],
    "personnel": ["ceo_name", "ceo_compensation", "board_size"],
    "governance": ["conflict_policy", "audit_status", "audit_firm"],
    "programs": ["program_descriptions", "program_expenses"],
}

total_expected_fields = sum(len(v) for v in filing_schema.values())
populated_fields = count of non-null fields in actual filing

completeness = populated_fields / total_expected_fields
completeness_score = completeness * 100

return clamp(completeness_score, 0, 100)
```

**Interpretation:** A complete filing has all standard fields populated. Sparse filings are opaque.

#### 2.2 Filing Timeliness (Weight: 30%)

Days elapsed between fiscal year end and filing date.

```
filing_lag = fiscal_year_end_date - filing_date_submitted

# Typical requirements: 4-6 months after year end
if filing_lag <= 120:        # 4 months
    timeliness_score = 100
elif filing_lag <= 180:      # 6 months
    timeliness_score = 85
elif filing_lag <= 240:      # 8 months
    timeliness_score = 70
elif filing_lag <= 365:      # 1 year
    timeliness_score = 50
elif filing_lag <= 730:      # 2 years
    timeliness_score = 25
else:
    timeliness_score = 0

return clamp(timeliness_score, 0, 100)
```

**Interpretation:** Fast filings indicate operational discipline and enable timely accountability. Late filings suggest delays in reporting.

#### 2.3 Audit Status (Weight: 20%)

Independent vs. self-reported financials.

```
if audit_type == "independent_audit":
    audit_score = 100       # Third-party verified
elif audit_type == "review_engagement":
    audit_score = 75        # Reviewed but not audited
elif audit_type == "compiled":
    audit_score = 50        # Compiled only
elif audit_type == "self_reported":
    audit_score = 25        # No external verification
else:
    audit_score = 0         # Unknown

return audit_score
```

**Interpretation:** Independent audits are gold standard for accountability. Self-reported financials offer no external verification.

#### 2.4 Data Availability (Weight: 10%)

Multi-year history and completeness.

```
years_of_filings = count of fiscal years with full filing
if years_of_filings >= 5:
    availability_score = 100
elif years_of_filings >= 3:
    availability_score = 85
elif years_of_filings >= 2:
    availability_score = 70
elif years_of_filings == 1:
    availability_score = 50
else:
    availability_score = 0

return availability_score
```

**Interpretation:** Multi-year data enables trend analysis. Single-year data is insufficient for assessment.

### Transparency Calculation

```
Transparency = (
    0.40 × Completeness +
    0.30 × Timeliness +
    0.20 × Audit_Status +
    0.10 × Data_Availability
)
```

---

## 3. Governance Score (0-100)

Assesses board structure, independence, and oversight mechanisms.

### Components

#### 3.1 Board Size Adequacy (Weight: 35%)

Optimal board size for oversight without becoming unwieldy.

```
board_size = count of board members

# Optimal range: 5-25 members (industry best practice)
if 5 <= board_size <= 25:
    size_score = 100
elif 3 <= board_size <= 30:
    size_score = 75
elif 1 <= board_size <= 40:
    size_score = 50
else:
    size_score = 0

return size_score
```

**Interpretation:** Very small boards (<3) lack diverse perspectives. Very large boards (>30) become unwieldy. Optimal is 5-15.

#### 3.2 Board Independence (Weight: 35%)

Percentage of board members with no financial relationship to organization.

```
independent_members = count of members with no compensation/employment
total_members = count of all board members

if total_members == 0:
    return 0

independence_ratio = independent_members / total_members

if independence_ratio >= 0.80:      # 80%+ independent
    independence_score = 100
elif independence_ratio >= 0.67:    # 67%+ independent
    independence_score = 85
elif independence_ratio >= 0.50:    # 50%+ independent
    independence_score = 70
elif independence_ratio >= 0.33:    # 33%+ independent
    independence_score = 50
else:
    independence_score = 25

return clamp(independence_score, 0, 100)
```

**Interpretation:** Independent boards provide stronger oversight. Boards with majority compensation relationships are conflicts of interest.

#### 3.3 Officer Disclosure (Weight: 20%)

Completeness of executive leadership information.

```
required_officers = ["Executive Director", "Treasurer", "Board Chair"]

disclosed_officers = 0
for officer in required_officers:
    if officer_record_exists(officer) and officer.name and officer.title:
        disclosed_officers += 1

disclosure_ratio = disclosed_officers / len(required_officers)
disclosure_score = disclosure_ratio * 100

return disclosure_score
```

**Interpretation:** Named leadership with titles indicates accountability. Undisclosed officers raise transparency concerns.

#### 3.4 Conflict of Interest Policy (Weight: 10%)

Presence of written conflict of interest policy.

```
if conflict_policy_disclosed:
    policy_score = 100
else:
    policy_score = 0

return policy_score
```

**Interpretation:** Written policies demonstrate governance commitment.

### Governance Calculation

```
Governance = (
    0.35 × Board_Size +
    0.35 × Board_Independence +
    0.20 × Officer_Disclosure +
    0.10 × Conflict_Policy
)
```

---

## 4. Efficiency Score (0-100)

Assesses how effectively the organization deploys resources to its mission.

### Components

#### 4.1 Program Expense Ratio (Weight: 40%)

Percentage of expenses directed to programs (vs. overhead).

```
program_ratio = program_expenses / total_expenses

# Benchmark: >75% is excellent (Charity Navigator standard)
if program_ratio >= 0.75:
    program_score = 100
elif program_ratio >= 0.60:
    program_score = 85
elif program_ratio >= 0.50:
    program_score = 70
elif program_ratio >= 0.40:
    program_score = 50
elif program_ratio >= 0.25:
    program_score = 25
else:
    program_score = 0

return clamp(program_score, 0, 100)
```

**Interpretation:** Higher program ratio = more mission-focused spending. Lower ratios suggest excessive overhead.

#### 4.2 Fundraising Efficiency (Weight: 25%)

Cost per dollar raised.

```
fundraising_expenses = direct fundraising costs
contributions_grants = revenue from contributions and grants

if contributions_grants == 0:
    return 50  # Can't calculate (not donor-funded)

cost_per_dollar = fundraising_expenses / contributions_grants

# Benchmark: <$0.25 per $1 raised is efficient
if cost_per_dollar <= 0.10:
    fundraising_score = 100
elif cost_per_dollar <= 0.20:
    fundraising_score = 85
elif cost_per_dollar <= 0.30:
    fundraising_score = 70
elif cost_per_dollar <= 0.50:
    fundraising_score = 50
elif cost_per_dollar <= 1.00:
    fundraising_score = 25
else:                         # >$1 per $1 (losing money fundraising)
    fundraising_score = 0

return clamp(fundraising_score, 0, 100)
```

**Interpretation:** Efficient fundraising maximizes dollars for mission. High-cost fundraising may indicate over-investment in development.

#### 4.3 Administrative Expense Ratio (Weight: 25%)

Percentage of expenses on management and general operations.

```
admin_ratio = (management_general_expenses) / total_expenses

# Benchmark: 15% is acceptable; <10% is excellent
if admin_ratio <= 0.10:
    admin_score = 100
elif admin_ratio <= 0.15:
    admin_score = 85
elif admin_ratio <= 0.20:
    admin_score = 70
elif admin_ratio <= 0.30:
    admin_score = 50
elif admin_ratio <= 0.50:
    admin_score = 25
else:
    admin_score = 0

return clamp(admin_score, 0, 100)
```

**Interpretation:** Lower admin costs allow more resources to programs. Very high admin costs (>50%) suggest top-heavy operations.

#### 4.4 Joint Cost Handling (Weight: 10%)

Penalty for excessive allocation of joint costs to programs.

```
joint_costs = costs allocated to both program and admin
if joint_costs / total_expenses > 0.20:  # >20% of total
    joint_penalty = 1 - (joint_costs / total_expenses) / 2
else:
    joint_penalty = 1.0

# Apply as modifier to efficiency score
efficiency_score *= joint_penalty
```

**Interpretation:** Large joint costs can obscure true program vs. admin allocation. Excessive joint costs reduce credibility.

### Efficiency Calculation

```
Efficiency = (
    0.40 × Program_Expense_Ratio +
    0.25 × Fundraising_Efficiency +
    0.25 × Admin_Expense_Ratio +
    0.10 × Joint_Cost_Penalty
)
```

---

## Anomaly Detection Rules

Beyond composite scores, OpenGive flags specific patterns warranting investigation.

### Critical Anomalies

#### 1. Shell Indicator
```
CONDITION:
  shared_address_count > 3 AND shared_director_count > 2

INTERPRETATION:
  Organization shares physical address and multiple directors with
  other entities. May indicate shell network or related-party control.

SEVERITY: Critical
ACTION: Automatic alert to investigators
```

#### 2. Zero Fundraising Despite Large Contributions
```
CONDITION:
  fundraising_expenses == 0 AND
  contributions_grants > 500,000

INTERPRETATION:
  Organization reports no fundraising costs while receiving large
  contributions. Either exceptionally efficient or data error.

SEVERITY: High
ACTION: Flag for manual review
```

#### 3. Compensation Outlier
```
CONDITION:
  ceo_compensation > (peer_median * 2) AND
  total_revenue < 5,000,000

INTERPRETATION:
  Executive compensation dramatically exceeds peer benchmarks for
  similarly-sized organizations. May indicate overpayment.

SEVERITY: High
ACTION: Automatic alert
```

### Medium Anomalies

#### 4. Benford's Law Violation
```
CONDITION:
  benford_chi_squared_p_value < 0.01

INTERPRETATION:
  Financial figures don't follow expected first-digit distribution
  (Benford's Law). May indicate fabricated data or rounding.

SEVERITY: Medium
ACTION: Flag for analyst review
```

#### 5. Overhead Expense Flip
```
CONDITION:
  abs(admin_ratio_year_n - admin_ratio_year_n-1) > 0.20

INTERPRETATION:
  Administrative expense ratio shifts >20 percentage points year-over-year.
  Suggests expense reclassification rather than true efficiency change.

SEVERITY: Medium
ACTION: Flag for analyst review
```

#### 6. Revenue Cliff
```
CONDITION:
  (revenue_year_n - revenue_year_n-1) / revenue_year_n-1 < -0.50

INTERPRETATION:
  Revenue declined >50% year-over-year. Indicates severe organizational
  stress, major funding loss, or possible distress.

SEVERITY: Medium
ACTION: Automatic alert
```

---

## Score Breakdown & Explainability

Every organization's score includes a detailed breakdown showing which factors contributed:

```json
{
  "organization_id": "550e8400-e29b-41d4-a716-446655440000",
  "fiscal_year": 2023,
  "methodology_version": "v1",
  "overall_score": 76,
  "components": {
    "financial_health": {
      "score": 72,
      "breakdown": {
        "revenue_trend": 80,
        "working_capital": 65,
        "diversification": 72,
        "cash_reserves": 70
      }
    },
    "transparency": {
      "score": 82,
      "breakdown": {
        "filing_completeness": 85,
        "filing_timeliness": 100,
        "audit_status": 75,
        "data_availability": 60
      }
    },
    "governance": {
      "score": 75,
      "breakdown": {
        "board_size": 80,
        "board_independence": 70,
        "officer_disclosure": 85,
        "conflict_policy": 50
      }
    },
    "efficiency": {
      "score": 75,
      "breakdown": {
        "program_ratio": 78,
        "fundraising_efficiency": 75,
        "admin_ratio": 72,
        "joint_costs": 75
      }
    }
  },
  "anomalies": [
    {
      "code": "revenue_cliff",
      "severity": "medium",
      "description": "Revenue declined 48% from 2022 to 2023"
    }
  ]
}
```

---

## Methodology Configuration

All scoring parameters are configurable via `packages/config/src/scoring.ts`:

```typescript
export const SCORING_CONFIG = {
  version: 'v1',
  weights: {
    financial_health: 0.25,
    transparency: 0.25,
    governance: 0.25,
    efficiency: 0.25,
  },
  thresholds: {
    working_capital_months: 2,
    cash_reserve_months: 3,
    program_ratio_benchmark: 0.75,
    fundraising_cost_benchmark: 0.25,
    admin_ratio_benchmark: 0.15,
    ...
  },
  anomaly_rules: {
    revenue_cliff_threshold: -0.50,
    overhead_flip_threshold: 0.20,
    shell_indicator_addresses: 3,
    shell_indicator_directors: 2,
    ...
  }
}
```

Users can recalculate scores with custom weights via the API:

```bash
POST /v1/organizations/{id}/score
{
  "weights": {
    "financial_health": 0.4,
    "transparency": 0.3,
    "governance": 0.2,
    "efficiency": 0.1
  }
}
```

---

## Limitations & Disclaimers

- **Scores are not judgments** — they're quantitative summaries of reported data
- **Data quality varies by jurisdiction** — US IRS 990 is more complete than India NGO Darpan
- **Sector-specific context missing** — Endowed university foundation has different norms than homeless shelter
- **One-time events obscured** — Revenue cliff from major program ending looks the same as funding loss
- **Small organizations under-represented** — Many sources don't capture organizations under $50K revenue
- **International comparability limited** — Different reporting standards across jurisdictions

Always combine scores with qualitative research and local knowledge.

---

## References & Benchmarks

- [Charity Navigator Methodology](https://www.charitynavigator.org/index.cfm?bay=content.view&cpid=35)
- [BBB Wise Giving Alliance Standards](https://www.give.org/get-charity-reviews/giving-guidance)
- [Form 990 Instructions (IRS)](https://www.irs.gov/publications/p557)
- [UK Charity Commission Guidance](https://www.charitycommission.gov.uk/)
- [Herfindahl-Hirschman Index (Economics)](https://en.wikipedia.org/wiki/Herfindahl_index)
- [Benford's Law in Forensic Accounting](https://en.wikipedia.org/wiki/Benford%27s_law)

---

## Next Steps

- Query scores via the [API Reference](./api-reference.md)
- Configure custom weights for your investigation
- Use anomaly alerts to identify organizations for deeper research
- Review the [Contributing Guide](./contributing.md) to improve methodology
