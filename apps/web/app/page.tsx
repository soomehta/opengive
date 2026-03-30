import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { type Route } from 'next';
import { Button } from '@opengive/ui';
import { HeroSearch } from '../components/HeroSearch';

// ---------------------------------------------------------------------------
// Inline icons
// ---------------------------------------------------------------------------

function IconSearch() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.75" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconFlows() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 16H3m0 0l4-4M3 16l4 4M17 8h4m0 0l-4-4m4 4l-4 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconExternalLink() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Landing page — Server Component
// ---------------------------------------------------------------------------

export default async function HomePage() {
  const t = await getTranslations('landing');
  const tHeader = await getTranslations('header');

  const stats = [
    { value: '2M+', label: t('stats.orgs') },
    { value: '30+', label: t('stats.countries') },
    { value: '$500B+', label: t('stats.flows') },
    { value: 'AI', label: t('stats.analysis') },
  ] as const;

  const features = [
    {
      icon: <IconSearch />,
      title: t('features.search.title'),
      description: t('features.search.description'),
    },
    {
      icon: <IconShield />,
      title: t('features.anomaly.title'),
      description: t('features.anomaly.description'),
    },
    {
      icon: <IconFlows />,
      title: t('features.flows.title'),
      description: t('features.flows.description'),
    },
  ] as const;

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ backgroundColor: 'var(--surface-base)', color: 'var(--text-primary)' }}
    >
      {/* Skip to content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-md focus:bg-[var(--accent-trust)] focus:text-white focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>

      {/* ------------------------------------------------------------------ */}
      {/* Public header                                                        */}
      {/* ------------------------------------------------------------------ */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-8 h-14"
        style={{
          backgroundColor: 'var(--surface-base)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <Link
          href={"/" as Route}
          className="text-sm font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] rounded-sm"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
        >
          OpenGive
        </Link>

        <nav aria-label="Site navigation" className="hidden sm:flex items-center gap-1">
          <Link
            href={"/explore" as Route}
            className="px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-[var(--surface-elevated)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]"
          >
            Dashboard
          </Link>
          <Link
            href="https://github.com/opengive/opengive"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-[var(--surface-elevated)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] inline-flex items-center gap-1.5"
          >
            {t('footer.github')}
            <IconExternalLink />
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href={"/login" as Route}>{tHeader('signIn')}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={"/explore" as Route}>{t('exploreDashboard')}</Link>
          </Button>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <main id="main-content" className="flex-1">
        <section
          className="relative flex flex-col items-center justify-center text-center px-4 pt-20 pb-16 md:pt-32 md:pb-24"
          aria-labelledby="hero-heading"
        >
          {/* Background glow blobs */}
          <div
            className="absolute inset-0 pointer-events-none overflow-hidden"
            aria-hidden="true"
          >
            <div
              className="absolute -top-20 -start-20 w-[500px] h-[400px] bg-[var(--accent-trust)] opacity-15 blur-3xl"
              style={{ borderRadius: '30% 70% 60% 40% / 50% 60% 40% 50%' }}
            />
            <div
              className="absolute -bottom-20 -end-20 w-[450px] h-[380px] bg-[#D4A574] opacity-10 blur-3xl"
              style={{ borderRadius: '60% 40% 30% 70% / 40% 50% 60% 50%' }}
            />
          </div>

          <div className="relative max-w-3xl mx-auto">
            {/* Eyebrow badge */}
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 mb-6 rounded-full text-xs font-medium border"
              style={{
                backgroundColor: 'var(--accent-trust-subtle)',
                color: 'var(--accent-trust)',
                borderColor: 'color-mix(in srgb, var(--accent-trust) 20%, transparent)',
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-trust)] animate-pulse" />
              Open-source &middot; Apache 2.0
            </span>

            <h1
              id="hero-heading"
              className="font-bold leading-tight mb-6"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-3xl)',
                color: 'var(--text-primary)',
              }}
            >
              {t('headline')}
              <br />
              <span style={{ color: 'var(--accent-trust)' }}>{t('headlineAccent')}</span>
            </h1>

            <p
              className="max-w-xl mx-auto mb-10 leading-relaxed"
              style={{ fontSize: 'var(--text-lg)', color: 'var(--text-secondary)' }}
            >
              {t('subtitle')}
            </p>

            {/* Search bar — navigates to /explore?q={query} */}
            <HeroSearch
              searchPlaceholder={t('searchPlaceholder')}
              searchAriaLabel={t('searchAriaLabel')}
            />

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link href={"/explore" as Route}>{t('exploreDashboard')}</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href={"/docs/api" as Route}>{t('getApiAccess')}</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Stats                                                              */}
        {/* ---------------------------------------------------------------- */}
        <section
          aria-label="Platform statistics"
          className="border-y border-[var(--border-subtle)] py-10 px-4"
          style={{ backgroundColor: 'var(--surface-raised)' }}
        >
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto text-center">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt
                  className="text-xs uppercase tracking-wide mb-1"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {stat.label}
                </dt>
                <dd
                  className="font-bold"
                  style={{
                    fontSize: 'var(--text-2xl)',
                    fontFamily: 'var(--font-display)',
                    color: 'var(--accent-trust)',
                  }}
                >
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Feature cards                                                      */}
        {/* ---------------------------------------------------------------- */}
        <section
          aria-labelledby="features-heading"
          className="py-16 md:py-24 px-4"
          style={{ backgroundColor: 'var(--surface-base)' }}
        >
          <div className="max-w-5xl mx-auto">
            <h2
              id="features-heading"
              className="text-center font-semibold mb-12"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-2xl)',
                color: 'var(--text-primary)',
              }}
            >
              Built for accountability
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {features.map((feature) => (
                <article
                  key={feature.title}
                  className="flex flex-col gap-4 p-6 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:shadow-[var(--shadow-hover)] hover:-translate-y-1 transition-all duration-300"
                  style={{ boxShadow: 'var(--shadow-sm)' }}
                >
                  <div
                    className="flex items-center justify-center h-12 w-12 rounded-2xl"
                    style={{
                      backgroundColor: 'var(--accent-trust-subtle)',
                      color: 'var(--accent-trust)',
                    }}
                    aria-hidden="true"
                  >
                    {feature.icon}
                  </div>
                  <h3
                    className="font-semibold"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--text-lg)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {feature.title}
                  </h3>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Final CTA band                                                     */}
        {/* ---------------------------------------------------------------- */}
        <section
          className="py-16 px-4 text-center"
          style={{ backgroundColor: 'var(--surface-raised)' }}
        >
          <div className="max-w-2xl mx-auto">
            <h2
              className="font-bold mb-4"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-2xl)',
                color: 'var(--text-primary)',
              }}
            >
              Start exploring today
            </h2>
            <p className="mb-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Free to use. No account required to browse. Open data, open source.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link href={"/explore" as Route}>{t('exploreDashboard')}</Link>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <Link
                  href="https://github.com/opengive/opengive"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  {t('footer.github')}
                  <IconExternalLink />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* Footer                                                               */}
      {/* ------------------------------------------------------------------ */}
      <footer
        className="py-8 px-4 border-t border-[var(--border-subtle)]"
        style={{ backgroundColor: 'var(--surface-base)' }}
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t('footer.copyright')}
          </p>
          <nav
            aria-label="Footer navigation"
            className="flex items-center gap-4"
          >
            <Link
              href="https://github.com/opengive/opengive"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] rounded-sm"
            >
              {t('footer.github')}
            </Link>
            <Link
              href={'/docs' as Route}
              className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] rounded-sm"
            >
              {t('footer.docs')}
            </Link>
            <Link
              href={'/docs/api' as Route}
              className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] rounded-sm"
            >
              {t('footer.api')}
            </Link>
            <Link
              href={'/privacy' as Route}
              className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] rounded-sm"
            >
              {t('footer.privacy')}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
