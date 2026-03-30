'use client';

import dynamic from 'next/dynamic';

// Swagger UI is large and not SSR-compatible — load it only on the client.
const SwaggerUI = dynamic(() => import('swagger-ui-react'), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center py-20"
      style={{ color: 'var(--text-tertiary)' }}
      aria-live="polite"
      aria-label="Loading API documentation"
    >
      <span className="text-sm">Loading API documentation…</span>
    </div>
  ),
});

interface ApiPlaygroundProps {
  specUrl: string;
}

export function ApiPlayground({ specUrl }: ApiPlaygroundProps) {
  return (
    <div className="swagger-wrapper">
      <SwaggerUI url={specUrl} docExpansion="list" defaultModelsExpandDepth={-1} />
      <style>{`
        /* Integrate Swagger UI with the OpenGive design system */
        .swagger-wrapper .swagger-ui {
          font-family: var(--font-body);
          color: var(--text-primary);
        }
        /* Hide the default Swagger topbar (URL bar + branding) */
        .swagger-wrapper .swagger-ui .topbar {
          display: none;
        }
        /* Match background to the surface tokens */
        .swagger-wrapper .swagger-ui .wrapper,
        .swagger-wrapper .swagger-ui .opblock-tag-section,
        .swagger-wrapper .swagger-ui .scheme-container {
          background: transparent;
          box-shadow: none;
        }
        .swagger-wrapper .swagger-ui .opblock {
          border-radius: var(--radius-md, 8px);
          border-color: var(--border-subtle);
          background: var(--surface-raised);
          margin-bottom: 8px;
        }
        .swagger-wrapper .swagger-ui .opblock .opblock-summary {
          border-color: var(--border-subtle);
        }
        .swagger-wrapper .swagger-ui .opblock-tag {
          border-bottom-color: var(--border-subtle);
          color: var(--text-primary);
          font-family: var(--font-display);
        }
        .swagger-wrapper .swagger-ui .btn {
          border-radius: 9999px;
          font-family: var(--font-body);
        }
        .swagger-wrapper .swagger-ui .btn.execute {
          background-color: var(--accent-trust);
          border-color: var(--accent-trust);
        }
        .swagger-wrapper .swagger-ui input,
        .swagger-wrapper .swagger-ui textarea,
        .swagger-wrapper .swagger-ui select {
          background: var(--surface-base);
          color: var(--text-primary);
          border-color: var(--border-default);
          border-radius: var(--radius-sm, 4px);
        }
        .swagger-wrapper .swagger-ui .response-col_status {
          font-family: var(--font-mono);
        }
      `}</style>
    </div>
  );
}
