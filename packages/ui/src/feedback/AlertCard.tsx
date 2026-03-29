'use client';

import * as React from 'react';
import { cn } from '../lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AlertType =
  | 'overhead_manipulation'
  | 'related_party'
  | 'compensation_outlier'
  | 'revenue_expense_mismatch'
  | 'benford_violation'
  | 'network_anomaly'
  | 'filing_inconsistency'
  | 'geographic_discrepancy'
  | 'zero_fundraising'
  | 'rapid_growth'
  | 'shell_indicator'
  | 'other';

export interface AlertCardData {
  id: string;
  severity: AlertSeverity;
  type: AlertType;
  organizationId: string;
  organizationName: string;
  organizationSlug?: string;
  confidence: number;
  description: string;
  createdAt: string | Date;
}

export interface AlertCardProps {
  alert: AlertCardData;
  /** Fired when the card (or org name) is clicked */
  onClick?: (alert: AlertCardData) => void;
  /** Highlighted state (e.g. when navigated from org detail) */
  highlighted?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Severity config — color + icon (WCAG: never color alone)
// ---------------------------------------------------------------------------

interface SeverityConfig {
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
  icon: React.ReactElement;
}

const SEVERITY_CONFIG: Record<AlertSeverity, SeverityConfig> = {
  low: {
    color: '#22C55E',
    bgColor: 'var(--signal-healthy-subtle)',
    borderColor: 'rgba(34,197,94,0.25)',
    label: 'Low',
    icon: (
      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="12" r="5" />
      </svg>
    ),
  },
  medium: {
    color: '#F59E0B',
    bgColor: 'var(--signal-caution-subtle)',
    borderColor: 'rgba(245,158,11,0.25)',
    label: 'Medium',
    icon: (
      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" />
        <circle cx="12" cy="17" r="0.5" />
      </svg>
    ),
  },
  high: {
    color: '#EF4444',
    bgColor: 'var(--signal-danger-subtle)',
    borderColor: 'rgba(239,68,68,0.25)',
    label: 'High',
    icon: (
      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" />
        <circle cx="12" cy="16" r="0.5" fill="currentColor" />
      </svg>
    ),
  },
  critical: {
    color: '#EF4444',
    bgColor: 'var(--signal-danger-subtle)',
    borderColor: 'rgba(239,68,68,0.4)',
    label: 'Critical',
    icon: (
      <svg className="h-3.5 w-3.5 shrink-0 animate-pulse" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 7v5M12 15.5v.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
};

// ---------------------------------------------------------------------------
// Alert type labels
// ---------------------------------------------------------------------------

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  overhead_manipulation: 'Overhead Manipulation',
  related_party: 'Related Party',
  compensation_outlier: 'Compensation Outlier',
  revenue_expense_mismatch: 'Revenue/Expense Mismatch',
  benford_violation: 'Benford Violation',
  network_anomaly: 'Network Anomaly',
  filing_inconsistency: 'Filing Inconsistency',
  geographic_discrepancy: 'Geographic Discrepancy',
  zero_fundraising: 'Zero Fundraising',
  rapid_growth: 'Rapid Growth',
  shell_indicator: 'Shell Indicator',
  other: 'Other',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = Date.now();
  const diff = now - d.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AlertCard({ alert, onClick, highlighted = false, className }: AlertCardProps) {
  const config = SEVERITY_CONFIG[alert.severity];
  const safeConfidence = Math.min(100, Math.max(0, alert.confidence));

  return (
    <article
      className={cn(
        'relative flex gap-3 rounded-md border p-3.5 transition-colors',
        'hover:border-[var(--border-emphasis)] cursor-pointer',
        highlighted && 'ring-2 ring-[var(--accent-trust)]/40',
        className,
      )}
      style={{
        backgroundColor: highlighted ? 'var(--surface-elevated)' : 'var(--surface-raised)',
        borderColor: highlighted ? config.borderColor : 'var(--border-subtle)',
      }}
      onClick={() => onClick?.(alert)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(alert);
        }
      }}
      aria-label={`${config.label} severity alert: ${ALERT_TYPE_LABELS[alert.type]} for ${alert.organizationName}. Confidence: ${safeConfidence}%. ${alert.description}`}
    >
      {/* Severity indicator strip */}
      <div
        className="absolute inset-y-0 start-0 w-1 rounded-s-md"
        style={{ backgroundColor: config.color }}
        aria-hidden="true"
      />

      {/* Main content */}
      <div className="flex-1 min-w-0 ps-1">
        {/* Row 1: severity badge + type badge + timestamp */}
        <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
          {/* Severity — color + icon + text */}
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border"
            style={{
              color: config.color,
              backgroundColor: config.bgColor,
              borderColor: config.borderColor,
            }}
          >
            {config.icon}
            {config.label}
          </span>

          {/* Alert type */}
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-[var(--surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-default)]">
            {ALERT_TYPE_LABELS[alert.type]}
          </span>

          {/* Timestamp */}
          <time
            dateTime={typeof alert.createdAt === 'string' ? alert.createdAt : alert.createdAt.toISOString()}
            className="ms-auto text-[10px] text-[var(--text-tertiary)] shrink-0"
          >
            {formatRelativeTime(alert.createdAt)}
          </time>
        </div>

        {/* Row 2: Org name */}
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate mb-1">
          {alert.organizationName}
        </p>

        {/* Row 3: description */}
        <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-2">
          {alert.description}
        </p>

        {/* Row 4: confidence bar */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--text-tertiary)] shrink-0">Confidence</span>
          <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-elevated)] overflow-hidden" aria-hidden="true">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${safeConfidence}%`,
                backgroundColor: config.color,
                opacity: 0.8,
              }}
            />
          </div>
          <span
            className="text-[10px] font-mono font-medium shrink-0"
            style={{ color: config.color, fontFamily: "'IBM Plex Mono', 'Fira Code', monospace" }}
          >
            {safeConfidence}%
          </span>
        </div>
      </div>
    </article>
  );
}
