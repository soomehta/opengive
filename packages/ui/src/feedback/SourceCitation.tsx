'use client';

import * as React from 'react';
import { cn } from '../lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SourceCitationProps {
  sourceUrl?: string | null;
  filingType?: string | null;
  fiscalYear?: number;
  registrySource?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Registry label map
// ---------------------------------------------------------------------------

const REGISTRY_LABELS: Record<string, string> = {
  us_propublica:         'ProPublica',
  uk_charity_commission: 'UK Charity Commission',
  us_irs:                'IRS',
  au_acnc:               'ACNC',
  ca_cra:                'CRA',
  nz_charities:          'NZ Charities Register',
  ie_cro:                'Companies Registration Office',
  de_zentralregister:    'Zentralregister',
};

function getRegistryLabel(registrySource?: string): string {
  if (!registrySource) return 'original filing';
  return REGISTRY_LABELS[registrySource] ?? registrySource;
}

// ---------------------------------------------------------------------------
// External link icon (standard "box with arrow" pattern)
// ---------------------------------------------------------------------------

function ExternalLinkIcon() {
  return (
    <svg
      className="h-3 w-3 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="15 3 21 3 21 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="10" y1="14" x2="21" y2="3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SourceCitation({
  sourceUrl,
  filingType,
  fiscalYear,
  registrySource,
  className,
}: SourceCitationProps) {
  // Return nothing when there is no URL to link to
  if (!sourceUrl) return null;

  const registryLabel = getRegistryLabel(registrySource);

  // Build link text: "View on ProPublica" or "View original filing"
  const linkText =
    registrySource && REGISTRY_LABELS[registrySource]
      ? `View on ${REGISTRY_LABELS[registrySource]}`
      : 'View original filing';

  // Build accessible label that includes filing type + fiscal year when available
  const ariaLabel = [
    linkText,
    filingType ? `— ${filingType}` : null,
    fiscalYear ? `FY${fiscalYear}` : null,
    `(opens in new tab)`,
  ]
    .filter(Boolean)
    .join(' ');

  // Build the subtitle shown below the link text when additional metadata is present
  const subtitle = [
    filingType,
    fiscalYear ? `FY${fiscalYear}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <a
      href={sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex flex-col gap-0.5 group w-fit',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] focus-visible:ring-offset-2 rounded-sm',
        className,
      )}
    >
      {/* Primary link row */}
      <span
        className="inline-flex items-center gap-1 text-xs font-medium transition-colors duration-150"
        style={{
          color: 'var(--accent-trust)',
          fontFamily: 'var(--font-body, system-ui)',
        }}
      >
        <ExternalLinkIcon />
        <span
          className="underline underline-offset-2 decoration-[var(--accent-trust)]/40 group-hover:decoration-[var(--accent-trust)] transition-colors"
        >
          {linkText}
        </span>
      </span>

      {/* Subtitle row: filing type + fiscal year */}
      {subtitle && (
        <span
          className="text-[10px]"
          style={{
            color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-body, system-ui)',
            paddingInlineStart: '1rem', // align with text, past the icon
          }}
        >
          {subtitle} · {registryLabel}
        </span>
      )}
    </a>
  );
}
