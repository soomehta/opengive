'use client';

import { useState } from 'react';
import { Button, Card, CardHeader, CardContent, Badge } from '@opengive/ui';

interface BookmarkedOrg {
  id: string;
  name: string;
  slug: string;
  country: string;
  sector: string;
  bookmarkedAt: string;
  notes?: string;
}

const MOCK_BOOKMARKS: BookmarkedOrg[] = [
  { id: '1', name: 'American Red Cross', slug: 'american-red-cross', country: 'US', sector: 'Humanitarian', bookmarkedAt: '2026-03-28', notes: 'Reviewing financial filings' },
  { id: '2', name: 'Oxfam International', slug: 'oxfam-international', country: 'GB', sector: 'Poverty', bookmarkedAt: '2026-03-25' },
  { id: '3', name: 'Doctors Without Borders', slug: 'doctors-without-borders', country: 'CH', sector: 'Healthcare', bookmarkedAt: '2026-03-20', notes: 'Monitoring grant flows' },
];

export default function BookmarksPage() {
  const [bookmarks] = useState(MOCK_BOOKMARKS);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
          Bookmarks
        </h1>
        <p className="mt-1" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Organizations you&apos;ve saved for quick access. Add notes to track your research.
        </p>
      </div>

      {bookmarks.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <svg className="mx-auto mb-4 h-12 w-12" style={{ color: 'var(--text-tertiary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
              </svg>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>No bookmarks yet</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Browse organizations and click the bookmark icon to save them here.
              </p>
              <Button variant="primary" size="md" className="mt-4" onClick={() => window.location.href = '/explore'}>
                Explore Organizations
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {bookmarks.map((org) => (
            <Card key={org.id}>
              <CardContent>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <a
                        href={`/explore/${org.slug}`}
                        className="font-semibold hover:underline truncate"
                        style={{ color: 'var(--accent-trust)', fontFamily: 'var(--font-display)' }}
                      >
                        {org.name}
                      </a>
                      <Badge variant="default">{org.country}</Badge>
                      <Badge variant="primary">{org.sector}</Badge>
                    </div>
                    {org.notes && (
                      <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {org.notes}
                      </p>
                    )}
                    <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                      Bookmarked {new Date(org.bookmarkedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm">
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
