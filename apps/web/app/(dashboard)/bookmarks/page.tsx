'use client';

import * as React from 'react';
import Link from 'next/link';
import { type Route } from 'next';
import { Button, Card, CardContent, Badge } from '@opengive/ui';
import { trpc } from '../../../lib/trpc';

// ---------------------------------------------------------------------------
// Inline icons
// ---------------------------------------------------------------------------

function IconBookmark({ filled, className }: { filled?: boolean; className?: string }) {
  return (
    <svg
      className={className ?? 'h-12 w-12'}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
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

function IconPencil({ className }: { className?: string }) {
  return (
    <svg className={className ?? 'h-4 w-4'} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Notes editor
// ---------------------------------------------------------------------------

interface NotesEditorProps {
  organizationId: string;
  initialNotes: string | null | undefined;
  onDone: () => void;
}

function NotesEditor({ organizationId, initialNotes, onDone }: NotesEditorProps) {
  const utils = trpc.useUtils();
  const [value, setValue] = React.useState(initialNotes ?? '');

  const updateNotes = trpc.bookmarks.updateNotes.useMutation({
    onSuccess: () => {
      void utils.bookmarks.list.invalidate();
      onDone();
    },
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    updateNotes.mutate({ organizationId, notes: value });
  }

  return (
    <form onSubmit={handleSave} className="mt-3 flex flex-col gap-2">
      <textarea
        aria-label="Bookmark notes"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        maxLength={2000}
        className="w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--text-primary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-trust)]"
        placeholder="Add a note about this organization..."
      />
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" size="sm" isLoading={updateNotes.isPending}>
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BookmarksPage() {
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const { data, isLoading, isError } = trpc.bookmarks.list.useQuery({ limit: 50 });
  const utils = trpc.useUtils();

  const removeBookmark = trpc.bookmarks.remove.useMutation({
    // Optimistic update: remove the item from the cached list immediately.
    onMutate: async ({ organizationId }) => {
      await utils.bookmarks.list.cancel();
      const previous = utils.bookmarks.list.getData({ limit: 50 });
      utils.bookmarks.list.setData({ limit: 50 }, (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.filter((item) => item.organizationId !== organizationId),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        utils.bookmarks.list.setData({ limit: 50 }, context.previous);
      }
    },
    onSettled: () => {
      void utils.bookmarks.list.invalidate();
    },
  });

  const items = data?.items ?? [];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
        >
          Bookmarks
        </h1>
        <p className="mt-1" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Organizations you&apos;ve saved for quick access. Add notes to track your research.
        </p>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent>
                <div className="animate-pulse flex gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-[var(--surface-elevated)] rounded w-1/3" />
                    <div className="h-3 bg-[var(--surface-elevated)] rounded w-1/2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <Card>
          <CardContent>
            <p className="text-sm text-[var(--signal-danger)]">
              Failed to load bookmarks. Please refresh the page.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && !isError && items.length === 0 && (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <span
                className="mx-auto mb-4 block"
                style={{ color: 'var(--text-tertiary)' }}
              >
                <IconBookmark />
              </span>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                No bookmarks yet
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Browse organizations and click the bookmark icon to save them here.
              </p>
              <Button
                variant="primary"
                size="md"
                className="mt-4"
                onClick={() => { window.location.href = '/explore'; }}
              >
                Explore Organizations
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bookmark list */}
      {!isLoading && !isError && items.length > 0 && (
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Link
                        href={`/explore/${item.orgSlug}` as Route}
                        className="font-semibold hover:underline truncate"
                        style={{
                          color: 'var(--accent-trust)',
                          fontFamily: 'var(--font-display)',
                        }}
                      >
                        {item.orgName}
                      </Link>
                      {item.orgCountryCode && (
                        <Badge variant="default">{item.orgCountryCode}</Badge>
                      )}
                      {item.orgSector && (
                        <Badge variant="primary">{item.orgSector}</Badge>
                      )}
                    </div>

                    {/* Notes display / editor */}
                    {editingId === item.organizationId ? (
                      <NotesEditor
                        organizationId={item.organizationId}
                        initialNotes={item.notes}
                        onDone={() => setEditingId(null)}
                      />
                    ) : (
                      <>
                        {item.notes && (
                          <p
                            className="text-sm mt-1"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {item.notes}
                          </p>
                        )}
                        <p
                          className="text-xs mt-2"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          Bookmarked{' '}
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleDateString()
                            : ''}
                        </p>
                      </>
                    )}
                  </div>

                  {editingId !== item.organizationId && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Edit notes"
                        onClick={() => setEditingId(item.organizationId)}
                      >
                        <IconPencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        isLoading={removeBookmark.isPending && removeBookmark.variables?.organizationId === item.organizationId}
                        onClick={() =>
                          removeBookmark.mutate({ organizationId: item.organizationId })
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
