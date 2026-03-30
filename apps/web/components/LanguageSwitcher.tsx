'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@opengive/ui';
import {
  SUPPORTED_LOCALES,
  LOCALE_LABELS,
  type SupportedLocale,
} from '../i18n/locales';

// ---------------------------------------------------------------------------
// Globe icon (language indicator)
// ---------------------------------------------------------------------------

function IconGlobe({ className }: { className?: string }) {
  return (
    <svg
      className={cn('h-4 w-4 shrink-0', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M2 12h20M12 2c-2.5 3-4 6.5-4 10s1.5 7 4 10M12 2c2.5 3 4 6.5 4 10s-1.5 7-4 10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// LanguageSwitcher
// ---------------------------------------------------------------------------

interface LanguageSwitcherProps {
  /** The locale currently active, resolved server-side. */
  currentLocale: SupportedLocale;
  className?: string;
}

export function LanguageSwitcher({ currentLocale, className }: LanguageSwitcherProps) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as SupportedLocale;
    if (next === currentLocale) return;

    // Persist to cookie — server-side request.ts will pick it up
    document.cookie = `locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;

    // Refresh to reload server components with the new locale
    router.refresh();
  }

  return (
    <div
      className={cn('relative flex items-center', className)}
      title="Change language"
    >
      {/* Globe icon layered over the start of the select */}
      <IconGlobe className="absolute start-2.5 text-[var(--text-tertiary)] pointer-events-none z-10" />

      <select
        value={currentLocale}
        onChange={handleChange}
        aria-label="Select language"
        className={cn(
          'h-9 rounded-full ps-8 pe-3',
          'text-sm font-medium appearance-none cursor-pointer',
          'border border-[var(--border-default)]',
          'bg-[var(--surface-raised)] text-[var(--text-secondary)]',
          'hover:border-[var(--border-emphasis)] hover:text-[var(--text-primary)]',
          'hover:bg-[var(--surface-elevated)]',
          'transition-colors duration-[var(--transition-fast)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]',
          // Suppress browser arrow — we rely on the globe icon for affordance
          '[&::-webkit-appearance]:none',
        )}
      >
        {SUPPORTED_LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {LOCALE_LABELS[locale]}
          </option>
        ))}
      </select>
    </div>
  );
}
