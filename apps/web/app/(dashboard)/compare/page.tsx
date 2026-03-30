'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type Route } from 'next';
import { Badge, Card, CardContent } from '@opengive/ui';
import { trpc } from '../../../lib/trpc';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ORGS = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return `${(v * 100).toFixed(1)}%`;
}

function formatScore(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return `${Math.round(v)}/100`;
}

/** Returns the index of the highest numeric value in an array, or -1 if all are null. */
function bestIndex(values: (number | null | undefined)[]): number {
  let best = -Infinity;
  let idx = -1;
  values.forEach((v, i) => {
    if (v !== null && v !== undefined && !isNaN(Number(v)) && Number(v) > best) {
      best = Number(v);
      idx = i;
    }
  });
  return idx;
}

// ---------------------------------------------------------------------------
// Org search autocomplete
// ---------------------------------------------------------------------------

interface OrgOption {
  id: string;
  slug: string;
  name: string;
  countryCode: string;
}

interface OrgSelectorProps {
  placeholder?: string;
  onSelect: (org: OrgOption) => void;
  excluded: string[]; // slugs already selected
}

function OrgSelector({ placeholder = 'Search organizations…', onSelect, excluded }: OrgSelectorProps) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const { data, isFetching } = trpc.organizations.search.useQuery(
    { query: query.trim() || undefined, limit: 8 },
    { enabled: query.trim().length >= 1 },
  );

  const options: OrgOption[] =
    data?.items
      .filter((o) => !excluded.includes(o.slug))
      .map((o) => ({
        id: o.id,
        slug: o.slug,
        name: o.name,
        countryCode: o.countryCode,
      })) ?? [];

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        inputRef.current &&
        !inputRef.current.contains(e.target as Node) &&
        listRef.current &&
        !listRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        aria-label="Search organizations to compare"
        aria-autocomplete="list"
        aria-controls="compare-org-list"
        aria-expanded={open && options.length > 0}
        className="w-full h-10 px-3 rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-trust)]"
      />
      {isFetching && (
        <span
          className="absolute end-3 top-1/2 -translate-y-1/2 text-xs"
          style={{ color: 'var(--text-tertiary)' }}
          aria-hidden="true"
        >
          …
        </span>
      )}
      {open && options.length > 0 && (
        <ul
          id="compare-org-list"
          ref={listRef}
          role="listbox"
          className="absolute z-50 top-full start-0 end-0 mt-1 rounded-lg border border-[var(--border-default)] shadow-[var(--shadow-lg)] overflow-hidden py-1 max-h-56 overflow-y-auto"
          style={{ backgroundColor: 'var(--surface-raised)' }}
        >
          {options.map((opt) => (
            <li key={opt.id} role="option" aria-selected="false">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(opt);
                  setQuery('');
                  setOpen(false);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-start transition-colors hover:bg-[var(--surface-elevated)] focus-visible:outline-none"
              >
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  {opt.name}
                </span>
                <Badge variant="default">{opt.countryCode}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single org column data — fetches financials and score
// ---------------------------------------------------------------------------

interface OrgColumnData {
  slug: string;
  name: string;
  countryCode: string;
  sector: string | null | undefined;
  status: string | null | undefined;
  totalRevenue: number | string | null | undefined;
  totalExpenses: number | string | null | undefined;
  netAssets: number | string | null | undefined;
  programExpenseRatio: number | null | undefined;
  adminExpenseRatio: number | null | undefined;
  overallScore: number | null | undefined;
  transparencyScore: number | null | undefined;
  financialHealthScore: number | null | undefined;
  activeAlerts: number;
}

function useOrgColumnData(slug: string): {
  data: OrgColumnData | null;
  isLoading: boolean;
} {
  const orgQuery = trpc.organizations.getBySlug.useQuery({ slug }, { enabled: Boolean(slug) });
  const org = orgQuery.data;

  const filingsQuery = trpc.organizations.getFilings.useQuery(
    { orgId: org?.id ?? '', limit: 1 },
    { enabled: Boolean(org?.id) },
  );

  const scoreQuery = trpc.organizations.getScore.useQuery(
    { orgId: org?.id ?? '' },
    { enabled: Boolean(org?.id) },
  );

  const alertsQuery = trpc.organizations.getAlerts.useQuery(
    { orgId: org?.id ?? '', limit: 5 },
    { enabled: Boolean(org?.id) },
  );

  const isLoading =
    orgQuery.isLoading ||
    filingsQuery.isLoading ||
    scoreQuery.isLoading ||
    alertsQuery.isLoading;

  if (!org) return { data: null, isLoading };

  const filing = filingsQuery.data?.items[0] ?? null;
  const score = scoreQuery.data;
  const alertCount = alertsQuery.data?.items.length ?? 0;

  return {
    isLoading,
    data: {
      slug: org.slug,
      name: org.name,
      countryCode: org.countryCode,
      sector: org.sector,
      status: org.status,
      totalRevenue: filing?.totalRevenue,
      totalExpenses: filing?.totalExpenses,
      netAssets: filing?.netAssets,
      programExpenseRatio: filing?.programExpenseRatio,
      adminExpenseRatio: filing?.adminExpenseRatio,
      overallScore: score?.overallScore,
      transparencyScore: score?.transparencyScore,
      financialHealthScore: score?.financialHealthScore,
      activeAlerts: alertCount,
    },
  };
}

// ---------------------------------------------------------------------------
// Comparison row
// ---------------------------------------------------------------------------

interface CompareRowProps {
  label: string;
  values: (string | null)[];
  bestIdx?: number;
  isHeader?: boolean;
}

function CompareRow({ label, values, bestIdx = -1, isHeader }: CompareRowProps) {
  return (
    <tr
      className="border-b border-[var(--border-subtle)] last:border-0"
      style={{ backgroundColor: isHeader ? 'var(--surface-elevated)' : undefined }}
    >
      <td
        className="py-3 px-4 text-sm font-medium w-40 shrink-0"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {label}
      </td>
      {values.map((v, i) => (
        <td
          key={i}
          className="py-3 px-4 text-sm font-medium text-center"
          style={{
            color:
              i === bestIdx
                ? 'var(--signal-healthy)'
                : 'var(--text-primary)',
            fontWeight: i === bestIdx ? 700 : 500,
          }}
        >
          {i === bestIdx && v !== '—' ? (
            <span
              className="inline-flex items-center gap-1"
              title="Best value"
            >
              {v}
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: 'var(--signal-healthy)' }}
                aria-label="Best"
              />
            </span>
          ) : (
            v ?? '—'
          )}
        </td>
      ))}
      {/* Empty cells for columns not yet filled */}
      {Array.from({ length: MAX_ORGS - values.length }).map((_, i) => (
        <td key={`empty-${i}`} className="py-3 px-4" />
      ))}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Org column header with remove button
// ---------------------------------------------------------------------------

function ColumnHeader({
  data,
  slug,
  isLoading,
  onRemove,
}: {
  data: OrgColumnData | null;
  slug: string;
  isLoading: boolean;
  onRemove: () => void;
}) {
  return (
    <th className="py-3 px-4 text-center font-normal align-top">
      {isLoading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-[var(--surface-elevated)] rounded mx-auto w-3/4" />
          <div className="h-3 bg-[var(--surface-elevated)] rounded mx-auto w-1/2" />
        </div>
      ) : data ? (
        <div className="flex flex-col items-center gap-1">
          <Link
            href={`/explore/${data.slug}` as Route}
            className="font-semibold text-sm hover:underline"
            style={{ color: 'var(--accent-trust)', fontFamily: 'var(--font-display)' }}
          >
            {data.name}
          </Link>
          <div className="flex items-center gap-1 flex-wrap justify-center">
            <Badge variant="default">{data.countryCode}</Badge>
            {data.sector && <Badge variant="primary">{data.sector}</Badge>}
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="text-xs mt-1 text-[var(--text-tertiary)] hover:text-[var(--signal-danger)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] rounded"
            aria-label={`Remove ${data.name} from comparison`}
          >
            Remove
          </button>
        </div>
      ) : (
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {slug}
        </span>
      )}
    </th>
  );
}

// ---------------------------------------------------------------------------
// Main comparison table
// ---------------------------------------------------------------------------

interface CompareTableProps {
  slugs: string[];
  onRemove: (slug: string) => void;
}

function CompareTable({ slugs, onRemove }: CompareTableProps) {
  const col0 = useOrgColumnData(slugs[0] ?? '');
  const col1 = useOrgColumnData(slugs[1] ?? '');
  const col2 = useOrgColumnData(slugs[2] ?? '');

  const cols = [col0, col1, col2].slice(0, slugs.length);

  // Extract raw numeric values for best-value highlighting
  function numericValues<K extends keyof OrgColumnData>(key: K) {
    return cols.map((c) => {
      const v = c.data?.[key];
      return typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : null;
    });
  }

  const revenueVals = numericValues('totalRevenue');
  const expenseVals = numericValues('totalExpenses'); // lower is better — skip highlighting
  const netAssetVals = numericValues('netAssets');
  const progRatioVals = numericValues('programExpenseRatio');
  const adminRatioVals = numericValues('adminExpenseRatio'); // lower is better
  const scoreVals = numericValues('overallScore');
  const transVals = numericValues('transparencyScore');
  const finVals = numericValues('financialHealthScore');
  // alerts: lower is better — negate for bestIndex
  const alertVals = cols.map((c) =>
    c.data ? -c.data.activeAlerts : null,
  );

  const rows: CompareRowProps[] = [
    {
      label: 'Status',
      values: cols.map((c) => c.data?.status ?? '—'),
    },
    {
      label: 'Total Revenue',
      values: cols.map((c) => formatCurrency(c.data?.totalRevenue)),
      bestIdx: bestIndex(revenueVals),
    },
    {
      label: 'Total Expenses',
      values: cols.map((c) => formatCurrency(c.data?.totalExpenses)),
    },
    {
      label: 'Net Assets',
      values: cols.map((c) => formatCurrency(c.data?.netAssets)),
      bestIdx: bestIndex(netAssetVals),
    },
    {
      label: 'Program Ratio',
      values: cols.map((c) => formatPct(c.data?.programExpenseRatio)),
      bestIdx: bestIndex(progRatioVals),
    },
    {
      label: 'Admin Ratio',
      values: cols.map((c) => formatPct(c.data?.adminExpenseRatio)),
    },
    {
      label: 'Overall Score',
      values: cols.map((c) => formatScore(c.data?.overallScore)),
      bestIdx: bestIndex(scoreVals),
    },
    {
      label: 'Transparency',
      values: cols.map((c) => formatScore(c.data?.transparencyScore)),
      bestIdx: bestIndex(transVals),
    },
    {
      label: 'Financial Health',
      values: cols.map((c) => formatScore(c.data?.financialHealthScore)),
      bestIdx: bestIndex(finVals),
    },
    {
      label: 'Active Alerts',
      values: cols.map((c) =>
        c.data ? String(c.data.activeAlerts) : '—',
      ),
      bestIdx: bestIndex(alertVals),
    },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-[var(--border-subtle)]">
            <th
              className="py-3 px-4 text-start text-xs font-semibold uppercase tracking-wide w-40"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Metric
            </th>
            {slugs.map((slug, i) => (
              <ColumnHeader
                key={slug}
                data={cols[i]?.data ?? null}
                slug={slug}
                isLoading={cols[i]?.isLoading ?? false}
                onRemove={() => onRemove(slug)}
              />
            ))}
            {/* Empty placeholder headers for missing columns */}
            {Array.from({ length: MAX_ORGS - slugs.length }).map((_, i) => (
              <th key={`empty-th-${i}`} className="py-3 px-4 w-40" />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <CompareRow key={row.label} {...row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ComparePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse slugs from ?orgs=slug1,slug2,slug3
  const rawOrgs = searchParams.get('orgs') ?? '';
  const slugs = rawOrgs
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_ORGS);

  function updateSlugs(next: string[]) {
    const unique = Array.from(new Set(next)).slice(0, MAX_ORGS);
    const params = new URLSearchParams(searchParams.toString());
    if (unique.length > 0) {
      params.set('orgs', unique.join(','));
    } else {
      params.delete('orgs');
    }
    router.replace(`/compare?${params.toString()}` as Route);
  }

  function addOrg(org: { slug: string }) {
    updateSlugs([...slugs, org.slug]);
  }

  function removeOrg(slug: string) {
    updateSlugs(slugs.filter((s) => s !== slug));
  }

  const canAddMore = slugs.length < MAX_ORGS;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
        >
          Compare Organizations
        </h1>
        <p className="mt-1" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Side-by-side comparison of up to {MAX_ORGS} organizations. Best value per row is
          highlighted.
        </p>
      </div>

      {/* Search input to add orgs */}
      {canAddMore && (
        <div className="mb-6 max-w-sm">
          <OrgSelector
            placeholder={`Add organization (${slugs.length}/${MAX_ORGS})…`}
            onSelect={addOrg}
            excluded={slugs}
          />
        </div>
      )}

      {/* Empty state */}
      {slugs.length === 0 && (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <svg
                className="mx-auto mb-4 h-12 w-12"
                style={{ color: 'var(--text-tertiary)' }}
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                No organizations selected
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Search for organizations above to start comparing them side by side.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparison table */}
      {slugs.length > 0 && (
        <Card>
          <CardContent className="p-0 overflow-hidden">
            <CompareTable slugs={slugs} onRemove={removeOrg} />
          </CardContent>
        </Card>
      )}

      {/* Permalink hint */}
      {slugs.length > 1 && (
        <p className="mt-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          This comparison is shareable — copy the URL to share it with others.
        </p>
      )}
    </div>
  );
}
