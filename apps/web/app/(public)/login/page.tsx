'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Input } from '@opengive/ui';
import { cn } from '@opengive/ui';
import { createClient } from '../../../lib/supabase/client';

// ---------------------------------------------------------------------------
// OAuth provider icons
// ---------------------------------------------------------------------------

function IconGoogle({ className }: { className?: string }) {
  return (
    <svg
      className={cn('h-4 w-4 shrink-0', className)}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function IconGitHub({ className }: { className?: string }) {
  return (
    <svg
      className={cn('h-4 w-4 shrink-0', className)}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.185 6.839 9.504.5.092.682-.217.682-.482 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.004.07 1.532 1.032 1.532 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.026 2.747-1.026.546 1.378.202 2.397.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482C19.138 20.203 22 16.447 22 12.021 22 6.484 17.523 2 12 2z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// OAuth button
// ---------------------------------------------------------------------------

interface OAuthButtonProps {
  provider: 'google' | 'github';
  label: string;
  isLoading: boolean;
  onSignIn: (provider: 'google' | 'github') => void;
}

function OAuthButton({ provider, label, isLoading, onSignIn }: OAuthButtonProps) {
  const isGoogle = provider === 'google';

  return (
    <button
      type="button"
      onClick={() => onSignIn(provider)}
      disabled={isLoading}
      className={cn(
        'flex items-center justify-center gap-2.5 h-10 w-full rounded-full px-4',
        'text-sm font-medium border',
        'transition-colors duration-[var(--transition-fast)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        isGoogle
          ? 'bg-white text-gray-800 border-[var(--border-default)] hover:bg-gray-50 dark:bg-[var(--surface-elevated)] dark:text-[var(--text-primary)] dark:hover:bg-[var(--surface-raised)]'
          : 'bg-[#24292e] text-white border-[#24292e] hover:bg-[#2f363d]',
      )}
      aria-label={label}
    >
      {isGoogle ? <IconGoogle /> : <IconGitHub />}
      <span>{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Inner component that reads search params (must be in a Suspense boundary)
// ---------------------------------------------------------------------------

function LoginForm() {
  const t = useTranslations('auth.login');
  const tCommon = useTranslations('common');
  const searchParams = useSearchParams();
  const oauthFailed = searchParams.get('error') === 'auth_failed';

  const [email, setEmail] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [oauthLoading, setOauthLoading] = React.useState<'google' | 'github' | null>(null);
  const [state, setState] = React.useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = React.useState('');

  // Show oauth error from redirect query param
  React.useEffect(() => {
    if (oauthFailed) {
      setState('error');
      setErrorMessage(t('oauthError'));
    }
  }, [oauthFailed, t]);

  async function handleOAuthSignIn(provider: 'google' | 'github') {
    setOauthLoading(provider);
    setState('idle');
    setErrorMessage('');

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }
      // Browser will redirect — keep spinner until navigation
    } catch (err: unknown) {
      setState('error');
      setErrorMessage(
        err instanceof Error ? err.message : t('oauthError'),
      );
      setOauthLoading(null);
    }
  }

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

  const isAnyOAuthLoading = oauthLoading !== null;

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
          <div className="flex flex-col gap-5">
            {/* OAuth providers */}
            <div className="flex flex-col gap-3">
              <OAuthButton
                provider="google"
                label={t('continueWithGoogle')}
                isLoading={oauthLoading === 'google'}
                onSignIn={handleOAuthSignIn}
              />
              <OAuthButton
                provider="github"
                label={t('continueWithGitHub')}
                isLoading={oauthLoading === 'github'}
                onSignIn={handleOAuthSignIn}
              />
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3" aria-hidden="true">
              <div className="flex-1 h-px bg-[var(--border-subtle)]" />
              <span className="text-xs text-[var(--text-tertiary)] select-none">{t('orDivider')}</span>
              <div className="flex-1 h-px bg-[var(--border-subtle)]" />
            </div>

            {/* Magic-link form */}
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
                disabled={isSubmitting || isAnyOAuthLoading}
                aria-required="true"
              />

              <Button
                type="submit"
                size="lg"
                isLoading={isSubmitting}
                disabled={!email.trim() || isAnyOAuthLoading}
                className="w-full"
              >
                {isSubmitting ? t('submitting') : t('submitButton')}
              </Button>

              <p className="text-center text-xs text-[var(--text-tertiary)]">
                {t('termsNotice')}
              </p>
            </form>
          </div>
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

// ---------------------------------------------------------------------------
// Page export — wraps LoginForm in Suspense so useSearchParams() is allowed
// ---------------------------------------------------------------------------

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginForm />
    </React.Suspense>
  );
}
