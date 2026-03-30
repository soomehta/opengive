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

function generateOrg(id: string, name: string, slug: string, country: string, flag: string, sector: string, revenue: number, status: OrgDetail['status'] = 'active'): OrgDetail {
  const expenses = Math.round(revenue * 0.92);
  const netAssets = Math.round(revenue * 0.4);
  return {
    id, name, slug, country, countryFlag: flag, status, sector,
    registrationIds: { 'Registration': `REG-${id.padStart(6, '0')}` },
    mission: `${name} is dedicated to advancing ${sector.toLowerCase()} initiatives ${country === 'United States' ? 'across the nation' : `in ${country}`} and around the world.`,
    totalRevenue: revenue,
    totalExpenses: expenses,
    netAssets,
    programExpenseRatio: 0.85 + Math.random() * 0.1,
    officers: [
      { id: `${id}-o1`, name: 'Executive Director', title: 'CEO', compensation: Math.round(revenue * 0.00008), hoursPerWeek: 50 },
      { id: `${id}-o2`, name: 'Finance Director', title: 'CFO', compensation: Math.round(revenue * 0.00005), hoursPerWeek: 45 },
    ],
    filings: [
      { id: `${id}-f1`, fiscalYear: 2023, revenue, expenses, netAssets, form: '990' },
      { id: `${id}-f2`, fiscalYear: 2022, revenue: Math.round(revenue * 0.95), expenses: Math.round(expenses * 0.94), netAssets: Math.round(netAssets * 0.9), form: '990' },
      { id: `${id}-f3`, fiscalYear: 2021, revenue: Math.round(revenue * 0.88), expenses: Math.round(expenses * 0.87), netAssets: Math.round(netAssets * 0.8), form: '990' },
    ],
    grants: [
      { id: `${id}-g1`, recipient: `${sector} Program Fund`, purpose: `Core ${sector.toLowerCase()} operations`, amount: Math.round(revenue * 0.015), year: 2023 },
      { id: `${id}-g2`, recipient: 'Regional Partners', purpose: 'Field operations support', amount: Math.round(revenue * 0.008), year: 2023 },
    ],
    alerts: revenue > 1_000_000_000 ? [
      { id: `${id}-a1`, severity: 'medium' as const, description: 'Executive compensation ratio above sector median', flaggedValue: '0.02%', detectedAt: '2024-02-15' },
    ] : [],
  };
}

const PLACEHOLDER_ORGS: Record<string, OrgDetail> = {
  'american-red-cross': generateOrg('1', 'American Red Cross', 'american-red-cross', 'United States', '🇺🇸', 'Humanitarian', 2_900_000_000),
  'doctors-without-borders': generateOrg('2', 'Doctors Without Borders', 'doctors-without-borders', 'Switzerland', '🇨🇭', 'Healthcare', 1_600_000_000),
  'oxfam-international': generateOrg('3', 'Oxfam International', 'oxfam-international', 'United Kingdom', '🇬🇧', 'Poverty Relief', 450_000_000),
  'save-the-children': generateOrg('4', 'Save the Children', 'save-the-children', 'United Kingdom', '🇬🇧', 'Children', 1_100_000_000),
  'world-wildlife-fund': generateOrg('5', 'World Wildlife Fund', 'world-wildlife-fund', 'Switzerland', '🇨🇭', 'Environment', 310_000_000),
  'unicef-usa': generateOrg('6', 'UNICEF USA', 'unicef-usa', 'United States', '🇺🇸', 'Children', 700_000_000),
  'gates-foundation': generateOrg('7', 'Gates Foundation', 'gates-foundation', 'United States', '🇺🇸', 'Global Health', 6_000_000_000),
  'habitat-for-humanity': generateOrg('8', 'Habitat for Humanity', 'habitat-for-humanity', 'United States', '🇺🇸', 'Housing', 1_800_000_000),
  'cancer-research-uk': generateOrg('9', 'Cancer Research UK', 'cancer-research-uk', 'United Kingdom', '🇬🇧', 'Medical Research', 680_000_000),
  'caritas-germany': generateOrg('10', 'Caritas Germany', 'caritas-germany', 'Germany', '🇩🇪', 'Social Services', 4_200_000_000),
  'feed-the-future': generateOrg('11', 'Feed the Future', 'feed-the-future', 'Kenya', '🇰🇪', 'Food Security', 55_000_000),
  'clean-water-foundation': generateOrg('12', 'Clean Water Foundation', 'clean-water-foundation', 'Canada', '🇨🇦', 'Water & Sanitation', 28_000_000, 'inactive'),
  // United States (additional)
  'ford-foundation': generateOrg('13', 'Ford Foundation', 'ford-foundation', 'United States', '🇺🇸', 'Education', 730_000_000),
  'care-usa': generateOrg('14', 'CARE USA', 'care-usa', 'United States', '🇺🇸', 'Humanitarian', 580_000_000),
  'world-vision-usa': generateOrg('15', 'World Vision USA', 'world-vision-usa', 'United States', '🇺🇸', 'Children', 1_100_000_000),
  'feeding-america': generateOrg('16', 'Feeding America', 'feeding-america', 'United States', '🇺🇸', 'Food Security', 3_400_000_000),
  'st-jude-research-hospital': generateOrg('17', 'St. Jude Research Hospital', 'st-jude-research-hospital', 'United States', '🇺🇸', 'Medical Research', 2_000_000_000),
  'nature-conservancy': generateOrg('18', 'Nature Conservancy', 'nature-conservancy', 'United States', '🇺🇸', 'Environment', 1_300_000_000),
  'direct-relief': generateOrg('19', 'Direct Relief', 'direct-relief', 'United States', '🇺🇸', 'Humanitarian', 2_100_000_000),
  'salvation-army-usa': generateOrg('20', 'Salvation Army USA', 'salvation-army-usa', 'United States', '🇺🇸', 'Social Services', 4_000_000_000),
  'boys-girls-clubs': generateOrg('21', 'Boys & Girls Clubs', 'boys-girls-clubs', 'United States', '🇺🇸', 'Children', 620_000_000),
  'march-of-dimes': generateOrg('22', 'March of Dimes', 'march-of-dimes', 'United States', '🇺🇸', 'Healthcare', 190_000_000, 'inactive'),
  'planned-parenthood-federation': generateOrg('23', 'Planned Parenthood Federation', 'planned-parenthood-federation', 'United States', '🇺🇸', 'Healthcare', 2_000_000_000),
  // United Kingdom (additional)
  'british-red-cross': generateOrg('24', 'British Red Cross', 'british-red-cross', 'United Kingdom', '🇬🇧', 'Humanitarian', 350_000_000),
  'barnardos': generateOrg('25', "Barnardo's", 'barnardos', 'United Kingdom', '🇬🇧', 'Children', 310_000_000),
  'national-trust': generateOrg('26', 'National Trust', 'national-trust', 'United Kingdom', '🇬🇧', 'Environment', 620_000_000),
  'age-uk': generateOrg('27', 'Age UK', 'age-uk', 'United Kingdom', '🇬🇧', 'Social Services', 170_000_000),
  'rnli': generateOrg('28', 'RNLI', 'rnli', 'United Kingdom', '🇬🇧', 'Disaster Relief', 230_000_000),
  'wellcome-trust': generateOrg('29', 'Wellcome Trust', 'wellcome-trust', 'United Kingdom', '🇬🇧', 'Medical Research', 1_400_000_000),
  'cafod': generateOrg('30', 'CAFOD', 'cafod', 'United Kingdom', '🇬🇧', 'Poverty Relief', 92_000_000),
  // Switzerland (additional)
  'international-red-cross': generateOrg('31', 'International Red Cross', 'international-red-cross', 'Switzerland', '🇨🇭', 'Humanitarian', 2_500_000_000),
  // Germany (additional)
  'diakonie-germany': generateOrg('32', 'Diakonie Germany', 'diakonie-germany', 'Germany', '🇩🇪', 'Social Services', 3_800_000_000),
  'giz-foundation': generateOrg('33', 'GIZ Foundation', 'giz-foundation', 'Germany', '🇩🇪', 'Global Health', 980_000_000),
  // Canada (additional)
  'canadian-red-cross': generateOrg('34', 'Canadian Red Cross', 'canadian-red-cross', 'Canada', '🇨🇦', 'Humanitarian', 520_000_000),
  'unicef-canada': generateOrg('35', 'UNICEF Canada', 'unicef-canada', 'Canada', '🇨🇦', 'Children', 110_000_000),
  // Australia
  'australian-red-cross': generateOrg('36', 'Australian Red Cross', 'australian-red-cross', 'Australia', '🇦🇺', 'Humanitarian', 480_000_000),
  'oxfam-australia': generateOrg('37', 'Oxfam Australia', 'oxfam-australia', 'Australia', '🇦🇺', 'Poverty Relief', 85_000_000),
  'fred-hollows-foundation': generateOrg('38', 'Fred Hollows Foundation', 'fred-hollows-foundation', 'Australia', '🇦🇺', 'Healthcare', 120_000_000),
  // India
  'helpage-india': generateOrg('39', 'HelpAge India', 'helpage-india', 'India', '🇮🇳', 'Social Services', 42_000_000),
  'cry-india': generateOrg('40', 'CRY India', 'cry-india', 'India', '🇮🇳', 'Children', 15_000_000),
  'akshaya-patra-foundation': generateOrg('41', 'Akshaya Patra Foundation', 'akshaya-patra-foundation', 'India', '🇮🇳', 'Food Security', 78_000_000),
  // France
  'medecins-du-monde': generateOrg('42', 'Médecins du Monde', 'medecins-du-monde', 'France', '🇫🇷', 'Healthcare', 150_000_000),
  'fondation-abbe-pierre': generateOrg('43', 'Fondation Abbé Pierre', 'fondation-abbe-pierre', 'France', '🇫🇷', 'Housing', 135_000_000),
  'action-contre-la-faim': generateOrg('44', 'Action Contre la Faim', 'action-contre-la-faim', 'France', '🇫🇷', 'Food Security', 500_000_000),
  // Kenya (additional)
  'kenya-red-cross': generateOrg('45', 'Kenya Red Cross', 'kenya-red-cross', 'Kenya', '🇰🇪', 'Humanitarian', 38_000_000),
  // Japan
  'japan-heart-foundation': generateOrg('46', 'Japan Heart Foundation', 'japan-heart-foundation', 'Japan', '🇯🇵', 'Healthcare', 92_000_000),
  'japan-platform': generateOrg('47', 'Japan Platform', 'japan-platform', 'Japan', '🇯🇵', 'Disaster Relief', 65_000_000),
  // Brazil
  'gerando-falcoes': generateOrg('48', 'Gerando Falcões', 'gerando-falcoes', 'Brazil', '🇧🇷', 'Education', 28_000_000),
  'instituto-ayrton-senna': generateOrg('49', 'Instituto Ayrton Senna', 'instituto-ayrton-senna', 'Brazil', '🇧🇷', 'Education', 47_000_000),
  // Netherlands
  'icco-cooperation': generateOrg('50', 'ICCO Cooperation', 'icco-cooperation', 'Netherlands', '🇳🇱', 'Poverty Relief', 115_000_000),
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

  // In production this will be: const org = await serverTRPC.organizations.getBySlug({ slug });
  const org = PLACEHOLDER_ORGS[slug] ?? null;

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
                        className="px-5 py-3.5 text-start text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]"
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
                      <td className="px-5 py-3.5 font-medium text-[var(--text-primary)]">{officer.name}</td>
                      <td className="px-5 py-3.5 text-[var(--text-secondary)]">{officer.title}</td>
                      <td className="px-5 py-3.5 text-[var(--text-secondary)] font-mono text-xs">
                        {officer.compensation != null ? formatCurrency(officer.compensation) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-[var(--text-secondary)]">
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
                        className="px-5 py-3.5 text-start text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]"
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
                      <td className="px-5 py-3.5 font-medium text-[var(--text-primary)]">{filing.fiscalYear}</td>
                      <td className="px-5 py-3.5 text-[var(--text-secondary)] font-mono text-xs">{formatCurrency(filing.revenue)}</td>
                      <td className="px-5 py-3.5 text-[var(--text-secondary)] font-mono text-xs">{formatCurrency(filing.expenses)}</td>
                      <td className="px-5 py-3.5 text-[var(--text-secondary)] font-mono text-xs">{formatCurrency(filing.netAssets)}</td>
                      <td className="px-5 py-3.5">
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
                        className="px-5 py-3.5 text-start text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]"
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
                      <td className="px-5 py-3.5 font-medium text-[var(--text-primary)]">{grant.recipient}</td>
                      <td className="px-5 py-3.5 text-[var(--text-secondary)]">{grant.purpose}</td>
                      <td className="px-5 py-3.5 text-[var(--text-secondary)] font-mono text-xs">{formatCurrency(grant.amount)}</td>
                      <td className="px-5 py-3.5 text-[var(--text-secondary)]">{grant.year}</td>
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
