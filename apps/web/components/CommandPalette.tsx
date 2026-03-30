'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { type Route } from 'next';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Badge,
  cn,
} from '@opengive/ui';
import { keepPreviousData } from '@tanstack/react-query';
import { trpc } from '../lib/trpc';
import { countryCodeToFlag } from '../lib/countries';

// ---------------------------------------------------------------------------
// Placeholder data — fallback when tRPC query is unavailable
// ---------------------------------------------------------------------------

interface OrgResult {
  id: string;
  name: string;
  slug: string;
  country: string;
  countryFlag: string;
  sector: string;
}

const PLACEHOLDER_RESULTS: OrgResult[] = [
  { id: '1', name: 'American Red Cross', slug: 'american-red-cross', country: 'US', countryFlag: '🇺🇸', sector: 'Humanitarian' },
  { id: '2', name: 'Doctors Without Borders', slug: 'doctors-without-borders', country: 'CH', countryFlag: '🇨🇭', sector: 'Healthcare' },
  { id: '3', name: 'Oxfam International', slug: 'oxfam-international', country: 'GB', countryFlag: '🇬🇧', sector: 'Poverty Relief' },
  { id: '4', name: "Save the Children", slug: 'save-the-children', country: 'GB', countryFlag: '🇬🇧', sector: 'Children' },
  { id: '5', name: 'World Wildlife Fund', slug: 'world-wildlife-fund', country: 'CH', countryFlag: '🇨🇭', sector: 'Environment' },
  { id: '6', name: 'UNICEF', slug: 'unicef', country: 'US', countryFlag: '🇺🇳', sector: 'Children' },
  { id: '7', name: 'Gates Foundation', slug: 'gates-foundation', country: 'US', countryFlag: '🇺🇸', sector: 'Global Health' },
  { id: '8', name: 'Habitat for Humanity', slug: 'habitat-for-humanity', country: 'US', countryFlag: '🇺🇸', sector: 'Housing' },
];

// countryCodeToFlag is imported from ../lib/countries — no local duplicate needed.

// ---------------------------------------------------------------------------
// Debounce hook
// ---------------------------------------------------------------------------

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState<T>(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

// ---------------------------------------------------------------------------
// SearchIcon
// ---------------------------------------------------------------------------

function SearchIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.75" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// CommandPalette
// ---------------------------------------------------------------------------

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const t = useTranslations('commandPalette');
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  // Debounce the search query to avoid firing a request on every keystroke.
  const debouncedQuery = useDebounce(query.trim(), 300);

  // Live search via tRPC — only fires when the palette is open and the user
  // has typed something.  Falls back gracefully on error.
  const { data: searchData, isError: searchError } = trpc.organizations.search.useQuery(
    { query: debouncedQuery, limit: 8 },
    {
      // Only run the query when the palette is open and there is actual input.
      enabled: open && debouncedQuery.length > 0,
      // Keep previous results visible while a new fetch is in-flight.
      placeholderData: keepPreviousData,
      // Don't hammer the server on transient failures.
      retry: 1,
      staleTime: 30_000,
    },
  );

  // Map DB rows (OrganizationRow) to the local OrgResult shape.
  const liveResults: OrgResult[] = React.useMemo(() => {
    if (searchError || !searchData?.items?.length) return [];
    return searchData.items.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      country: org.countryCode ?? '',
      countryFlag: countryCodeToFlag(org.countryCode ?? ''),
      sector: org.sector ?? org.orgType ?? 'Other',
    }));
  }, [searchData, searchError]);

  // Derive final result list:
  //   - No query typed       → show first 6 placeholder suggestions
  //   - Query + live results → show live results
  //   - Query + live failed  → fall back to client-side filter of placeholders
  const results: OrgResult[] = React.useMemo(() => {
    const q = debouncedQuery.toLowerCase();

    if (!q) {
      return PLACEHOLDER_RESULTS.slice(0, 6);
    }

    if (liveResults.length > 0) {
      return liveResults;
    }

    // Fallback: filter placeholders client-side when live search is unavailable
    return PLACEHOLDER_RESULTS.filter(
      (org) =>
        org.name.toLowerCase().includes(q) ||
        org.country.toLowerCase().includes(q) ||
        org.sector.toLowerCase().includes(q),
    ).slice(0, 8);
  }, [debouncedQuery, liveResults]);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      // Focus input after animation frame
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Keep activeIndex in bounds when results change
  React.useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  // Scroll active item into view
  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.children[activeIndex] as HTMLElement | undefined;
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % Math.max(results.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + Math.max(results.length, 1)) % Math.max(results.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = results[activeIndex];
      if (selected) {
        onOpenChange(false);
        router.push(`/explore/${selected.slug}` as Route);
      }
    }
  }

  function handleSelect(org: OrgResult) {
    onOpenChange(false);
    router.push(`/explore/${org.slug}` as Route);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-label={t('ariaLabel')}
        className="p-0 gap-0 max-w-xl overflow-hidden"
        hideClose
        onKeyDown={handleKeyDown}
      >
        {/* Visually hidden title for screen readers */}
        <DialogTitle className="sr-only">{t('ariaLabel')}</DialogTitle>
        <DialogDescription className="sr-only">{t('hint')}</DialogDescription>

        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)]"
        >
          <SearchIcon />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="command-palette-results"
            aria-activedescendant={
              results[activeIndex] ? `cp-result-${results[activeIndex].id}` : undefined
            }
            aria-label={t('placeholder')}
            placeholder={t('placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={cn(
              'flex-1 bg-transparent text-sm text-[var(--text-primary)]',
              'placeholder:text-[var(--text-tertiary)]',
              'focus:outline-none',
            )}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] rounded-sm"
              aria-label="Clear search"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {results.length > 0 ? (
            <>
              <p className="px-4 pt-3 pb-1 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                {t('categories.organizations')}
              </p>
              <ul
                id="command-palette-results"
                ref={listRef}
                role="listbox"
                aria-label={t('categories.organizations')}
                className="pb-2"
              >
                {results.map((org, idx) => (
                  <li
                    key={org.id}
                    id={`cp-result-${org.id}`}
                    role="option"
                    aria-selected={idx === activeIndex}
                    onClick={() => handleSelect(org)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 cursor-pointer',
                      'transition-colors duration-[var(--transition-fast)]',
                      idx === activeIndex
                        ? 'bg-[var(--surface-elevated)]'
                        : 'hover:bg-[var(--surface-raised)]',
                    )}
                  >
                    <span className="text-lg leading-none" aria-hidden="true">
                      {org.countryFlag}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {org.name}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {org.country} &middot; {org.sector}
                      </p>
                    </div>
                    <Badge variant="default" size="sm" hideIcon>
                      {org.sector}
                    </Badge>
                  </li>
                ))}
            </ul>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-[var(--text-secondary)]">
                {t('noResults')}{' '}
                <span className="font-medium text-[var(--text-primary)]">
                  &ldquo;{query}&rdquo;
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div
          className="flex items-center gap-4 px-4 py-2 border-t border-[var(--border-subtle)] text-xs text-[var(--text-tertiary)]"
        >
          <span>
            <kbd className="font-sans">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="font-sans">↵</kbd> open
          </span>
          <span>
            <kbd className="font-sans">Esc</kbd> close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
