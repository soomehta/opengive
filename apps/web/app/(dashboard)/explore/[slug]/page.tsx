import Link from 'next/link';
import { type Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { Badge, Button, Card, CardContent, CardHeader } from '@opengive/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Officer {
  id: string;
  name: string;
  title: string;
  compensation: number | null;
  hoursPerWeek: number | null;
}

interface Filing {
  id: string;
  fiscalYear: number;
  revenue: number;
  expenses: number;
  netAssets: number;
  form: string;
}

interface Grant {
  id: string;
  recipient: string;
  purpose: string;
  amount: number;
  year: number;
}

interface AnomalyAlert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  flaggedValue: string;
  detectedAt: string;
}

interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  country: string;
  countryFlag: string;
  status: 'active' | 'inactive' | 'revoked' | 'pending';
  sector: string;
  registrationIds: Record<string, string>;
  mission: string;
  totalRevenue: number;
  totalExpenses: number;
  netAssets: number;
  programExpenseRatio: number;
  officers: Officer[];
  filings: Filing[];
  grants: Grant[];
  alerts: AnomalyAlert[];
}

// ---------------------------------------------------------------------------
// Placeholder data — replace with tRPC / server fetch in Sprint 3
// ---------------------------------------------------------------------------

const PLACEHOLDER_ORG: OrgDetail = {
  id: '1',
  name: 'American Red Cross',
  slug: 'american-red-cross',
  country: 'United States',
  countryFlag: '🇺🇸',
  status: 'active',
  sector: 'Humanitarian',
  registrationIds: { EIN: '53-0196605', 'NTEE Code': 'M20' },
  mission:
    'The American Red Cross prevents and alleviates human suffering in the face of emergencies by mobilizing the power of volunteers and the generosity of donors.',
  totalRevenue: 2_900_000_000,
  totalExpenses: 2_750_000_000,
  netAssets: 1_200_000_000,
  programExpenseRatio: 0.91,
  officers: [
    { id: 'o1', name: 'Gail J. McGovern', title: 'President & CEO', compensation: 699_000, hoursPerWeek: 50 },
    { id: 'o2', name: 'Brian Rhoa', title: 'CFO', compensation: 420_000, hoursPerWeek: 45 },
    { id: 'o3', name: 'Cliff Holtz', title: 'COO', compensation: 395_000, hoursPerWeek: 45 },
  ],
  filings: [
    { id: 'f1', fiscalYear: 2023, revenue: 2_900_000_000, expenses: 2_750_000_000, netAssets: 1_200_000_000, form: '990' },
    { id: 'f2', fiscalYear: 2022, revenue: 2_650_000_000, expenses: 2_500_000_000, netAssets: 1_100_000_000, form: '990' },
    { id: 'f3', fiscalYear: 2021, revenue: 3_100_000_000, expenses: 2_900_000_000, netAssets: 950_000_000, form: '990' },
  ],
  grants: [
    { id: 'g1', recipient: 'Local Chapter — Houston', purpose: 'Disaster relief operations', amount: 45_000_000, year: 2023 },
    { id: 'g2', recipient: 'Blood Services Network', purpose: 'Blood supply chain', amount: 120_000_000, year: 2023 },
    { id: 'g3', recipient: 'Armed Forces Emergency', purpose: 'Military family support', amount: 28_000_000, year: 2022 },
  ],
  alerts: [
    { id: 'a1', severity: 'high', description: 'Revenue decline >15% year-over-year', flaggedValue: '-16.1%', detectedAt: '2024-03-01' },
    { id: 'a2', severity: 'medium', description: 'Executive compensation ratio exceeds peer median', flaggedValue: '0.024%', detectedAt: '2024-02-15' },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function statusVariant(status: OrgDetail['status']): 'success' | 'default' | 'danger' | 'warning' {
  switch (status) {
    case 'active': return 'success';
    case 'inactive': return 'default';
    case 'revoked': return 'danger';
    case 'pending': return 'warning';
  }
}

function alertVariant(severity: AnomalyAlert['severity']): 'danger' | 'warning' | 'info' | 'default' {
  switch (severity) {
    case 'critical': return 'danger';
    case 'high': return 'danger';
    case 'medium': return 'warning';
    case 'low': return 'info';
  }
}

// ---------------------------------------------------------------------------
// StatCard sub-component (Server Component)
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className="flex flex-col gap-1 p-4 rounded-md border border-[var(--border-subtle)]"
      style={{ backgroundColor: 'var(--surface-raised)' }}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
        {label}
      </p>
      <p
        className="font-bold text-[var(--text-primary)]"
        style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)' }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-xs text-[var(--text-tertiary)]">{sub}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function OrgDetailPage({ params }: Props) {
  const { slug } = await params;
  const t = await getTranslations('orgDetail');

  // In Sprint 3 this will be: const org = await serverTRPC.organizations.getBySlug({ slug });
  const org = slug === PLACEHOLDER_ORG.slug ? PLACEHOLDER_ORG : null;

  if (!org) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-semibold text-[var(--text-primary)] mb-2">{t('notFound')}</p>
        <Button asChild variant="ghost" size="sm">
          <Link href={'/explore' as Route}>{t('backToExplore')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-16">
      {/* Back link */}
      <div className="mb-6">
        <Link
          href={'/explore' as Route}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] rounded-sm"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t('backToExplore')}
        </Link>
      </div>

      {/* Org header */}
      <header className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Logo placeholder */}
            <div
              className="h-16 w-16 rounded-lg border border-[var(--border-default)] flex items-center justify-center text-3xl shrink-0"
              style={{ backgroundColor: 'var(--surface-raised)' }}
              aria-hidden="true"
            >
              {org.countryFlag}
            </div>
            <div>
              <h1
                className="font-bold text-[var(--text-primary)] leading-tight"
                style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)' }}
              >
                {org.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant={statusVariant(org.status)} size="sm">
                  {t(`status.${org.status}`)}
                </Badge>
                <Badge variant="default" size="sm" hideIcon>
                  {org.sector}
                </Badge>
                <span className="text-sm text-[var(--text-tertiary)]">
                  <span aria-hidden="true">{org.countryFlag} </span>
                  {org.country}
                </span>
              </div>
            </div>
          </div>

          <Button asChild variant="secondary" size="sm">
            <Link href={`/investigate?org=${org.slug}` as Route}>{t('investigate')}</Link>
          </Button>
        </div>

        {/* Registration IDs */}
        <dl className="flex flex-wrap gap-4 mt-4">
          {Object.entries(org.registrationIds).map(([key, value]) => (
            <div key={key}>
              <dt className="text-xs text-[var(--text-tertiary)]">{key}</dt>
              <dd
                className="text-sm font-medium text-[var(--text-primary)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      {/* Mission */}
      <section aria-labelledby="mission-heading" className="mb-8">
        <h2
          id="mission-heading"
          className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2"
        >
          {t('sections.overview')}
        </h2>
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{org.mission}</p>
      </section>

      {/* Key stats */}
      <section aria-labelledby="stats-heading" className="mb-8">
        <h2
          id="stats-heading"
          className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-3"
        >
          Key Metrics
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label={t('stats.revenue')} value={formatCurrency(org.totalRevenue)} sub="FY2023" />
          <StatCard label={t('stats.expenses')} value={formatCurrency(org.totalExpenses)} sub="FY2023" />
          <StatCard label={t('stats.netAssets')} value={formatCurrency(org.netAssets)} sub="FY2023" />
          <StatCard
            label={t('stats.programRatio')}
            value={formatPercent(org.programExpenseRatio)}
            sub="of expenses to programs"
          />
        </div>
      </section>

      {/* Officers & Directors */}
      <section aria-labelledby="officers-heading" className="mb-8">
        <Card>
          <CardHeader>{t('sections.officers')}</CardHeader>
          <CardContent noPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {[t('officers.name'), t('officers.title'), t('officers.compensation'), t('officers.hoursPerWeek')].map((col) => (
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
                  {org.officers.map((officer, i) => (
                    <tr
                      key={officer.id}
                      style={{
                        borderBottom: i < org.officers.length - 1 ? '1px solid var(--border-subtle)' : undefined,
                      }}
                      className="hover:bg-[var(--surface-elevated)] transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{officer.name}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{officer.title}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] font-mono text-xs">
                        {officer.compensation != null ? formatCurrency(officer.compensation) : '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {officer.hoursPerWeek != null ? `${officer.hoursPerWeek} hrs` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Financial Filings */}
      <section aria-labelledby="filings-heading" className="mb-8">
        <Card>
          <CardHeader>{t('sections.filings')}</CardHeader>
          <CardContent noPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {[t('filings.fiscalYear'), t('filings.revenue'), t('filings.expenses'), t('filings.netAssets'), t('filings.form')].map((col) => (
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
                  {org.filings.map((filing, i) => (
                    <tr
                      key={filing.id}
                      style={{
                        borderBottom: i < org.filings.length - 1 ? '1px solid var(--border-subtle)' : undefined,
                      }}
                      className="hover:bg-[var(--surface-elevated)] transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{filing.fiscalYear}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] font-mono text-xs">{formatCurrency(filing.revenue)}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] font-mono text-xs">{formatCurrency(filing.expenses)}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] font-mono text-xs">{formatCurrency(filing.netAssets)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="default" size="sm" hideIcon>{filing.form}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Grants */}
      <section aria-labelledby="grants-heading" className="mb-8">
        <Card>
          <CardHeader>{t('sections.grants')}</CardHeader>
          <CardContent noPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {[t('grants.recipient'), t('grants.purpose'), t('grants.amount'), t('grants.year')].map((col) => (
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
                  {org.grants.map((grant, i) => (
                    <tr
                      key={grant.id}
                      style={{
                        borderBottom: i < org.grants.length - 1 ? '1px solid var(--border-subtle)' : undefined,
                      }}
                      className="hover:bg-[var(--surface-elevated)] transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{grant.recipient}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{grant.purpose}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] font-mono text-xs">{formatCurrency(grant.amount)}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{grant.year}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Anomaly Alerts */}
      {org.alerts.length > 0 && (
        <section aria-labelledby="alerts-heading" className="mb-8">
          <Card>
            <CardHeader
              actions={
                <Badge variant="danger" size="sm">
                  {org.alerts.length} {org.alerts.length === 1 ? 'alert' : 'alerts'}
                </Badge>
              }
            >
              {t('sections.alerts')}
            </CardHeader>
            <CardContent>
              <ul role="list" className="flex flex-col gap-3">
                {org.alerts.map((alert) => (
                  <li
                    key={alert.id}
                    className="flex items-start gap-4 p-3 rounded-md border border-[var(--border-subtle)]"
                    style={{ backgroundColor: 'var(--surface-elevated)' }}
                  >
                    <Badge variant={alertVariant(alert.severity)} size="sm" className="mt-0.5 shrink-0">
                      {alert.severity}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--text-primary)]">{alert.description}</p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-1">
                        {t('alerts.flaggedValue')}:{' '}
                        <span
                          className="font-medium text-[var(--text-secondary)]"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {alert.flaggedValue}
                        </span>
                        {' '}·{' '}
                        {t('alerts.detected')} {alert.detectedAt}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
