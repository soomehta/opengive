import type { Metadata } from 'next';
import { ApiPlayground } from '../../../../components/ApiPlayground';

export const metadata: Metadata = {
  title: 'API Documentation — OpenGive',
  description:
    'Explore the OpenGive public REST API. 2M+ organizations, anomaly signals, and financial data across 30+ registries.',
};

// ---------------------------------------------------------------------------
// Info card sub-component (server component — no 'use client' needed)
// ---------------------------------------------------------------------------

interface InfoCardProps {
  title: string;
  children: React.ReactNode;
}

function InfoCard({ title, children }: InfoCardProps) {
  return (
    <div
      className="rounded-lg border border-[var(--border-subtle)] p-5"
      style={{ backgroundColor: 'var(--surface-raised)' }}
    >
      <h2
        className="text-sm font-semibold mb-2"
        style={{
          fontFamily: 'var(--font-display)',
          color: 'var(--text-primary)',
        }}
      >
        {title}
      </h2>
      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline code span
// ---------------------------------------------------------------------------

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      className="px-1.5 py-0.5 rounded text-xs"
      style={{
        fontFamily: 'var(--font-mono)',
        backgroundColor: 'var(--surface-elevated)',
        color: 'var(--text-primary)',
      }}
    >
      {children}
    </code>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ApiDocsPage() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--surface-base)' }}
    >
      {/* Page header */}
      <div
        className="border-b border-[var(--border-subtle)]"
        style={{ backgroundColor: 'var(--surface-raised)' }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
          <p
            className="text-xs font-semibold tracking-widest uppercase mb-2"
            style={{ color: 'var(--accent-trust)', fontFamily: 'var(--font-mono)' }}
          >
            Developer
          </p>
          <h1
            className="text-3xl font-semibold mb-3"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
          >
            API Documentation
          </h1>
          <p className="text-sm max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
            The OpenGive public REST API provides programmatic access to 2M+ charity organizations,
            financial filings, anomaly signals, and money flow data from 30+ national registries.
            All endpoints are versioned at <Code>/v1/</Code>.
          </p>
        </div>
      </div>

      {/* Info cards */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InfoCard title="Authentication">
          <p className="mb-2">
            Anonymous requests are supported with a lower rate limit. To authenticate, include your
            API key in the <Code>Authorization</Code> header:
          </p>
          <pre
            className="mt-2 p-3 rounded text-xs overflow-x-auto"
            style={{
              fontFamily: 'var(--font-mono)',
              backgroundColor: 'var(--surface-elevated)',
              color: 'var(--text-primary)',
            }}
          >
            {`Authorization: Bearer YOUR_API_KEY`}
          </pre>
          <p className="mt-2">
            Generate an API key from your{' '}
            <a
              href="/settings"
              className="underline underline-offset-2"
              style={{ color: 'var(--accent-trust)' }}
            >
              settings page
            </a>{' '}
            after signing in.
          </p>
        </InfoCard>

        <InfoCard title="Rate Limits">
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <span
                className="inline-block mt-0.5 h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: 'var(--signal-warning)', marginTop: '6px' }}
                aria-hidden="true"
              />
              <span>
                <strong style={{ color: 'var(--text-primary)' }}>Anonymous:</strong>{' '}
                100 requests / minute
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span
                className="inline-block mt-0.5 h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: 'var(--signal-healthy)', marginTop: '6px' }}
                aria-hidden="true"
              />
              <span>
                <strong style={{ color: 'var(--text-primary)' }}>Authenticated:</strong>{' '}
                1,000 requests / minute
              </span>
            </li>
          </ul>
          <p className="mt-3">
            Rate limit headers are included with every response:{' '}
            <Code>X-RateLimit-Limit</Code>, <Code>X-RateLimit-Remaining</Code>,{' '}
            <Code>X-RateLimit-Reset</Code>.
          </p>
          <p className="mt-2">
            Exceeded limits return <Code>429 Too Many Requests</Code> with a{' '}
            <Code>Retry-After</Code> header.
          </p>
        </InfoCard>
      </div>

      {/* Swagger UI playground */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        <div
          className="rounded-lg border border-[var(--border-subtle)] overflow-hidden"
          style={{ backgroundColor: 'var(--surface-base)' }}
        >
          <div
            className="px-5 py-3 border-b border-[var(--border-subtle)]"
            style={{ backgroundColor: 'var(--surface-raised)' }}
          >
            <span
              className="text-sm font-semibold"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
            >
              Interactive Explorer
            </span>
            <span
              className="ms-2 text-xs px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: 'var(--accent-trust-subtle)',
                color: 'var(--accent-trust)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              v1
            </span>
          </div>
          <div className="p-4">
            <ApiPlayground specUrl="/api/v1/openapi.json" />
          </div>
        </div>
      </div>
    </div>
  );
}
