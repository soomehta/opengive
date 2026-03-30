'use client';

import * as React from 'react';
import { Button, Card, CardHeader, CardContent, Input, Badge } from '@opengive/ui';
import { trpc } from '../../../lib/trpc';

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <Card>
        <CardHeader>
          <h2
            id={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}
            className="font-semibold"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontSize: 'var(--text-lg)' }}
          >
            {title}
          </h2>
          {description && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {description}
            </p>
          )}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 1. Account section
// ---------------------------------------------------------------------------

function AccountSection() {
  const utils = trpc.useUtils();
  const { data: profile, isLoading } = trpc.settings.getProfile.useQuery();

  const [displayName, setDisplayName] = React.useState('');
  const [editing, setEditing] = React.useState(false);

  // Sync displayName state when profile loads
  React.useEffect(() => {
    if (profile?.displayName) setDisplayName(profile.displayName);
  }, [profile?.displayName]);

  const updateProfile = trpc.settings.updateProfile.useMutation({
    onSuccess: () => {
      void utils.settings.getProfile.invalidate();
      setEditing(false);
    },
  });

  if (isLoading) {
    return (
      <Section title="Account">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-[var(--surface-elevated)] rounded w-1/3" />
          <div className="h-4 bg-[var(--surface-elevated)] rounded w-1/4" />
        </div>
      </Section>
    );
  }

  return (
    <Section title="Account" description="Your public profile information.">
      <div className="flex flex-col gap-5 max-w-md">
        {/* Display name */}
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateProfile.mutate({ displayName: displayName.trim() || undefined });
            }}
            className="flex flex-col gap-3"
          >
            <Input
              id="display-name"
              label="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={100}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={updateProfile.isPending}
              >
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-tertiary)' }}>
                Display name
              </p>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {profile?.displayName ?? 'Not set'}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        )}

        {/* Email — read-only */}
        <div>
          <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-tertiary)' }}>
            Email
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Managed by Supabase Auth — update via your email client.
          </p>
        </div>

        {/* Role badge */}
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
            Role
          </p>
          <Badge variant={profile?.role === 'admin' ? 'danger' : profile?.role === 'analyst' ? 'warning' : 'default'}>
            {profile?.role ?? 'viewer'}
          </Badge>
        </div>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 2. Preferences section
// ---------------------------------------------------------------------------

type Theme = 'dark' | 'light';
const STORAGE_KEY = 'opengive-theme';

function PreferencesSection() {
  const [theme, setTheme] = React.useState<Theme>('light');
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const resolved =
      stored === 'dark' || stored === 'light'
        ? stored
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    setTheme(resolved);
    setMounted(true);
  }, []);

  function applyAndStore(next: Theme) {
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    const root = document.documentElement;
    if (next === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
  }

  return (
    <Section title="Preferences" description="Appearance and display settings.">
      <div className="flex flex-col gap-4 max-w-md">
        <fieldset>
          <legend
            className="text-sm font-medium mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            Theme
          </legend>
          <div className="flex gap-3">
            {(['light', 'dark'] as Theme[]).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={mounted && theme === t}
                onClick={() => applyAndStore(t)}
                className="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]"
                style={{
                  borderColor:
                    mounted && theme === t
                      ? 'var(--accent-trust)'
                      : 'var(--border-default)',
                  color:
                    mounted && theme === t
                      ? 'var(--accent-trust)'
                      : 'var(--text-secondary)',
                  backgroundColor:
                    mounted && theme === t
                      ? 'var(--accent-trust-subtle)'
                      : 'var(--surface-raised)',
                }}
              >
                {t === 'light' ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.75" />
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 3. API Keys section
// ---------------------------------------------------------------------------

function ApiKeysSection() {
  const utils = trpc.useUtils();
  const { data: profile } = trpc.settings.getProfile.useQuery();
  const [newKey, setNewKey] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const generateKey = trpc.settings.generateApiKey.useMutation({
    onSuccess: (data) => {
      setNewKey(data.key);
      void utils.settings.getProfile.invalidate();
    },
  });

  const revokeKey = trpc.settings.revokeApiKey.useMutation({
    onSuccess: () => {
      setNewKey(null);
      void utils.settings.getProfile.invalidate();
    },
  });

  function handleCopy() {
    if (!newKey) return;
    void navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const hasKey = profile?.hasApiKey || newKey !== null;

  return (
    <Section
      title="API Keys"
      description="Use API keys to authenticate requests to the OpenGive public API. Rate limit: 1,000 requests/min."
    >
      <div className="flex flex-col gap-4 max-w-lg">
        {/* New key banner */}
        {newKey && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-lg border border-[var(--signal-healthy)] p-4"
            style={{ backgroundColor: 'var(--signal-healthy-subtle)' }}
          >
            <p
              className="text-xs font-semibold mb-2"
              style={{ color: 'var(--signal-healthy)' }}
            >
              Copy your API key — it will not be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code
                className="flex-1 min-w-0 block overflow-x-auto rounded px-3 py-2 text-xs font-mono"
                style={{
                  backgroundColor: 'var(--surface-base)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)',
                }}
              >
                {newKey}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                aria-label="Copy API key"
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>
        )}

        {/* Key status */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {hasKey ? 'Active API key' : 'No API key'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              {hasKey
                ? 'Your key is hashed and stored securely. Generate a new one to replace it.'
                : 'Generate a key to access the REST API programmatically.'}
            </p>
          </div>
          {hasKey && (
            <Badge variant="default" className="shrink-0">Active</Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="primary"
            size="sm"
            isLoading={generateKey.isPending}
            onClick={() => generateKey.mutate()}
          >
            {hasKey ? 'Regenerate key' : 'Generate key'}
          </Button>
          {hasKey && (
            <Button
              variant="ghost"
              size="sm"
              isLoading={revokeKey.isPending}
              onClick={() => revokeKey.mutate()}
            >
              Revoke
            </Button>
          )}
        </div>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 4. Danger Zone section
// ---------------------------------------------------------------------------

function DangerZoneSection() {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState('');

  const CONFIRM_WORD = 'DELETE';
  const isConfirmed = confirmText === CONFIRM_WORD;

  function handleDelete() {
    if (!isConfirmed) return;
    // Actual account deletion requires a Supabase Admin API call or an edge
    // function. For now we surface the UI and log a warning — the backend
    // implementation can be wired up once the edge function is ready.
    console.warn('Account deletion requested — backend not yet wired up.');
    setConfirmOpen(false);
    setConfirmText('');
  }

  return (
    <Section title="Danger Zone">
      <div className="flex flex-col gap-4 max-w-lg">
        <div
          className="rounded-lg border p-4"
          style={{ borderColor: 'var(--signal-danger)' }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--signal-danger)' }}>
                Delete account
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Permanently delete your account and all associated data. This action cannot be
                undone.
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              className="shrink-0"
            >
              Delete account
            </Button>
          </div>

          {/* Confirmation form */}
          {confirmOpen && (
            <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
              <p className="text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
                Type <strong>{CONFIRM_WORD}</strong> to confirm deletion.
              </p>
              <div className="flex flex-col gap-3">
                <Input
                  id="delete-confirm"
                  label={`Type "${CONFIRM_WORD}" to confirm`}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={CONFIRM_WORD}
                  autoComplete="off"
                />
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={!isConfirmed}
                    onClick={handleDelete}
                  >
                    Confirm deletion
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setConfirmOpen(false); setConfirmText(''); }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Settings page root
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
        >
          Settings
        </h1>
        <p className="mt-1" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Manage your account, preferences, and API access.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <AccountSection />
        <PreferencesSection />
        <ApiKeysSection />
        <DangerZoneSection />
      </div>
    </div>
  );
}
