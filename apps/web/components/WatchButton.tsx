'use client';

import * as React from 'react';
import { cn } from '@opengive/ui';
import { trpc } from '../lib/trpc';

// ---------------------------------------------------------------------------
// Watch type config
// ---------------------------------------------------------------------------

const WATCH_TYPES = {
  all: { label: 'All Activity', color: 'var(--accent-trust)' },
  score_change: { label: 'Score Changes', color: 'var(--signal-caution)' },
  new_filing: { label: 'New Filings', color: 'var(--signal-healthy)' },
  anomaly_alert: { label: 'Anomaly Alerts', color: 'var(--signal-danger)' },
  grant_activity: { label: 'Grant Activity', color: 'var(--signal-neutral)' },
} as const;

type WatchType = keyof typeof WATCH_TYPES;

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function IconEyeFilled({ className }: { className?: string }) {
  return (
    <svg
      className={cn('h-5 w-5', className)}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 12.5a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6z" />
    </svg>
  );
}

function IconEyeOutline({ className }: { className?: string }) {
  return (
    <svg
      className={cn('h-5 w-5', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg
      className={cn('h-3.5 w-3.5', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// WatchButton
// ---------------------------------------------------------------------------

interface WatchButtonProps {
  /** UUID of the organization to watch. */
  organizationId: string;
  /** Optional additional class names. */
  className?: string;
  /** When true renders icon-only without text label. */
  iconOnly?: boolean;
}

/**
 * Toggles a watchlist entry for the given organization.
 *
 * When the user is watching, an inline dropdown lets them change the
 * `watch_type` without navigating to the watchlist page.
 *
 * Requires authentication — unauthenticated users see a "Sign in" link.
 */
export function WatchButton({ organizationId, className, iconOnly = false }: WatchButtonProps) {
  const utils = trpc.useUtils();
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const { data, isLoading } = trpc.watchlist.isWatched.useQuery(
    { organizationId },
    { retry: false },
  );

  const addMutation = trpc.watchlist.add.useMutation({
    onMutate: async ({ watchType }) => {
      await utils.watchlist.isWatched.cancel({ organizationId });
      utils.watchlist.isWatched.setData(
        { organizationId },
        { watched: true, watchType: watchType ?? 'all' },
      );
    },
    onError: () => {
      utils.watchlist.isWatched.setData(
        { organizationId },
        { watched: false, watchType: null },
      );
    },
    onSettled: () => {
      void utils.watchlist.isWatched.invalidate({ organizationId });
      void utils.watchlist.list.invalidate();
    },
  });

  const removeMutation = trpc.watchlist.remove.useMutation({
    onMutate: async () => {
      await utils.watchlist.isWatched.cancel({ organizationId });
      utils.watchlist.isWatched.setData(
        { organizationId },
        { watched: false, watchType: null },
      );
    },
    onError: () => {
      void utils.watchlist.isWatched.invalidate({ organizationId });
    },
    onSettled: () => {
      void utils.watchlist.isWatched.invalidate({ organizationId });
      void utils.watchlist.list.invalidate();
    },
  });

  const updateMutation = trpc.watchlist.update.useMutation({
    onSuccess: () => {
      void utils.watchlist.isWatched.invalidate({ organizationId });
      void utils.watchlist.list.invalidate();
      setDropdownOpen(false);
    },
  });

  // Close dropdown on outside click
  React.useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  const isWatched = data?.watched ?? false;
  const currentWatchType = (data?.watchType ?? 'all') as WatchType;
  const watchConfig = WATCH_TYPES[currentWatchType] ?? WATCH_TYPES.all;
  const isPending =
    addMutation.isPending || removeMutation.isPending || updateMutation.isPending;

  const isUnauthorized =
    addMutation.error?.data?.code === 'UNAUTHORIZED' ||
    removeMutation.error?.data?.code === 'UNAUTHORIZED';

  if (isUnauthorized) {
    return (
      <a
        href="/login"
        className={cn(
          'inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors',
          className,
        )}
      >
        <IconEyeOutline />
        {!iconOnly && 'Sign in to watch'}
      </a>
    );
  }

  function handleMainClick() {
    if (isPending || isLoading) return;
    if (isWatched) {
      // Toggle dropdown to change watch type or stop watching
      setDropdownOpen((prev) => !prev);
    } else {
      addMutation.mutate({ organizationId, watchType: 'all' });
    }
  }

  return (
    <div className="relative inline-flex" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleMainClick}
        disabled={isLoading || isPending}
        aria-label={isWatched ? 'Watching — click to manage' : 'Watch this organization'}
        aria-pressed={isWatched}
        aria-expanded={isWatched ? dropdownOpen : undefined}
        className={cn(
          'inline-flex items-center gap-1.5',
          'h-9 rounded-full px-3',
          'text-sm font-medium',
          'transition-colors duration-[var(--transition-fast)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          isWatched
            ? 'text-[var(--accent-trust)] bg-[var(--accent-trust-subtle)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]',
          className,
        )}
      >
        {isWatched ? <IconEyeFilled /> : <IconEyeOutline />}
        {!iconOnly && (isWatched ? 'Watching' : 'Watch')}
        {isWatched && !iconOnly && <IconChevronDown />}
      </button>

      {/* Watch type dropdown */}
      {isWatched && dropdownOpen && (
        <div
          role="menu"
          aria-label="Watch options"
          className="absolute top-full start-0 mt-1 z-50 min-w-[200px] rounded-lg border border-[var(--border-default)] shadow-[var(--shadow-lg)] py-1"
          style={{ backgroundColor: 'var(--surface-raised)' }}
        >
          <p
            className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Watch type
          </p>
          {(Object.entries(WATCH_TYPES) as [WatchType, { label: string; color: string }][]).map(
            ([key, config]) => (
              <button
                key={key}
                type="button"
                role="menuitemradio"
                aria-checked={currentWatchType === key}
                onClick={() => updateMutation.mutate({ organizationId, watchType: key })}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-start transition-colors hover:bg-[var(--surface-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-trust)]"
                style={{
                  color:
                    currentWatchType === key ? config.color : 'var(--text-primary)',
                  fontWeight: currentWatchType === key ? 600 : 400,
                }}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: config.color }}
                  aria-hidden="true"
                />
                {config.label}
              </button>
            ),
          )}
          <div
            className="mx-3 my-1 border-t"
            style={{ borderColor: 'var(--border-subtle)' }}
            role="separator"
          />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setDropdownOpen(false);
              removeMutation.mutate({ organizationId });
            }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-start transition-colors hover:bg-[var(--surface-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-trust)]"
            style={{ color: 'var(--signal-danger)' }}
          >
            Stop watching
          </button>
        </div>
      )}
    </div>
  );
}
