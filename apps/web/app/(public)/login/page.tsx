'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button, Input } from '@opengive/ui';
import { createClient } from '../../../lib/supabase/client';

// ---------------------------------------------------------------------------
// Magic-link login form
// ---------------------------------------------------------------------------

export default function LoginPage() {
  const t = useTranslations('auth.login');
  const tCommon = useTranslations('common');

  const [email, setEmail] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [state, setState] = React.useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = React.useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setState('idle');
    setErrorMessage('');

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/explore`,
        },
      });

      if (error) {
        throw error;
      }

      setState('success');
    } catch (err: unknown) {
      setState('error');
      setErrorMessage(
        err instanceof Error ? err.message : tCommon('error'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: 'var(--surface-base)' }}
    >
      {/* Card */}
      <div
        className="w-full max-w-sm rounded-lg border border-[var(--border-subtle)] p-8"
        style={{ backgroundColor: 'var(--surface-raised)', boxShadow: 'var(--shadow-lg)' }}
      >
        {/* Brand */}
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] rounded-sm"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            OpenGive
          </Link>
          <h1
            className="mt-4 font-semibold text-[var(--text-primary)]"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)' }}
          >
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{t('subtitle')}</p>
        </div>

        {/* Success state */}
        {state === 'success' && (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center text-center gap-3"
          >
            <div
              className="h-12 w-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--signal-healthy-subtle)' }}
              aria-hidden="true"
            >
              <svg className="h-6 w-6 text-[var(--signal-healthy)]" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="font-semibold text-[var(--text-primary)]">{t('successTitle')}</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              {t('successMessage', { email })}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setState('idle'); setEmail(''); }}
            >
              {tCommon('back')}
            </Button>
          </div>
        )}

        {/* Form state */}
        {state !== 'success' && (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
            <Input
              type="email"
              id="email"
              label={t('emailLabel')}
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              errorMessage={state === 'error' ? errorMessage : undefined}
              disabled={isSubmitting}
              aria-required="true"
            />

            <Button
              type="submit"
              size="lg"
              isLoading={isSubmitting}
              disabled={!email.trim()}
              className="w-full"
            >
              {isSubmitting ? t('submitting') : t('submitButton')}
            </Button>

            <p className="text-center text-xs text-[var(--text-tertiary)]">
              {t('termsNotice')}
            </p>
          </form>
        )}
      </div>

      {/* Back to home */}
      <div className="mt-6">
        <Link
          href="/"
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] rounded-sm"
        >
          {t('backToHome')}
        </Link>
      </div>
    </div>
  );
}
