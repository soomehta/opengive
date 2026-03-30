'use client';

import * as React from 'react';
import { cn } from '@opengive/ui';
import { trpc } from '../lib/trpc';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function IconBookmarkFilled({ className }: { className?: string }) {
  return (
    <svg
      className={cn('h-5 w-5', className)}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
    </svg>
  );
}

function IconBookmarkOutline({ className }: { className?: string }) {
  return (
    <svg
      className={cn('h-5 w-5', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// BookmarkButton
// ---------------------------------------------------------------------------

interface BookmarkButtonProps {
  /** UUID of the organization to bookmark. */
  organizationId: string;
  /** Optional additional class names for the button element. */
  className?: string;
  /** When true renders a compact icon-only button without text label. */
  iconOnly?: boolean;
}

/**
 * Toggles a bookmark for the given organization.
 *
 * - Calls `trpc.bookmarks.isBookmarked` to load the initial state.
 * - Calls `trpc.bookmarks.add` / `trpc.bookmarks.remove` to toggle.
 * - Requires an authenticated Supabase session; renders a "Sign in" prompt
 *   if the user is unauthenticated (ctx.userId is null — tRPC throws UNAUTHORIZED).
 */
export function BookmarkButton({
  organizationId,
  className,
  iconOnly = false,
}: BookmarkButtonProps) {
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.bookmarks.isBookmarked.useQuery(
    { organizationId },
    {
      // Silently ignore UNAUTHORIZED — treat as not bookmarked for anonymous users.
      retry: false,
    },
  );

  const addMutation = trpc.bookmarks.add.useMutation({
    onMutate: async () => {
      await utils.bookmarks.isBookmarked.cancel({ organizationId });
      utils.bookmarks.isBookmarked.setData(
        { organizationId },
        { bookmarked: true, notes: null },
      );
    },
    onError: () => {
      utils.bookmarks.isBookmarked.setData(
        { organizationId },
        { bookmarked: false, notes: null },
      );
    },
    onSettled: () => {
      void utils.bookmarks.isBookmarked.invalidate({ organizationId });
      void utils.bookmarks.list.invalidate();
    },
  });

  const removeMutation = trpc.bookmarks.remove.useMutation({
    onMutate: async () => {
      await utils.bookmarks.isBookmarked.cancel({ organizationId });
      utils.bookmarks.isBookmarked.setData(
        { organizationId },
        { bookmarked: false, notes: null },
      );
    },
    onError: () => {
      void utils.bookmarks.isBookmarked.invalidate({ organizationId });
    },
    onSettled: () => {
      void utils.bookmarks.isBookmarked.invalidate({ organizationId });
      void utils.bookmarks.list.invalidate();
    },
  });

  const isBookmarked = data?.bookmarked ?? false;
  const isPending = addMutation.isPending || removeMutation.isPending;

  function handleToggle() {
    if (isPending) return;
    if (isBookmarked) {
      removeMutation.mutate({ organizationId });
    } else {
      addMutation.mutate({ organizationId });
    }
  }

  // If the query failed with UNAUTHORIZED, prompt to sign in.
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
        <IconBookmarkOutline />
        {!iconOnly && 'Sign in to bookmark'}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isLoading || isPending}
      aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this organization'}
      aria-pressed={isBookmarked}
      className={cn(
        'inline-flex items-center gap-1.5',
        'h-9 rounded-full px-3',
        'text-sm font-medium',
        'transition-colors duration-[var(--transition-fast)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        isBookmarked
          ? 'text-[var(--accent-trust)] bg-[var(--accent-trust-subtle)]'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]',
        className,
      )}
    >
      {isBookmarked ? <IconBookmarkFilled /> : <IconBookmarkOutline />}
      {!iconOnly && (isBookmarked ? 'Bookmarked' : 'Bookmark')}
    </button>
  );
}
