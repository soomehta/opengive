'use client';

import * as React from 'react';
import Link from 'next/link';
import { type Route } from 'next';
import { Button, Card, CardContent, Badge } from '@opengive/ui';
import { trpc } from '../../../lib/trpc';

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
// Inline icon
// ---------------------------------------------------------------------------

function IconEye({ className }: { className?: string }) {
  return (
    <svg className={className ?? 'h-12 w-12'} viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

// ---------------------------------------------------------------------------
// Watch type selector
// ---------------------------------------------------------------------------

interface WatchTypeSelectorProps {
  organizationId: string;
  currentWatchType: WatchType;
  onClose: () => void;
}

function WatchTypeSelector({ organizationId, currentWatchType, onClose }: WatchTypeSelectorProps) {
  const utils = trpc.useUtils();

  const updateWatch = trpc.watchlist.update.useMutation({
    onSuccess: () => {
      void utils.watchlist.list.invalidate();
      onClose();
    },
  });

  return (
    <div
      className="mt-3 p-3 rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)]"
      role="listbox"
      aria-label="Select watch type"
    >
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
        Watch type
      </p>
      <div className="flex flex-col gap-1">
        {(Object.entries(WATCH_TYPES) as [WatchType, { label: string; color: string }][]).map(
          ([key, config]) => (
            <button
              key={key}
              type="button"
              role="option"
              aria-selected={currentWatchType === key}
              onClick={() => updateWatch.mutate({ organizationId, watchType: key })}
              className="flex items-center gap-2 px-3 py-1.5 rounded text-sm text-start transition-colors hover:bg-[var(--surface-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]"
              style={{
                color: currentWatchType === key ? config.color : 'var(--text-primary)',
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
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 w-full"
        onClick={onClose}
        disabled={updateWatch.isPending}
      >
        Cancel
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WatchlistPage() {
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const { data, isLoading, isError } = trpc.watchlist.list.useQuery({ limit: 50 });
  const utils = trpc.useUtils();

  const removeWatch = trpc.watchlist.remove.useMutation({
    onMutate: async ({ organizationId }) => {
      await utils.watchlist.list.cancel();
      const previous = utils.watchlist.list.getData({ limit: 50 });
      utils.watchlist.list.setData({ limit: 50 }, (old) => {
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
        utils.watchlist.list.setData({ limit: 50 }, context.previous);
      }
    },
    onSettled: () => {
      void utils.watchlist.list.invalidate();
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
          Watchlist
        </h1>
        <p className="mt-1" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Get notified when organizations you&apos;re tracking have new filings, score changes,
          anomaly alerts, or grant activity.
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent>
                <div className="animate-pulse flex gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-[var(--surface-elevated)] rounded w-1/3" />
                    <div className="h-3 bg-[var(--surface-elevated)] rounded w-1/4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <Card>
          <CardContent>
            <p className="text-sm text-[var(--signal-danger)]">
              Failed to load watchlist. Please refresh the page.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && !isError && items.length === 0 && (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <span className="mx-auto mb-4 block" style={{ color: 'var(--text-tertiary)' }}>
                <IconEye />
              </span>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                No organizations watched
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Add organizations to your watchlist to receive alerts about their activity.
              </p>
              <Button
                variant="primary"
                size="md"
                className="mt-4"
                onClick={() => { window.location.href = '/explore'; }}
              >
                Find Organizations
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Watchlist items */}
      {!isLoading && !isError && items.length > 0 && (
        <div className="flex flex-col gap-4">
          {items.map((item) => {
            const watchType = (item.watchType ?? 'all') as WatchType;
            const watchConfig = WATCH_TYPES[watchType] ?? WATCH_TYPES.all;
            return (
              <Card key={item.id}>
                <CardContent>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Link
                          href={`/explore/${item.orgSlug}` as Route}
                          className="font-semibold hover:underline"
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
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${watchConfig.color} 12%, transparent)`,
                            color: watchConfig.color,
                          }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: watchConfig.color }}
                            aria-hidden="true"
                          />
                          {watchConfig.label}
                        </span>
                      </div>

                      {/* Watch type editor */}
                      {editingId === item.organizationId && (
                        <WatchTypeSelector
                          organizationId={item.organizationId}
                          currentWatchType={watchType}
                          onClose={() => setEditingId(null)}
                        />
                      )}

                      {editingId !== item.organizationId && (
                        <div
                          className="flex items-center gap-4 mt-2 text-xs"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          <span>
                            Watching since{' '}
                            {item.createdAt
                              ? new Date(item.createdAt).toLocaleDateString()
                              : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    {editingId !== item.organizationId && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(item.organizationId)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          isLoading={
                            removeWatch.isPending &&
                            removeWatch.variables?.organizationId === item.organizationId
                          }
                          onClick={() =>
                            removeWatch.mutate({ organizationId: item.organizationId })
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
