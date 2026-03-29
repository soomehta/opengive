'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  AlertCard,
  cn,
  type AlertCardData,
  type AlertSeverity,
  type AlertType,
} from '@opengive/ui';

// ---------------------------------------------------------------------------
// Placeholder data — replace with trpc.analysis.getAlerts.useInfiniteQuery() in S7
// ---------------------------------------------------------------------------

const SEVERITIES: AlertSeverity[] = ['low', 'medium', 'high', 'critical'];
const ALERT_TYPES: AlertType[] = [
  'overhead_manipulation',
  'related_party',
  'compensation_outlier',
  'revenue_expense_mismatch',
  'benford_violation',
  'network_anomaly',
  'filing_inconsistency',
  'geographic_discrepancy',
  'zero_fundraising',
  'rapid_growth',
  'shell_indicator',
  'other',
];
const COUNTRIES = ['United States', 'United Kingdom', 'Switzerland', 'Germany', 'Kenya', 'Canada'];

const ALERT_DESCRIPTIONS: Record<AlertType, string> = {
  overhead_manipulation: 'Overhead ratio appears to have been artificially suppressed below industry norms through reclassification of administrative costs.',
  related_party: 'Multiple transactions identified with entities sharing board members or addresses, suggesting undisclosed related-party relationships.',
  compensation_outlier: 'Executive compensation significantly exceeds 3 standard deviations above the sector median for organisations of this size.',
  revenue_expense_mismatch: 'Reported total expenses exceed total revenues for three consecutive years without deficit disclosure.',
  benford_violation: "First-digit distribution of financial figures deviates significantly from Benford's Law (p < 0.01).",
  network_anomaly: 'Unusual concentration of grant flows directed to a small cluster of recipient organisations with overlapping governance.',
  filing_inconsistency: 'Material discrepancies detected between data filed with the national registry and figures reported on Form 990.',
  geographic_discrepancy: 'Registered address and primary operations address are in jurisdictions with significantly different regulatory requirements.',
  zero_fundraising: 'Organisation reports zero fundraising expenditure yet claims significant public donation revenue.',
  rapid_growth: 'Revenue grew more than 500% year-over-year without corresponding increase in program outputs or staff.',
  shell_indicator: 'Organisation exhibits multiple indicators of shell entity structure: minimal staff, high cash reserves, low program expenditure.',
  other: 'Anomaly detected by AI forensic model. Manual review recommended.',
};

function generatePlaceholderAlerts(): AlertCardData[] {
  const orgs = [
    { id: '1', name: 'American Red Cross', slug: 'american-red-cross', country: 'United States' },
    { id: '2', name: 'Doctors Without Borders', slug: 'doctors-without-borders', country: 'Switzerland' },
    { id: '3', name: 'Oxfam International', slug: 'oxfam-international', country: 'United Kingdom' },
    { id: '4', name: 'Save the Children', slug: 'save-the-children', country: 'United Kingdom' },
    { id: '5', name: 'UNICEF USA', slug: 'unicef-usa', country: 'United States' },
    { id: '6', name: 'Caritas Germany', slug: 'caritas-germany', country: 'Germany' },
    { id: '7', name: 'Feed the Future', slug: 'feed-the-future', country: 'Kenya' },
    { id: '8', name: 'Gates Foundation', slug: 'gates-foundation', country: 'United States' },
  ];

  const alerts: AlertCardData[] = [];
  const base = Date.now();

  orgs.forEach((org, oi) => {
    SEVERITIES.forEach((severity, si) => {
      const type = ALERT_TYPES[(oi * 4 + si) % ALERT_TYPES.length]!;
      alerts.push({
        id: `alert-${org.id}-${si}`,
        severity,
        type,
        organizationId: org.id,
        organizationName: org.name,
        organizationSlug: org.slug,
        confidence: 55 + Math.floor(((oi * 7 + si * 13) % 40)),
        description: ALERT_DESCRIPTIONS[type],
        createdAt: new Date(base - (oi * 86_400_000 + si * 3_600_000)).toISOString(),
      });
    });
  });

  return alerts.sort((a, b) => {
    const severityOrder: Record<AlertSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

const ALL_ALERTS = generatePlaceholderAlerts();
const PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Alert type human labels
// ---------------------------------------------------------------------------

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  overhead_manipulation: 'Overhead Manipulation',
  related_party: 'Related Party',
  compensation_outlier: 'Compensation Outlier',
  revenue_expense_mismatch: 'Revenue/Expense Mismatch',
  benford_violation: 'Benford Violation',
  network_anomaly: 'Network Anomaly',
  filing_inconsistency: 'Filing Inconsistency',
  geographic_discrepancy: 'Geographic Discrepancy',
  zero_fundraising: 'Zero Fundraising',
  rapid_growth: 'Rapid Growth',
  shell_indicator: 'Shell Indicator',
  other: 'Other',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SELECT_CLASS = cn(
  'h-9 ps-3 pe-8 rounded-md text-sm border border-[var(--border-default)]',
  'bg-[var(--surface-raised)] text-[var(--text-secondary)]',
  'hover:border-[var(--border-emphasis)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]',
  'cursor-pointer appearance-none',
);

const SELECT_BG = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M6 9l6 6 6-6' stroke='%239BA3B5' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.5rem center',
} as React.CSSProperties;

// ---------------------------------------------------------------------------
// Severity stats bar
// ---------------------------------------------------------------------------

function SeverityStats({ alerts }: { alerts: AlertCardData[] }) {
  const counts = {
    critical: alerts.filter((a) => a.severity === 'critical').length,
    high: alerts.filter((a) => a.severity === 'high').length,
    medium: alerts.filter((a) => a.severity === 'medium').length,
    low: alerts.filter((a) => a.severity === 'low').length,
  };

  return (
    <div className="flex flex-wrap gap-3 mb-5" role="region" aria-label="Alert severity summary">
      {(
        [
          { key: 'critical', label: 'Critical', color: '#EF4444' },
          { key: 'high', label: 'High', color: '#EF4444' },
          { key: 'medium', label: 'Medium', color: '#F59E0B' },
          { key: 'low', label: 'Low', color: '#22C55E' },
        ] as const
      ).map(({ key, label, color }) => (
        <div
          key={key}
          className="flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2"
        >
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
          <span className="text-xs text-[var(--text-tertiary)]">{label}</span>
          <span className="text-sm font-semibold font-mono text-[var(--text-primary)]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            {counts[key]}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AlertsPage() {
  const router = useRouter();

  // Filters
  const [severity, setSeverity] = React.useState<AlertSeverity | ''>('');
  const [type, setType] = React.useState<AlertType | ''>('');
  const [country, setCountry] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');

  // Pagination
  const [page, setPage] = React.useState(1);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);

  // Highlighted alert (from URL in a real implementation)
  const [highlightedId] = React.useState<string | null>(null);

  // Apply filters
  const filtered = React.useMemo(() => {
    return ALL_ALERTS.filter((a) => {
      if (severity && a.severity !== severity) return false;
      if (type && a.type !== type) return false;
      // Country filter: match org country from lookup
      if (country) {
        const orgCountry =
          a.organizationName === 'American Red Cross' ? 'United States'
          : a.organizationName === 'UNICEF USA' ? 'United States'
          : a.organizationName === 'Gates Foundation' ? 'United States'
          : a.organizationName === 'Doctors Without Borders' ? 'Switzerland'
          : a.organizationName === 'Oxfam International' ? 'United Kingdom'
          : a.organizationName === 'Save the Children' ? 'United Kingdom'
          : a.organizationName === 'Caritas Germany' ? 'Germany'
          : a.organizationName === 'Feed the Future' ? 'Kenya'
          : '';
        if (orgCountry !== country) return false;
      }
      if (dateFrom) {
        const alertDate = typeof a.createdAt === 'string' ? a.createdAt : (a.createdAt as Date).toISOString();
        if (alertDate < dateFrom) return false;
      }
      if (dateTo) {
        const alertDate = typeof a.createdAt === 'string' ? a.createdAt : (a.createdAt as Date).toISOString();
        if (alertDate > dateTo + 'T23:59:59') return false;
      }
      return true;
    });
  }, [severity, type, country, dateFrom, dateTo]);

  const visible = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length < filtered.length;

  // Reset page on filter change
  React.useEffect(() => {
    setPage(1);
  }, [severity, type, country, dateFrom, dateTo]);

  function handleLoadMore() {
    setIsLoadingMore(true);
    // Simulate cursor-based fetch
    setTimeout(() => {
      setPage((p) => p + 1);
      setIsLoadingMore(false);
    }, 400);
  }

  function handleAlertClick(alert: AlertCardData) {
    if (alert.organizationSlug) {
      router.push(`/explore/${alert.organizationSlug}?alertId=${alert.id}` as Parameters<typeof router.push>[0]);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page header */}
      <div className="mb-5">
        <h1
          className="text-xl font-semibold text-[var(--text-primary)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Anomaly Alerts
        </h1>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">
          AI-powered forensic detections across all tracked organizations
        </p>
      </div>

      {/* Stats */}
      <SeverityStats alerts={filtered} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {/* Severity */}
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as AlertSeverity | '')}
          aria-label="Filter by severity"
          className={SELECT_CLASS}
          style={SELECT_BG}
        >
          <option value="">All severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>

        {/* Type */}
        <select
          value={type}
          onChange={(e) => setType(e.target.value as AlertType | '')}
          aria-label="Filter by alert type"
          className={SELECT_CLASS}
          style={SELECT_BG}
        >
          <option value="">All types</option>
          {ALERT_TYPES.map((t) => (
            <option key={t} value={t}>{ALERT_TYPE_LABELS[t]}</option>
          ))}
        </select>

        {/* Country */}
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          aria-label="Filter by country"
          className={SELECT_CLASS}
          style={SELECT_BG}
        >
          <option value="">All countries</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Date from */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="From date"
          className="h-9 px-3 rounded-md text-sm border border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:border-[var(--border-emphasis)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]"
        />
        <span className="text-[var(--text-tertiary)] text-xs">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="To date"
          className="h-9 px-3 rounded-md text-sm border border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:border-[var(--border-emphasis)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]"
        />

        {/* Clear filters */}
        {(severity || type || country || dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => { setSeverity(''); setType(''); setCountry(''); setDateFrom(''); setDateTo(''); }}
            className="text-xs text-[var(--accent-trust)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] rounded-sm ms-auto"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results count */}
      <p className="text-xs text-[var(--text-tertiary)] mb-4" aria-live="polite">
        {filtered.length} alert{filtered.length !== 1 ? 's' : ''}
        {(severity || type || country) && ' (filtered)'}
      </p>

      {/* Alert list */}
      {visible.length > 0 ? (
        <div className="flex flex-col gap-3 mb-6" role="feed" aria-label="Anomaly alerts">
          {visible.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onClick={handleAlertClick}
              highlighted={alert.id === highlightedId}
            />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center rounded-md border border-[var(--border-subtle)]">
          <p className="text-sm text-[var(--text-secondary)]">No alerts match the current filters</p>
          <button
            type="button"
            onClick={() => { setSeverity(''); setType(''); setCountry(''); setDateFrom(''); setDateTo(''); }}
            className="mt-2 text-xs text-[var(--accent-trust)] hover:underline"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pb-8">
          <Button
            variant="secondary"
            onClick={handleLoadMore}
            isLoading={isLoadingMore}
          >
            {isLoadingMore ? 'Loading more...' : 'Load more alerts'}
          </Button>
        </div>
      )}
    </div>
  );
}
