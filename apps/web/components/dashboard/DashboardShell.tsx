'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type Route } from 'next';
import { cn } from '@opengive/ui';
import { ThemeToggle } from '../ThemeToggle';

// ---------------------------------------------------------------------------
// Inline SVG icons — lightweight, no external icon dep required in Phase 1
// ---------------------------------------------------------------------------

function IconGrid({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.75" />
      <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.75" />
      <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.75" />
      <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function IconCompass({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconArrowsRightLeft({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 16H3m0 0l4-4M3 16l4 4M17 8h4m0 0l-4-4m4 4l-4 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMagnifyingGlass({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.75" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconBell({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCog({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={cn('h-4 w-4', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronRight({ className }: { className?: string }) {
  return (
    <svg className={cn('h-4 w-4', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={cn('h-4 w-4', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.75" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Nav item definition
// ---------------------------------------------------------------------------

type NavLabelKey =
  | 'commandCenter'
  | 'explore'
  | 'flows'
  | 'investigate'
  | 'alerts'
  | 'settings';

interface NavItem {
  href: Route;
  labelKey: NavLabelKey;
  icon: React.ReactNode;
}

// ---------------------------------------------------------------------------
// DashboardShell
// ---------------------------------------------------------------------------

interface DashboardShellProps {
  children: React.ReactNode;
  /** Callback to open the CommandPalette — passed from the layout */
  onOpenSearch?: () => void;
}

export function DashboardShell({ children, onOpenSearch }: DashboardShellProps) {
  const t = useTranslations('nav');
  const tHeader = useTranslations('header');
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  const navItems: NavItem[] = [
    { href: '/command-center' as Route, labelKey: 'commandCenter', icon: <IconGrid /> },
    { href: '/explore' as Route, labelKey: 'explore', icon: <IconCompass /> },
    { href: '/flows' as Route, labelKey: 'flows', icon: <IconArrowsRightLeft /> },
    { href: '/investigate' as Route, labelKey: 'investigate', icon: <IconMagnifyingGlass /> },
    { href: '/alerts' as Route, labelKey: 'alerts', icon: <IconBell /> },
    { href: '/settings' as Route, labelKey: 'settings', icon: <IconCog /> },
  ];

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: 'var(--surface-ground)' }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Sidebar — desktop/tablet                                            */}
      {/* ------------------------------------------------------------------ */}
      <aside
        aria-label="Primary navigation"
        className={cn(
          'hidden md:flex flex-col shrink-0 h-full',
          'border-e border-[var(--border-subtle)]',
          'transition-[width] duration-[var(--transition-base)]',
          collapsed ? 'w-16' : 'w-60',
        )}
        style={{ backgroundColor: 'var(--surface-base)' }}
      >
        {/* Brand */}
        <div
          className={cn(
            'flex items-center h-14 px-4 shrink-0',
            'border-b border-[var(--border-subtle)]',
            collapsed ? 'justify-center' : 'justify-between',
          )}
        >
          {!collapsed && (
            <Link
              href="/"
              className={cn(
                'text-sm font-semibold tracking-tight',
                'text-[var(--text-primary)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]',
                'rounded-sm',
              )}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              OpenGive
            </Link>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={t('toggleSidebar')}
            className={cn(
              'flex items-center justify-center h-8 w-8 rounded-full',
              'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
              'hover:bg-[var(--surface-elevated)]',
              'transition-colors duration-[var(--transition-fast)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]',
            )}
          >
            {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          <ul role="list" className="flex flex-col gap-0.5">
            {navItems.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 h-10 rounded-full px-2',
                      'text-sm font-medium',
                      'transition-colors duration-[var(--transition-fast)]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]',
                      isActive
                        ? 'bg-[var(--accent-trust-subtle)] text-[var(--accent-trust)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)]',
                      collapsed && 'justify-center',
                    )}
                    title={collapsed ? t(item.labelKey) : undefined}
                  >
                    {item.icon}
                    {!collapsed && (
                      <span className="truncate">{t(item.labelKey)}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User avatar placeholder */}
        {!collapsed && (
          <div
            className={cn(
              'flex items-center gap-3 px-4 py-3',
              'border-t border-[var(--border-subtle)]',
            )}
          >
            <div
              aria-label={tHeader('userMenu')}
              className="h-8 w-8 rounded-full bg-[var(--accent-trust-subtle)] flex items-center justify-center text-xs font-semibold text-[var(--accent-trust)] shrink-0"
            >
              U
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                User
              </p>
              <p className="text-xs text-[var(--text-tertiary)] truncate">
                user@example.com
              </p>
            </div>
          </div>
        )}
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Main column (header + content)                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header bar */}
        <header
          className={cn(
            'flex items-center justify-between h-14 px-4 shrink-0',
            'border-b border-[var(--border-subtle)]',
          )}
          style={{ backgroundColor: 'var(--surface-base)' }}
        >
          {/* Mobile brand */}
          <Link
            href="/"
            className="md:hidden text-sm font-semibold tracking-tight text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] rounded-sm"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            OpenGive
          </Link>

          <div className="hidden md:block" />

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {/* Search trigger */}
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label={tHeader('searchTrigger')}
              className={cn(
                'hidden sm:flex items-center gap-2 h-9 px-3 rounded-full',
                'text-sm text-[var(--text-tertiary)]',
                'border border-[var(--border-default)]',
                'hover:border-[var(--border-emphasis)] hover:text-[var(--text-primary)]',
                'bg-[var(--surface-raised)]',
                'transition-colors duration-[var(--transition-fast)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]',
              )}
            >
              <IconSearch />
              <span className="hidden lg:inline">{tHeader('searchPlaceholder')}</span>
              <kbd
                className="hidden lg:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded border border-[var(--border-default)] bg-[var(--surface-elevated)] text-[var(--text-tertiary)]"
                aria-label="Keyboard shortcut: Command K"
              >
                {tHeader('searchShortcut')}
              </kbd>
            </button>

            {/* Theme toggle */}
            <ThemeToggle />

            {/* User avatar placeholder */}
            <button
              type="button"
              aria-label={tHeader('userMenu')}
              className={cn(
                'h-8 w-8 rounded-full',
                'bg-[var(--accent-trust-subtle)]',
                'flex items-center justify-center',
                'text-xs font-semibold text-[var(--accent-trust)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]',
                'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)]',
              )}
            >
              U
            </button>
          </div>
        </header>

        {/* Scrollable content area */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-4 md:p-6"
          style={{ backgroundColor: 'var(--surface-ground)' }}
        >
          {children}
        </main>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Bottom nav — mobile only                                            */}
      {/* ------------------------------------------------------------------ */}
      <nav
        aria-label="Mobile navigation"
        className={cn(
          'fixed bottom-0 inset-x-0 md:hidden z-40',
          'mx-3 mb-3 rounded-full',
          'border border-[var(--border-subtle)]',
          'shadow-[var(--shadow-lg)]',
          'grid grid-cols-5',
        )}
        style={{ backgroundColor: 'var(--surface-base)' }}
      >
        {navItems.slice(0, 5).map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              aria-label={t(item.labelKey)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium',
                'transition-colors duration-[var(--transition-fast)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]',
                isActive
                  ? 'text-[var(--accent-trust)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
              )}
            >
              {item.icon}
              <span>{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
