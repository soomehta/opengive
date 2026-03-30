'use client';

import * as React from 'react';
import { cn } from '@opengive/ui';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg className={cn('h-4 w-4', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCopy({ className }: { className?: string }) {
  return (
    <svg className={cn('h-4 w-4', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={cn('h-4 w-4', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EmbedSnippetGeneratorProps {
  /** The organization's slug — used to construct the embed URL. */
  orgSlug: string;
  /** Display name shown in the section heading. */
  orgName: string;
  /** Optional additional className for the wrapper. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmbedSnippetGenerator({
  orgSlug,
  orgName,
  className,
}: EmbedSnippetGeneratorProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const embedUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/embed/${orgSlug}`
      : `/api/embed/${orgSlug}`;

  const iframeSnippet =
    `<iframe\n` +
    `  src="${embedUrl}"\n` +
    `  width="480"\n` +
    `  height="200"\n` +
    `  style="border:none;border-radius:12px;overflow:hidden;"\n` +
    `  title="${orgName} — OpenGive Widget"\n` +
    `  loading="lazy"\n` +
    `></iframe>`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(iframeSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — silently ignore
    }
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--border-subtle)]',
        className,
      )}
      style={{ backgroundColor: 'var(--surface-raised)' }}
    >
      {/* Toggle header */}
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="embed-panel"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'flex items-center justify-between w-full px-4 py-3 text-start',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]',
          'rounded-lg',
        )}
      >
        <span
          className="text-sm font-semibold"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
        >
          Get Embed Code
        </span>
        <IconChevronDown
          className={cn(
            'text-[var(--text-tertiary)] transition-transform duration-[var(--transition-fast)]',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {/* Expandable panel */}
      {isOpen && (
        <div
          id="embed-panel"
          className="px-4 pb-4 flex flex-col gap-4"
        >
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Embed the <strong style={{ color: 'var(--text-primary)' }}>{orgName}</strong> accountability
            widget on your own website by copying the snippet below.
          </p>

          {/* Code block + copy button */}
          <div className="relative">
            <pre
              className={cn(
                'overflow-x-auto rounded-lg p-4 text-xs leading-relaxed',
              )}
              style={{
                backgroundColor: 'var(--surface-elevated)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
              }}
              aria-label="Embed code snippet"
            >
              {iframeSnippet}
            </pre>
            <button
              type="button"
              onClick={handleCopy}
              aria-label={copied ? 'Copied!' : 'Copy embed code'}
              className={cn(
                'absolute top-2 end-2',
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium',
                'border border-[var(--border-default)]',
                'transition-colors duration-[var(--transition-fast)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]',
                copied
                  ? 'bg-[var(--signal-healthy-subtle)] text-[var(--signal-healthy)] border-[var(--signal-healthy)]'
                  : 'bg-[var(--surface-base)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              )}
            >
              {copied ? <IconCheck /> : <IconCopy />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>

          {/* Live preview */}
          <div className="flex flex-col gap-2">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
            >
              Preview
            </span>
            <div
              className="rounded-lg border border-[var(--border-subtle)] overflow-hidden"
              style={{ backgroundColor: 'var(--surface-base)' }}
            >
              <iframe
                src={embedUrl}
                width="100%"
                height="220"
                style={{ border: 'none', display: 'block' }}
                title={`${orgName} — OpenGive Widget preview`}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
