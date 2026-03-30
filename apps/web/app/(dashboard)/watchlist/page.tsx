'use client';

import { useState } from 'react';
import { Button, Card, CardHeader, CardContent, Badge } from '@opengive/ui';

interface WatchlistItem {
  id: string;
  name: string;
  slug: string;
  country: string;
  sector: string;
  watchType: 'score_change' | 'new_filing' | 'anomaly_alert' | 'grant_activity' | 'all';
  addedAt: string;
  lastNotification?: string;
  alertCount: number;
}

const WATCH_TYPES = {
  all: { label: 'All Activity', color: 'var(--accent-trust)' },
  score_change: { label: 'Score Changes', color: 'var(--signal-caution)' },
  new_filing: { label: 'New Filings', color: 'var(--signal-healthy)' },
  anomaly_alert: { label: 'Anomaly Alerts', color: 'var(--signal-danger)' },
  grant_activity: { label: 'Grant Activity', color: 'var(--signal-neutral)' },
} as const;

const MOCK_WATCHLIST: WatchlistItem[] = [
  { id: '1', name: 'Gates Foundation', slug: 'gates-foundation', country: 'US', sector: 'Global Health', watchType: 'all', addedAt: '2026-03-15', lastNotification: '2026-03-28', alertCount: 3 },
  { id: '2', name: 'Salvation Army', slug: 'salvation-army', country: 'US', sector: 'Humanitarian', watchType: 'anomaly_alert', addedAt: '2026-03-20', alertCount: 1 },
  { id: '3', name: 'British Red Cross', slug: 'british-red-cross', country: 'GB', sector: 'Humanitarian', watchType: 'new_filing', addedAt: '2026-03-22', lastNotification: '2026-03-27', alertCount: 0 },
];

export default function WatchlistPage() {
  const [items, setItems] = useState(MOCK_WATCHLIST);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
          Watchlist
        </h1>
        <p className="mt-1" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Get notified when organizations you&apos;re tracking have new filings, score changes, anomaly alerts, or grant activity.
        </p>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <svg className="mx-auto mb-4 h-12 w-12" style={{ color: 'var(--text-tertiary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>No organizations watched</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Add organizations to your watchlist to receive alerts about their activity.
              </p>
              <Button variant="primary" size="md" className="mt-4" onClick={() => window.location.href = '/explore'}>
                Find Organizations
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => {
            const watchConfig = WATCH_TYPES[item.watchType];
            return (
              <Card key={item.id}>
                <CardContent>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <a
                          href={`/explore/${item.slug}`}
                          className="font-semibold hover:underline"
                          style={{ color: 'var(--accent-trust)', fontFamily: 'var(--font-display)' }}
                        >
                          {item.name}
                        </a>
                        <Badge variant="default">{item.country}</Badge>
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${watchConfig.color} 12%, transparent)`,
                            color: watchConfig.color,
                          }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: watchConfig.color }} />
                          {watchConfig.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        <span>Watching since {new Date(item.addedAt).toLocaleDateString()}</span>
                        {item.lastNotification && (
                          <span>Last alert: {new Date(item.lastNotification).toLocaleDateString()}</span>
                        )}
                        {item.alertCount > 0 && (
                          <Badge variant="warning">{item.alertCount} new</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => alert('Edit watch preferences — coming soon')}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))}>
                        Remove
                      </Button>
                    </div>
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
