import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { type Route } from 'next';
import { Badge } from '@opengive/ui';
import { createServerCaller } from '../../../../lib/trpc-server';

// ---------------------------------------------------------------------------
// Metadata — SEO + Open Graph
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  let name = slug.replace(/-/g, ' ');
  let description = `View ${name}'s public charity profile on OpenGive.`;

  try {
    const trpc = await createServerCaller();
    const org = await trpc.organizations.getBySlug({ slug });
    name = org.name;
    description =
      org.mission ??
      `${org.name} is a ${org.orgType ?? 'nonprofit'} based in ${org.countryCode}. View their financials, accountability scores, and more on OpenGive.`;
  } catch {
    // Non-existent slug falls through to notFound() below.
  }

  const title = `${name} — OpenGive`;
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://opengive.org'}/org/${slug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'OpenGive',
      type: 'profile',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    alternates: {
      canonical: url,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return 'N/A';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return 'N/A';
  if (num >= 1_000_000_000)
    return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// Share buttons (client island) — isolated to prevent SSR issues
// ---------------------------------------------------------------------------

function ShareButtons({ url, title }: { url: string; title: string }) {
  const twitterHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${title} on OpenGive`)}&url=${encodeURIComponent(url)}`;
  const linkedinHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
        Share:
      </span>

      {/* Copy link */}
      <button
        type="button"
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-emphasis)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]"
        onClick={() => void navigator.clipboard.writeText(url)}
        aria-label="Copy link to clipboard"
      >
        Copy link
      </button>

      {/* Twitter */}
      <a
        href={twitterHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-emphasis)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]"
        aria-label={`Share ${title} on X / Twitter`}
      >
        X / Twitter
      </a>

      {/* LinkedIn */}
      <a
        href={linkedinHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-emphasis)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]"
        aria-label={`Share ${title} on LinkedIn`}
      >
        LinkedIn
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-col gap-0.5 p-4 rounded-lg border border-[var(--border-subtle)]"
      style={{ backgroundColor: 'var(--surface-raised)' }}
    >
      <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
        {label}
      </p>
      <p
        className="text-lg font-bold"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
      >
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page — Server Component
// ---------------------------------------------------------------------------

export default async function PublicOrgProfilePage({ params }: PageProps) {
  const { slug } = await params;

  const trpc = await createServerCaller();

  let org;
  try {
    org = await trpc.organizations.getBySlug({ slug });
  } catch {
    notFound();
  }

  // Attempt to fetch latest financial data (non-fatal if missing)
  let latestFiling;
  try {
    const filingsResult = await trpc.organizations.getFilings({ orgId: org.id, limit: 1 });
    latestFiling = filingsResult.items[0] ?? null;
  } catch {
    latestFiling = null;
  }

  // Attempt to fetch latest score (non-fatal)
  let score;
  try {
    score = await trpc.organizations.getScore({ orgId: org.id });
  } catch {
    score = null;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://opengive.org';
  const pageUrl = `${appUrl}/org/${slug}`;
  const dashboardUrl = `/explore/${slug}`;

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--surface-base)' }}
    >
      {/* Navigation bar */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 md:px-8 border-b border-[var(--border-subtle)]"
        style={{ backgroundColor: 'var(--surface-base)' }}
      >
        <Link
          href={'/' as Route}
          className="text-sm font-semibold tracking-tight text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] rounded-sm"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          OpenGive
        </Link>
        <Link
          href={dashboardUrl as Route}
          className="inline-flex items-center gap-1.5 h-8 px-4 rounded-full text-sm font-medium text-[var(--surface-base)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]"
          style={{ backgroundColor: 'var(--accent-trust)' }}
        >
          Full dashboard
        </Link>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge
                  variant={
                    org.status === 'active'
                      ? 'default'
                      : org.status === 'dissolved'
                        ? 'danger'
                        : 'warning'
                  }
                >
                  {org.status ?? 'unknown'}
                </Badge>
                {org.countryCode && <Badge variant="default">{org.countryCode}</Badge>}
                {org.sector && <Badge variant="primary">{org.sector}</Badge>}
              </div>
              <h1
                className="text-3xl font-bold"
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--text-primary)',
                }}
              >
                {org.name}
              </h1>
              {org.nameLocal && org.nameLocal !== org.name && (
                <p
                  className="text-lg mt-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {org.nameLocal}
                </p>
              )}
            </div>
          </div>

          {/* Mission */}
          {org.mission && (
            <p
              className="text-base leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              {org.mission}
            </p>
          )}

          {/* Website */}
          {org.website && (
            <a
              href={org.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-sm text-[var(--accent-trust)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] rounded-sm"
            >
              {org.website}
            </a>
          )}
        </div>

        {/* Key stats */}
        <section aria-label="Key financial statistics" className="mb-8">
          <h2
            className="text-lg font-semibold mb-4"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
          >
            Key Stats
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatItem
              label="Total Revenue"
              value={formatCurrency(latestFiling?.totalRevenue)}
            />
            <StatItem
              label="Total Expenses"
              value={formatCurrency(latestFiling?.totalExpenses)}
            />
            <StatItem
              label="Program Ratio"
              value={
                latestFiling?.programExpenseRatio !== null &&
                latestFiling?.programExpenseRatio !== undefined
                  ? `${(latestFiling.programExpenseRatio * 100).toFixed(1)}%`
                  : 'N/A'
              }
            />
            <StatItem
              label="Overall Score"
              value={
                score?.overallScore !== null && score?.overallScore !== undefined
                  ? `${Math.round(score.overallScore)}/100`
                  : 'N/A'
              }
            />
          </div>
        </section>

        {/* Registration info */}
        <section aria-label="Registration information" className="mb-8">
          <h2
            className="text-lg font-semibold mb-4"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
          >
            Registration
          </h2>
          <dl
            className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm"
          >
            {[
              { term: 'Registry', value: org.registrySource },
              { term: 'Registry ID', value: org.registryId },
              { term: 'Country', value: org.countryCode },
              { term: 'Jurisdiction', value: org.jurisdiction },
              { term: 'Registered', value: org.registrationDate ?? null },
              { term: 'Last filing', value: org.lastFilingDate ?? null },
            ]
              .filter((row) => Boolean(row.value))
              .map((row) => (
                <div key={row.term} className="flex gap-2">
                  <dt
                    className="w-28 shrink-0 font-medium"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {row.term}
                  </dt>
                  <dd style={{ color: 'var(--text-primary)' }}>{row.value}</dd>
                </div>
              ))}
          </dl>
        </section>

        {/* Share + CTA */}
        <div
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-6 border-t"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <ShareButtons url={pageUrl} title={org.name} />
          <Link
            href={dashboardUrl as Route}
            className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full text-sm font-semibold text-[var(--surface-base)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]"
            style={{ backgroundColor: 'var(--accent-trust)' }}
          >
            View full dashboard
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center">
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Data sourced from public registries. Updated periodically.{' '}
            <Link
              href={'/' as Route}
              className="underline hover:text-[var(--text-primary)] transition-colors"
            >
              OpenGive
            </Link>{' '}
            — Follow the money.
          </p>
        </footer>
      </main>
    </div>
  );
}
