'use client';

import * as React from 'react';
import { Badge } from '../primitives/Badge';
import { cn } from '../lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FreshnessBadgeProps {
  /** ISO 8601 date string or null if unknown */
  lastUpdated: string | null;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysSince(dateStr: string): number {
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  const diffMs = now - then;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// Calendar / clock icon for freshness context
function ClockIcon() {
  return (
    <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Unknown / question icon used when date is null
function UnknownIcon() {
  return (
    <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path
        d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

type BadgeVariant = 'success' | 'warning' | 'danger' | 'default';

interface FreshnessConfig {
  variant: BadgeVariant;
  label: string;
  ariaLabel: string;
  icon: React.ReactElement;
}

function getFreshnessConfig(lastUpdated: string | null): FreshnessConfig {
  if (lastUpdated === null) {
    return {
      variant: 'default',
      label: 'Update date unknown',
      ariaLabel: 'Data freshness unknown — update date not available',
      icon: <UnknownIcon />,
    };
  }

  const days = daysSince(lastUpdated);

  if (days < 7) {
    const label = days === 0 ? 'Updated today' : `Updated ${days} day${days === 1 ? '' : 's'} ago`;
    return {
      variant: 'success',
      label,
      ariaLabel: `Data is fresh. ${label}.`,
      icon: <ClockIcon />,
    };
  }

  if (days <= 30) {
    return {
      variant: 'warning',
      label: `Updated ${days} days ago`,
      ariaLabel: `Data may be moderately stale. Updated ${days} days ago.`,
      icon: <ClockIcon />,
    };
  }

  return {
    variant: 'danger',
    label: `Updated ${days} days ago`,
    ariaLabel: `Data is stale. Updated ${days} days ago. Consider verifying with the original source.`,
    icon: <ClockIcon />,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FreshnessBadge({ lastUpdated, className }: FreshnessBadgeProps) {
  const config = getFreshnessConfig(lastUpdated);

  return (
    <Badge
      variant={config.variant}
      size="sm"
      hideIcon
      className={cn('gap-1', className)}
      aria-label={config.ariaLabel}
      title={
        lastUpdated
          ? `Last updated: ${new Date(lastUpdated).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}`
          : 'Update date unknown'
      }
    >
      {config.icon}
      {config.label}
    </Badge>
  );
}
