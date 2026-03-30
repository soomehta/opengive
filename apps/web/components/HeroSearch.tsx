'use client';

import { useState } from 'react';
import { Button } from '@opengive/ui';

function IconSearchInput() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.75" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

interface HeroSearchProps {
  searchPlaceholder: string;
  searchAriaLabel: string;
}

export function HeroSearch({ searchPlaceholder, searchAriaLabel }: HeroSearchProps) {
  const [query, setQuery] = useState('');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
    window.location.href = `/explore${params}`;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-lg mx-auto mb-10 rounded-full border border-[var(--border-default)] bg-[var(--surface-raised)] overflow-hidden"
    >
      <div className="relative flex-1">
        <span
          className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
          aria-hidden="true"
        >
          <IconSearchInput />
        </span>
        <input
          type="search"
          name="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={searchAriaLabel}
          placeholder={searchPlaceholder}
          className="w-full h-12 ps-11 pe-4 rounded-s-full text-sm border-0 bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] focus-visible:ring-inset"
        />
      </div>
      <Button
        type="submit"
        size="lg"
        className="rounded-s-none rounded-e-full shrink-0 h-12"
        aria-label="Search organizations"
      >
        Search
      </Button>
    </form>
  );
}
