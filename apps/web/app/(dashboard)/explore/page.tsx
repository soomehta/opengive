'use client';

import * as React from 'react';
import Link from 'next/link';
import { type Route } from 'next';
import { useTranslations } from 'next-intl';
import {
  Badge,
  Button,
  Card,
  CardContent,
  cn,
} from '@opengive/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrgResult {
  id: string;
  name: string;
  slug: string;
  country: string;
  countryFlag: string;
  sector: string;
  latestRevenue: number;
  alertCount: number;
  status: 'active' | 'inactive' | 'revoked' | 'pending';
}

// ---------------------------------------------------------------------------
// Placeholder data — replace with trpc.organizations.search.useQuery() in S3
// ---------------------------------------------------------------------------

const PLACEHOLDER_ORGS: OrgResult[] = [
  { id: '1', name: 'American Red Cross', slug: 'american-red-cross', country: 'United States', countryFlag: '🇺🇸', sector: 'Humanitarian', latestRevenue: 2900000000, alertCount: 2, status: 'active' },
  { id: '2', name: 'Doctors Without Borders', slug: 'doctors-without-borders', country: 'Switzerland', countryFlag: '🇨🇭', sector: 'Healthcare', latestRevenue: 1600000000, alertCount: 0, status: 'active' },
  { id: '3', name: 'Oxfam International', slug: 'oxfam-international', country: 'United Kingdom', countryFlag: '🇬🇧', sector: 'Poverty Relief', latestRevenue: 450000000, alertCount: 5, status: 'active' },
  { id: '4', name: "Save the Children", slug: 'save-the-children', country: 'United Kingdom', countryFlag: '🇬🇧', sector: 'Children', latestRevenue: 1100000000, alertCount: 1, status: 'active' },
  { id: '5', name: 'World Wildlife Fund', slug: 'world-wildlife-fund', country: 'Switzerland', countryFlag: '🇨🇭', sector: 'Environment', latestRevenue: 310000000, alertCount: 0, status: 'active' },
  { id: '6', name: 'UNICEF USA', slug: 'unicef-usa', country: 'United States', countryFlag: '🇺🇸', sector: 'Children', latestRevenue: 700000000, alertCount: 3, status: 'active' },
  { id: '7', name: 'Gates Foundation', slug: 'gates-foundation', country: 'United States', countryFlag: '🇺🇸', sector: 'Global Health', latestRevenue: 6000000000, alertCount: 0, status: 'active' },
  { id: '8', name: 'Habitat for Humanity', slug: 'habitat-for-humanity', country: 'United States', countryFlag: '🇺🇸', sector: 'Housing', latestRevenue: 1800000000, alertCount: 1, status: 'active' },
  { id: '9', name: 'Cancer Research UK', slug: 'cancer-research-uk', country: 'United Kingdom', countryFlag: '🇬🇧', sector: 'Medical Research', latestRevenue: 680000000, alertCount: 0, status: 'active' },
  { id: '10', name: 'Caritas Germany', slug: 'caritas-germany', country: 'Germany', countryFlag: '🇩🇪', sector: 'Social Services', latestRevenue: 4200000000, alertCount: 7, status: 'active' },
  { id: '11', name: 'Feed the Future', slug: 'feed-the-future', country: 'Kenya', countryFlag: '🇰🇪', sector: 'Food Security', latestRevenue: 55000000, alertCount: 12, status: 'active' },
  { id: '12', name: 'Clean Water Foundation', slug: 'clean-water-foundation', country: 'Canada', countryFlag: '🇨🇦', sector: 'Water & Sanitation', latestRevenue: 28000000, alertCount: 0, status: 'inactive' },
];

const COUNTRIES = ['United States', 'United Kingdom', 'Switzerland', 'Germany', 'Kenya', 'Canada'];
const SECTORS = ['Humanitarian', 'Healthcare', 'Poverty Relief', 'Children', 'Environment', 'Global Health', 'Housing', 'Medical Research', 'Social Services', 'Food Security', 'Water & Sanitation'];
const STATUSES = ['active', 'inactive', 'revoked', 'pending'];

const PAGE_SIZE = 6;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRevenue(amount: number): string {
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(0)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

function statusVariant(status: OrgResult['status']): 'success' | 'default' | 'danger' | 'warning' {
  switch (status) {
    case 'active': return 'success';
    case 'inactive': return 'default';
    case 'revoked': return 'danger';
    case 'pending': return 'warning';
  }
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function IconSearch() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.75" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.75" />
      <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.75" />
      <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.75" />
      <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function IconTable() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h18M9 3v18M15 3v18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Org Card
// ---------------------------------------------------------------------------

function OrgCard({ org }: { org: OrgResult }) {
  const t = useTranslations('explore');
  return (
    <Card
      noOverflowClip
      className="hover:border-[var(--border-emphasis)] transition-colors duration-150"
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl leading-none shrink-0" aria-hidden="true">
              {org.countryFlag}
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                <Link
                  href={`/explore/${org.slug}` as Route}
                  className="hover:text-[var(--accent-trust)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] rounded-sm"
                >
                  {org.name}
                </Link>
              </h3>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{org.country}</p>
            </div>
          </div>
          <Badge variant={statusVariant(org.status)} size="sm">
            {org.status}
          </Badge>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Badge variant="default" size="sm" hideIcon>
            {org.sector}
          </Badge>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-[var(--text-tertiary)]">
              <span className="text-[var(--text-secondary)] font-medium">
                {formatRevenue(org.latestRevenue)}
              </span>{' '}
              {t('results.revenue')}
            </span>
            {org.alertCount > 0 && (
              <Badge variant="danger" size="sm">
                {org.alertCount} {t('results.alerts')}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Explore page
// ---------------------------------------------------------------------------

export default function ExplorePage() {
  const t = useTranslations('explore');

  const [query, setQuery] = React.useState('');
  const [country, setCountry] = React.useState('');
  const [sector, setSector] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [view, setView] = React.useState<'card' | 'table'>('card');
  const [page, setPage] = React.useState(1);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);

  // Client-side filter (replace with tRPC query in Sprint 3)
  const filtered = React.useMemo(() => {
    return PLACEHOLDER_ORGS.filter((org) => {
      const q = query.trim().toLowerCase();
      if (q && !org.name.toLowerCase().includes(q) && !org.sector.toLowerCase().includes(q)) return false;
      if (country && org.country !== country) return false;
      if (sector && org.sector !== sector) return false;
      if (status && org.status !== status) return false;
      return true;
    });
  }, [query, country, sector, status]);

  const visibleOrgs = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = visibleOrgs.length < filtered.length;

  function handleLoadMore() {
    setIsLoadingMore(true);
    // Simulate async cursor pagination
    setTimeout(() => {
      setPage((p) => p + 1);
      setIsLoadingMore(false);
    }, 400);
  }

  // Reset pagination on filter change
  React.useEffect(() => {
    setPage(1);
  }, [query, country, sector, status]);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1
          className="text-xl font-semibold text-[var(--text-primary)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('title')}
        </h1>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-3 mb-6">
        {/* Search input */}
        <div className="relative">
          <span className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
            <IconSearch />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchAriaLabel')}
            className="w-full h-10 ps-10 pe-4 rounded-md text-sm border border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] hover:border-[var(--border-emphasis)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)]"
          />
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Country */}
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            aria-label={t('filters.country')}
            className="h-9 px-3 pe-8 rounded-md text-sm border border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:border-[var(--border-emphasis)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] cursor-pointer appearance-none"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\'%3E%3Cpath d=\'M6 9l6 6 6-6\' stroke=\'%239BA3B5\' stroke-width=\'2\' stroke-linecap=\'round\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center' }}
          >
            <option value="">{t('filters.allCountries')}</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Sector */}
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            aria-label={t('filters.sector')}
            className="h-9 px-3 pe-8 rounded-md text-sm border border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:border-[var(--border-emphasis)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] cursor-pointer appearance-none"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\'%3E%3Cpath d=\'M6 9l6 6 6-6\' stroke=\'%239BA3B5\' stroke-width=\'2\' stroke-linecap=\'round\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center' }}
          >
            <option value="">{t('filters.allSectors')}</option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Status */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label={t('filters.status')}
            className="h-9 px-3 pe-8 rounded-md text-sm border border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:border-[var(--border-emphasis)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] cursor-pointer appearance-none"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\'%3E%3Cpath d=\'M6 9l6 6 6-6\' stroke=\'%239BA3B5\' stroke-width=\'2\' stroke-linecap=\'round\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center' }}
          >
            <option value="">{t('filters.allStatuses')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <div className="ms-auto flex items-center gap-1" role="group" aria-label="View toggle">
            <button
              type="button"
              onClick={() => setView('card')}
              aria-pressed={view === 'card'}
              aria-label={t('views.card')}
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-md border transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]',
                view === 'card'
                  ? 'bg-[var(--accent-trust-subtle)] text-[var(--accent-trust)] border-[var(--accent-trust)]/30'
                  : 'bg-[var(--surface-raised)] text-[var(--text-tertiary)] border-[var(--border-default)] hover:text-[var(--text-primary)]',
              )}
            >
              <IconGrid />
            </button>
            <button
              type="button"
              onClick={() => setView('table')}
              aria-pressed={view === 'table'}
              aria-label={t('views.table')}
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-md border transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]',
                view === 'table'
                  ? 'bg-[var(--accent-trust-subtle)] text-[var(--accent-trust)] border-[var(--accent-trust)]/30'
                  : 'bg-[var(--surface-raised)] text-[var(--text-tertiary)] border-[var(--border-default)] hover:text-[var(--text-primary)]',
              )}
            >
              <IconTable />
            </button>
          </div>
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-[var(--text-tertiary)] mb-4">
        {filtered.length} organizations
      </p>

      {/* Results — Card view */}
      {view === 'card' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          {visibleOrgs.length > 0 ? (
            visibleOrgs.map((org) => <OrgCard key={org.id} org={org} />)
          ) : (
            <div className="col-span-full py-16 text-center">
              <p className="text-sm text-[var(--text-secondary)]">{t('results.noResults')}</p>
            </div>
          )}
        </div>
      )}

      {/* Results — Table view */}
      {view === 'table' && (
        <div className="mb-6 rounded-md border border-[var(--border-subtle)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {[
                    t('table.name'),
                    t('table.country'),
                    t('table.sector'),
                    t('table.revenue'),
                    t('table.alerts'),
                    t('table.status'),
                  ].map((col) => (
                    <th
                      key={col}
                      scope="col"
                      className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleOrgs.length > 0 ? (
                  visibleOrgs.map((org, i) => (
                    <tr
                      key={org.id}
                      style={{
                        backgroundColor: i % 2 === 0 ? 'var(--surface-base)' : 'var(--surface-raised)',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                      className="hover:bg-[var(--surface-elevated)] transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                        <Link
                          href={`/explore/${org.slug}` as Route}
                          className="hover:text-[var(--accent-trust)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] rounded-sm"
                        >
                          {org.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        <span className="me-1.5" aria-hidden="true">{org.countryFlag}</span>
                        {org.country}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="default" size="sm" hideIcon>{org.sector}</Badge>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] font-mono text-xs">
                        {formatRevenue(org.latestRevenue)}
                      </td>
                      <td className="px-4 py-3">
                        {org.alertCount > 0 ? (
                          <Badge variant="danger" size="sm">
                            {org.alertCount}
                          </Badge>
                        ) : (
                          <span className="text-[var(--text-tertiary)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(org.status)} size="sm">
                          {org.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-sm text-[var(--text-secondary)]">
                      {t('results.noResults')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
            {isLoadingMore ? t('pagination.loading') : t('pagination.loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}
