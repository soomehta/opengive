'use client';

import * as React from 'react';
import Link from 'next/link';
import { type Route } from 'next';
import { useTranslations } from 'next-intl';
import {
  Badge,
  Card,
  CardContent,
  cn,
} from '@opengive/ui';
import { trpc } from '../../../lib/trpc';

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
  // United States (15)
  { id: '1',  name: 'American Red Cross',           slug: 'american-red-cross',          country: 'United States',   countryFlag: '🇺🇸', sector: 'Humanitarian',        latestRevenue: 2_900_000_000, alertCount: 2,  status: 'active'   },
  { id: '6',  name: 'UNICEF USA',                   slug: 'unicef-usa',                  country: 'United States',   countryFlag: '🇺🇸', sector: 'Children',            latestRevenue: 700_000_000,   alertCount: 3,  status: 'active'   },
  { id: '7',  name: 'Gates Foundation',             slug: 'gates-foundation',            country: 'United States',   countryFlag: '🇺🇸', sector: 'Global Health',       latestRevenue: 6_000_000_000, alertCount: 0,  status: 'active'   },
  { id: '8',  name: 'Habitat for Humanity',         slug: 'habitat-for-humanity',        country: 'United States',   countryFlag: '🇺🇸', sector: 'Housing',             latestRevenue: 1_800_000_000, alertCount: 1,  status: 'active'   },
  { id: '13', name: 'Ford Foundation',              slug: 'ford-foundation',             country: 'United States',   countryFlag: '🇺🇸', sector: 'Education',           latestRevenue: 730_000_000,   alertCount: 0,  status: 'active'   },
  { id: '14', name: 'CARE USA',                     slug: 'care-usa',                    country: 'United States',   countryFlag: '🇺🇸', sector: 'Humanitarian',        latestRevenue: 580_000_000,   alertCount: 4,  status: 'active'   },
  { id: '15', name: 'World Vision USA',             slug: 'world-vision-usa',            country: 'United States',   countryFlag: '🇺🇸', sector: 'Children',            latestRevenue: 1_100_000_000, alertCount: 1,  status: 'active'   },
  { id: '16', name: 'Feeding America',              slug: 'feeding-america',             country: 'United States',   countryFlag: '🇺🇸', sector: 'Food Security',       latestRevenue: 3_400_000_000, alertCount: 0,  status: 'active'   },
  { id: '17', name: 'St. Jude Research Hospital',  slug: 'st-jude-research-hospital',   country: 'United States',   countryFlag: '🇺🇸', sector: 'Medical Research',    latestRevenue: 2_000_000_000, alertCount: 0,  status: 'active'   },
  { id: '18', name: 'Nature Conservancy',           slug: 'nature-conservancy',          country: 'United States',   countryFlag: '🇺🇸', sector: 'Environment',         latestRevenue: 1_300_000_000, alertCount: 2,  status: 'active'   },
  { id: '19', name: 'Direct Relief',                slug: 'direct-relief',               country: 'United States',   countryFlag: '🇺🇸', sector: 'Humanitarian',        latestRevenue: 2_100_000_000, alertCount: 0,  status: 'active'   },
  { id: '20', name: 'Salvation Army USA',           slug: 'salvation-army-usa',          country: 'United States',   countryFlag: '🇺🇸', sector: 'Social Services',     latestRevenue: 4_000_000_000, alertCount: 5,  status: 'active'   },
  { id: '21', name: 'Boys & Girls Clubs',           slug: 'boys-girls-clubs',            country: 'United States',   countryFlag: '🇺🇸', sector: 'Children',            latestRevenue: 620_000_000,   alertCount: 0,  status: 'active'   },
  { id: '22', name: 'March of Dimes',               slug: 'march-of-dimes',              country: 'United States',   countryFlag: '🇺🇸', sector: 'Healthcare',          latestRevenue: 190_000_000,   alertCount: 8,  status: 'inactive' },
  { id: '23', name: 'Planned Parenthood Federation', slug: 'planned-parenthood-federation', country: 'United States', countryFlag: '🇺🇸', sector: 'Healthcare',        latestRevenue: 2_000_000_000, alertCount: 3,  status: 'active'   },
  // United Kingdom (10)
  { id: '3',  name: 'Oxfam International',          slug: 'oxfam-international',         country: 'United Kingdom',  countryFlag: '🇬🇧', sector: 'Poverty Relief',      latestRevenue: 450_000_000,   alertCount: 5,  status: 'active'   },
  { id: '4',  name: 'Save the Children',            slug: 'save-the-children',           country: 'United Kingdom',  countryFlag: '🇬🇧', sector: 'Children',            latestRevenue: 1_100_000_000, alertCount: 1,  status: 'active'   },
  { id: '9',  name: 'Cancer Research UK',           slug: 'cancer-research-uk',          country: 'United Kingdom',  countryFlag: '🇬🇧', sector: 'Medical Research',    latestRevenue: 680_000_000,   alertCount: 0,  status: 'active'   },
  { id: '24', name: 'British Red Cross',            slug: 'british-red-cross',           country: 'United Kingdom',  countryFlag: '🇬🇧', sector: 'Humanitarian',        latestRevenue: 350_000_000,   alertCount: 1,  status: 'active'   },
  { id: '25', name: "Barnardo's",                   slug: 'barnardos',                   country: 'United Kingdom',  countryFlag: '🇬🇧', sector: 'Children',            latestRevenue: 310_000_000,   alertCount: 0,  status: 'active'   },
  { id: '26', name: 'National Trust',               slug: 'national-trust',              country: 'United Kingdom',  countryFlag: '🇬🇧', sector: 'Environment',         latestRevenue: 620_000_000,   alertCount: 2,  status: 'active'   },
  { id: '27', name: 'Age UK',                       slug: 'age-uk',                      country: 'United Kingdom',  countryFlag: '🇬🇧', sector: 'Social Services',     latestRevenue: 170_000_000,   alertCount: 0,  status: 'active'   },
  { id: '28', name: 'RNLI',                         slug: 'rnli',                        country: 'United Kingdom',  countryFlag: '🇬🇧', sector: 'Disaster Relief',     latestRevenue: 230_000_000,   alertCount: 0,  status: 'active'   },
  { id: '29', name: 'Wellcome Trust',               slug: 'wellcome-trust',              country: 'United Kingdom',  countryFlag: '🇬🇧', sector: 'Medical Research',    latestRevenue: 1_400_000_000, alertCount: 1,  status: 'active'   },
  { id: '30', name: 'CAFOD',                        slug: 'cafod',                       country: 'United Kingdom',  countryFlag: '🇬🇧', sector: 'Poverty Relief',      latestRevenue: 92_000_000,    alertCount: 0,  status: 'active'   },
  // Switzerland (3)
  { id: '2',  name: 'Doctors Without Borders',      slug: 'doctors-without-borders',     country: 'Switzerland',     countryFlag: '🇨🇭', sector: 'Healthcare',          latestRevenue: 1_600_000_000, alertCount: 0,  status: 'active'   },
  { id: '5',  name: 'World Wildlife Fund',          slug: 'world-wildlife-fund',         country: 'Switzerland',     countryFlag: '🇨🇭', sector: 'Environment',         latestRevenue: 310_000_000,   alertCount: 0,  status: 'active'   },
  { id: '31', name: 'International Red Cross',      slug: 'international-red-cross',     country: 'Switzerland',     countryFlag: '🇨🇭', sector: 'Humanitarian',        latestRevenue: 2_500_000_000, alertCount: 0,  status: 'active'   },
  // Germany (3)
  { id: '10', name: 'Caritas Germany',              slug: 'caritas-germany',             country: 'Germany',         countryFlag: '🇩🇪', sector: 'Social Services',     latestRevenue: 4_200_000_000, alertCount: 7,  status: 'active'   },
  { id: '32', name: 'Diakonie Germany',             slug: 'diakonie-germany',            country: 'Germany',         countryFlag: '🇩🇪', sector: 'Social Services',     latestRevenue: 3_800_000_000, alertCount: 4,  status: 'active'   },
  { id: '33', name: 'GIZ Foundation',               slug: 'giz-foundation',              country: 'Germany',         countryFlag: '🇩🇪', sector: 'Global Health',       latestRevenue: 980_000_000,   alertCount: 0,  status: 'active'   },
  // Canada (3)
  { id: '12', name: 'Clean Water Foundation',       slug: 'clean-water-foundation',      country: 'Canada',          countryFlag: '🇨🇦', sector: 'Water & Sanitation',  latestRevenue: 28_000_000,    alertCount: 0,  status: 'inactive' },
  { id: '34', name: 'Canadian Red Cross',           slug: 'canadian-red-cross',          country: 'Canada',          countryFlag: '🇨🇦', sector: 'Humanitarian',        latestRevenue: 520_000_000,   alertCount: 1,  status: 'active'   },
  { id: '35', name: 'UNICEF Canada',                slug: 'unicef-canada',               country: 'Canada',          countryFlag: '🇨🇦', sector: 'Children',            latestRevenue: 110_000_000,   alertCount: 0,  status: 'active'   },
  // Australia (3)
  { id: '36', name: 'Australian Red Cross',         slug: 'australian-red-cross',        country: 'Australia',       countryFlag: '🇦🇺', sector: 'Humanitarian',        latestRevenue: 480_000_000,   alertCount: 1,  status: 'active'   },
  { id: '37', name: 'Oxfam Australia',              slug: 'oxfam-australia',             country: 'Australia',       countryFlag: '🇦🇺', sector: 'Poverty Relief',      latestRevenue: 85_000_000,    alertCount: 3,  status: 'active'   },
  { id: '38', name: 'Fred Hollows Foundation',      slug: 'fred-hollows-foundation',     country: 'Australia',       countryFlag: '🇦🇺', sector: 'Healthcare',          latestRevenue: 120_000_000,   alertCount: 0,  status: 'active'   },
  // India (3)
  { id: '39', name: 'HelpAge India',                slug: 'helpage-india',               country: 'India',           countryFlag: '🇮🇳', sector: 'Social Services',     latestRevenue: 42_000_000,    alertCount: 2,  status: 'active'   },
  { id: '40', name: 'CRY India',                    slug: 'cry-india',                   country: 'India',           countryFlag: '🇮🇳', sector: 'Children',            latestRevenue: 15_000_000,    alertCount: 0,  status: 'active'   },
  { id: '41', name: 'Akshaya Patra Foundation',     slug: 'akshaya-patra-foundation',    country: 'India',           countryFlag: '🇮🇳', sector: 'Food Security',       latestRevenue: 78_000_000,    alertCount: 0,  status: 'active'   },
  // France (3)
  { id: '42', name: 'Médecins du Monde',            slug: 'medecins-du-monde',           country: 'France',          countryFlag: '🇫🇷', sector: 'Healthcare',          latestRevenue: 150_000_000,   alertCount: 0,  status: 'active'   },
  { id: '43', name: 'Fondation Abbé Pierre',        slug: 'fondation-abbe-pierre',       country: 'France',          countryFlag: '🇫🇷', sector: 'Housing',             latestRevenue: 135_000_000,   alertCount: 1,  status: 'active'   },
  { id: '44', name: 'Action Contre la Faim',        slug: 'action-contre-la-faim',       country: 'France',          countryFlag: '🇫🇷', sector: 'Food Security',       latestRevenue: 500_000_000,   alertCount: 0,  status: 'active'   },
  // Kenya (2)
  { id: '11', name: 'Feed the Future',              slug: 'feed-the-future',             country: 'Kenya',           countryFlag: '🇰🇪', sector: 'Food Security',       latestRevenue: 55_000_000,    alertCount: 12, status: 'active'   },
  { id: '45', name: 'Kenya Red Cross',              slug: 'kenya-red-cross',             country: 'Kenya',           countryFlag: '🇰🇪', sector: 'Humanitarian',        latestRevenue: 38_000_000,    alertCount: 2,  status: 'active'   },
  // Japan (2)
  { id: '46', name: 'Japan Heart Foundation',       slug: 'japan-heart-foundation',      country: 'Japan',           countryFlag: '🇯🇵', sector: 'Healthcare',          latestRevenue: 92_000_000,    alertCount: 0,  status: 'active'   },
  { id: '47', name: 'Japan Platform',               slug: 'japan-platform',              country: 'Japan',           countryFlag: '🇯🇵', sector: 'Disaster Relief',     latestRevenue: 65_000_000,    alertCount: 1,  status: 'active'   },
  // Brazil (2)
  { id: '48', name: 'Gerando Falcões',              slug: 'gerando-falcoes',             country: 'Brazil',          countryFlag: '🇧🇷', sector: 'Education',           latestRevenue: 28_000_000,    alertCount: 0,  status: 'active'   },
  { id: '49', name: 'Instituto Ayrton Senna',       slug: 'instituto-ayrton-senna',      country: 'Brazil',          countryFlag: '🇧🇷', sector: 'Education',           latestRevenue: 47_000_000,    alertCount: 0,  status: 'active'   },
  // Netherlands (1)
  { id: '50', name: 'ICCO Cooperation',             slug: 'icco-cooperation',            country: 'Netherlands',     countryFlag: '🇳🇱', sector: 'Poverty Relief',      latestRevenue: 115_000_000,   alertCount: 0,  status: 'active'   },
];

const COUNTRIES = [
  'United States', 'United Kingdom', 'Switzerland', 'Germany', 'Canada',
  'Australia', 'India', 'France', 'Kenya', 'Japan', 'Brazil', 'Netherlands',
];

const SECTORS = [
  'Children', 'Disaster Relief', 'Education', 'Environment', 'Food Security',
  'Global Health', 'Healthcare', 'Housing', 'Humanitarian', 'Medical Research',
  'Poverty Relief', 'Social Services', 'Water & Sanitation',
];

const STATUSES = ['active', 'inactive', 'revoked', 'pending'];

const MIN_REVENUE_OPTIONS: { label: string; value: number }[] = [
  { label: 'Any', value: 0 },
  { label: '$100K+', value: 100_000 },
  { label: '$1M+', value: 1_000_000 },
  { label: '$10M+', value: 10_000_000 },
  { label: '$100M+', value: 100_000_000 },
  { label: '$1B+', value: 1_000_000_000 },
];

const MAX_REVENUE_OPTIONS: { label: string; value: number }[] = [
  { label: 'Any', value: Infinity },
  { label: '$1M', value: 1_000_000 },
  { label: '$10M', value: 10_000_000 },
  { label: '$100M', value: 100_000_000 },
  { label: '$1B', value: 1_000_000_000 },
  { label: '$10B', value: 10_000_000_000 },
];

type AlertFilter = '' | 'has' | 'none' | 'critical';
type SortKey = 'name-asc' | 'name-desc' | 'revenue-desc' | 'revenue-asc' | 'alerts-desc' | 'newest';

const PAGE_SIZE = 12;

// Inline SVG chevron background for select elements
const SELECT_BG =
  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\'%3E%3Cpath d=\'M6 9l6 6 6-6\' stroke=\'%239BA3B5\' stroke-width=\'2\' stroke-linecap=\'round\'/%3E%3C/svg%3E")';

const SELECT_CLASS =
  'h-9 px-3 pe-8 rounded-full text-sm border border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:border-[var(--border-emphasis)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] cursor-pointer appearance-none';

const SELECT_STYLE: React.CSSProperties = {
  backgroundImage: SELECT_BG,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.5rem center',
};

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
    case 'active':   return 'success';
    case 'inactive': return 'default';
    case 'revoked':  return 'danger';
    case 'pending':  return 'warning';
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

function IconReset() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 3v5h5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
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
// Pagination
// ---------------------------------------------------------------------------

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}

function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  const t = useTranslations('explore');

  if (totalPages <= 1) return null;

  // Build the visible page number list: always show up to 5 pages centred on current
  function buildPageRange(): (number | 'ellipsis')[] {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | 'ellipsis')[] = [1];
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);

    if (start > 2) pages.push('ellipsis');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push('ellipsis');
    pages.push(totalPages);
    return pages;
  }

  const range = buildPageRange();

  const btnBase = cn(
    'inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-full text-sm font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface-base)]',
    'disabled:opacity-40 disabled:cursor-not-allowed',
  );

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-1 py-8"
    >
      {/* Previous */}
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label={t('pagination.previous')}
        className={cn(
          btnBase,
          'px-3 gap-1 border',
          page === 1
            ? 'border-[var(--border-subtle)] text-[var(--text-tertiary)] bg-transparent cursor-not-allowed opacity-40'
            : 'border-[var(--border-default)] text-[var(--text-secondary)] bg-[var(--surface-raised)] hover:border-[var(--border-emphasis)] hover:text-[var(--text-primary)]',
        )}
      >
        {t('pagination.previous')}
      </button>

      {/* Page numbers */}
      {range.map((item, idx) =>
        item === 'ellipsis' ? (
          <span
            key={`ellipsis-${idx}`}
            className="inline-flex items-center justify-center h-8 w-8 text-sm text-[var(--text-tertiary)] select-none"
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-label={t('pagination.pageLabel', { page: item })}
            aria-current={page === item ? 'page' : undefined}
            className={cn(
              btnBase,
              page === item
                ? 'bg-[var(--accent-trust)] text-white border border-[var(--accent-trust)]'
                : 'border border-[var(--border-default)] text-[var(--text-secondary)] bg-[var(--surface-raised)] hover:border-[var(--border-emphasis)] hover:text-[var(--text-primary)]',
            )}
          >
            {item}
          </button>
        ),
      )}

      {/* Next */}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        aria-label={t('pagination.next')}
        className={cn(
          btnBase,
          'px-3 gap-1 border',
          page === totalPages
            ? 'border-[var(--border-subtle)] text-[var(--text-tertiary)] bg-transparent cursor-not-allowed opacity-40'
            : 'border-[var(--border-default)] text-[var(--text-secondary)] bg-[var(--surface-raised)] hover:border-[var(--border-emphasis)] hover:text-[var(--text-primary)]',
        )}
      >
        {t('pagination.next')}
      </button>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Explore page
// ---------------------------------------------------------------------------

// Country code to flag emoji
const FLAG_MAP: Record<string, string> = {
  US: '🇺🇸', GB: '🇬🇧', CH: '🇨🇭', DE: '🇩🇪', CA: '🇨🇦', AU: '🇦🇺',
  IN: '🇮🇳', FR: '🇫🇷', KE: '🇰🇪', JP: '🇯🇵', BR: '🇧🇷', NL: '🇳🇱',
};

// Country code to display name
const COUNTRY_NAME: Record<string, string> = {
  US: 'United States', GB: 'United Kingdom', CH: 'Switzerland', DE: 'Germany',
  CA: 'Canada', AU: 'Australia', IN: 'India', FR: 'France', KE: 'Kenya',
  JP: 'Japan', BR: 'Brazil', NL: 'Netherlands',
};

export default function ExplorePage() {
  const t = useTranslations('explore');

  const [query,      setQuery]      = React.useState('');
  const [country,    setCountry]    = React.useState('');
  const [sector,     setSector]     = React.useState('');
  const [status,     setStatus]     = React.useState('');
  const [minRevenue, setMinRevenue] = React.useState(0);
  const [maxRevenue, setMaxRevenue] = React.useState(Infinity);
  const [alertFilter, setAlertFilter] = React.useState<AlertFilter>('');
  const [sortKey,    setSortKey]    = React.useState<SortKey>('name-asc');
  const [view,       setView]       = React.useState<'card' | 'table'>('card');
  const [page,       setPage]       = React.useState(1);

  // Fetch live data from Supabase via tRPC — falls back to placeholder if DB unavailable
  const liveQuery = trpc.organizations.search.useQuery(
    { query: query || undefined, limit: 100 },
    { retry: 1, refetchOnWindowFocus: false }
  );

  // Map DB rows to the OrgResult shape the UI expects
  const liveOrgs: OrgResult[] = React.useMemo(() => {
    if (!liveQuery.data?.items?.length) return [];
    return liveQuery.data.items.map((row: Record<string, unknown>) => ({
      id: String(row.id ?? ''),
      name: String(row.name ?? ''),
      slug: String(row.slug ?? ''),
      country: COUNTRY_NAME[String(row.countryCode ?? '')] ?? String(row.countryCode ?? ''),
      countryFlag: FLAG_MAP[String(row.countryCode ?? '')] ?? '🌍',
      sector: String(row.sector ?? row.orgType ?? ''),
      latestRevenue: Number(row.totalRevenue ?? row.dataCompleteness ?? 0),
      alertCount: 0,
      status: (String(row.status ?? 'active')) as OrgResult['status'],
    }));
  }, [liveQuery.data]);

  // Use live data if available, otherwise fall back to placeholder
  const dataSource = liveOrgs.length > 0 ? liveOrgs : PLACEHOLDER_ORGS;
  const dbTotal = liveOrgs.length > 0 ? liveOrgs.length : null;

  // Client-side filter + sort over whichever data source is active
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();

    const result = dataSource.filter((org) => {
      if (q && !org.name.toLowerCase().includes(q) && !org.sector.toLowerCase().includes(q)) return false;
      if (country && org.country !== country) return false;
      if (sector && org.sector !== sector) return false;
      if (status && org.status !== status) return false;
      if (org.latestRevenue < minRevenue) return false;
      if (org.latestRevenue > maxRevenue) return false;
      if (alertFilter === 'has' && org.alertCount === 0) return false;
      if (alertFilter === 'none' && org.alertCount > 0) return false;
      if (alertFilter === 'critical' && org.alertCount < 8) return false;
      return true;
    });

    result.sort((a, b) => {
      switch (sortKey) {
        case 'name-asc':      return a.name.localeCompare(b.name);
        case 'name-desc':     return b.name.localeCompare(a.name);
        case 'revenue-desc':  return b.latestRevenue - a.latestRevenue;
        case 'revenue-asc':   return a.latestRevenue - b.latestRevenue;
        case 'alerts-desc':   return b.alertCount - a.alertCount;
        case 'newest':        return Number(b.id) - Number(a.id);
        default:              return 0;
      }
    });

    return result;
  }, [query, country, sector, status, minRevenue, maxRevenue, alertFilter, sortKey]);

  const totalPages   = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStart    = (page - 1) * PAGE_SIZE;
  const pageOrgs     = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const visibleEnd   = Math.min(pageStart + PAGE_SIZE, filtered.length);

  function handleReset() {
    setQuery('');
    setCountry('');
    setSector('');
    setStatus('');
    setMinRevenue(0);
    setMaxRevenue(Infinity);
    setAlertFilter('');
    setSortKey('name-asc');
    setPage(1);
  }

  const isFiltered =
    query !== '' || country !== '' || sector !== '' || status !== '' ||
    minRevenue !== 0 || maxRevenue !== Infinity || alertFilter !== '' || sortKey !== 'name-asc';

  // Reset to page 1 whenever filters change
  React.useEffect(() => {
    setPage(1);
  }, [query, country, sector, status, minRevenue, maxRevenue, alertFilter, sortKey]);

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
            className="w-full h-10 ps-10 pe-4 rounded-full text-sm border border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] hover:border-[var(--border-emphasis)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)]"
          />
        </div>

        {/* Primary filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Country */}
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            aria-label={t('filters.country')}
            className={SELECT_CLASS}
            style={SELECT_STYLE}
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
            className={SELECT_CLASS}
            style={SELECT_STYLE}
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
            className={SELECT_CLASS}
            style={SELECT_STYLE}
          >
            <option value="">{t('filters.allStatuses')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Min revenue */}
          <select
            value={minRevenue}
            onChange={(e) => setMinRevenue(Number(e.target.value))}
            aria-label={t('filters.minRevenue')}
            className={SELECT_CLASS}
            style={SELECT_STYLE}
          >
            {MIN_REVENUE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value === 0 ? t('filters.minRevenue') : o.label}
              </option>
            ))}
          </select>

          {/* Max revenue */}
          <select
            value={maxRevenue === Infinity ? '' : maxRevenue}
            onChange={(e) => setMaxRevenue(e.target.value === '' ? Infinity : Number(e.target.value))}
            aria-label={t('filters.maxRevenue')}
            className={SELECT_CLASS}
            style={SELECT_STYLE}
          >
            <option value="">{t('filters.maxRevenue')}</option>
            {MAX_REVENUE_OPTIONS.filter((o) => o.value !== Infinity).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Alert filter */}
          <select
            value={alertFilter}
            onChange={(e) => setAlertFilter(e.target.value as AlertFilter)}
            aria-label={t('filters.alertFilter')}
            className={SELECT_CLASS}
            style={SELECT_STYLE}
          >
            <option value="">{t('filters.anyAlerts')}</option>
            <option value="has">{t('filters.hasAlerts')}</option>
            <option value="none">{t('filters.noAlerts')}</option>
            <option value="critical">{t('filters.criticalOnly')}</option>
          </select>

          {/* Sort */}
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            aria-label={t('filters.sortBy')}
            className={SELECT_CLASS}
            style={SELECT_STYLE}
          >
            <option value="name-asc">{t('filters.sortNameAsc')}</option>
            <option value="name-desc">{t('filters.sortNameDesc')}</option>
            <option value="revenue-desc">{t('filters.sortRevenueDesc')}</option>
            <option value="revenue-asc">{t('filters.sortRevenueAsc')}</option>
            <option value="alerts-desc">{t('filters.sortMostAlerts')}</option>
            <option value="newest">{t('filters.sortNewest')}</option>
          </select>

          {/* Reset filters */}
          {isFiltered && (
            <button
              type="button"
              onClick={handleReset}
              className={cn(
                'inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-medium transition-colors',
                'border border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-secondary)]',
                'hover:border-[var(--accent-warning)] hover:text-[var(--accent-warning)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]',
              )}
            >
              <IconReset />
              {t('filters.resetFilters')}
            </button>
          )}

          {/* View toggle */}
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
      <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)] mb-4">
        <p>{t('results.showing', { visible: visibleEnd, total: filtered.length })}</p>
        {dbTotal !== null && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'var(--accent-trust-subtle)', color: 'var(--accent-trust)' }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--signal-healthy)] animate-pulse" />
            {dbTotal} in database
          </span>
        )}
        {liveQuery.isLoading && (
          <span className="text-[var(--text-tertiary)]">Loading from database...</span>
        )}
      </div>

      {/* Results — Card view */}
      {view === 'card' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-2">
          {pageOrgs.length > 0 ? (
            pageOrgs.map((org) => <OrgCard key={org.id} org={org} />)
          ) : (
            <div className="col-span-full py-16 text-center">
              <p className="text-sm text-[var(--text-secondary)]">{t('results.noResults')}</p>
            </div>
          )}
        </div>
      )}

      {/* Results — Table view */}
      {view === 'table' && (
        <div className="mb-2 rounded-md border border-[var(--border-subtle)] overflow-hidden">
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
                {pageOrgs.length > 0 ? (
                  pageOrgs.map((org, i) => (
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

      {/* Numbered pagination */}
      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
