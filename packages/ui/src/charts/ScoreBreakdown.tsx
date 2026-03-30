'use client';

import * as React from 'react';
import { cn } from '../lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoreBreakdownProps {
  overall: number;
  financialHealth: number;
  transparency: number;
  governance: number;
  efficiency: number;
  breakdown: Record<string, number>;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PILLARS = [
  { key: 'financialHealth', label: 'Financial Health', weight: 0.35, weightLabel: '35%' },
  { key: 'transparency',    label: 'Transparency',     weight: 0.25, weightLabel: '25%' },
  { key: 'governance',      label: 'Governance',       weight: 0.25, weightLabel: '25%' },
  { key: 'efficiency',      label: 'Efficiency',       weight: 0.15, weightLabel: '15%' },
] as const;

type PillarKey = typeof PILLARS[number]['key'];

/** Human-readable labels for breakdown sub-component keys. */
const BREAKDOWN_LABELS: Record<string, string> = {
  'financialHealth.revenueTrend':       'Revenue Trend (3yr)',
  'financialHealth.expenseRatio':        'Expense Ratio',
  'financialHealth.reserveMonths':       'Reserve Months',
  'financialHealth.deficitRisk':         'Deficit Risk',
  'transparency.filingCompleteness':     'Filing Completeness',
  'transparency.disclosureScore':        'Disclosure Score',
  'transparency.auditPresence':          'Audit Presence',
  'transparency.boardDisclosure':        'Board Disclosure',
  'governance.boardSize':                'Board Size',
  'governance.independenceRatio':        'Independence Ratio',
  'governance.conflictPolicy':           'Conflict-of-Interest Policy',
  'governance.compensationPolicy':       'Compensation Policy',
  'efficiency.programExpenseRatio':      'Program Expense Ratio',
  'efficiency.fundraisingEfficiency':    'Fundraising Efficiency',
  'efficiency.adminOverhead':            'Admin Overhead',
};

function getBreakdownLabel(key: string): string {
  if (BREAKDOWN_LABELS[key]) return BREAKDOWN_LABELS[key];
  // Fallback: strip pillar prefix and convert camelCase to title case
  const bare = key.includes('.') ? key.split('.').slice(1).join('.') : key;
  return bare
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(val: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, val));
}

interface PillarColors {
  bar: string;
  text: string;
  bgSubtle: string;
  border: string;
}

function pillarColors(score: number): PillarColors {
  if (score >= 70) {
    return {
      bar: '#6BAF7B',
      text: '#6BAF7B',
      bgSubtle: 'var(--signal-healthy-subtle)',
      border: 'rgba(107,175,123,0.25)',
    };
  }
  if (score >= 40) {
    return {
      bar: '#E8B86D',
      text: '#E8B86D',
      bgSubtle: 'var(--signal-caution-subtle)',
      border: 'rgba(232,184,109,0.25)',
    };
  }
  return {
    bar: '#D4736E',
    text: '#D4736E',
    bgSubtle: 'var(--signal-danger-subtle)',
    border: 'rgba(212,115,110,0.25)',
  };
}

// Chevron icon — rotates based on expanded state
function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className="h-4 w-4 shrink-0 transition-transform duration-200"
      style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Info icon for the "Why this score?" toggle
function InfoIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface PillarRowProps {
  pillarKey: PillarKey;
  label: string;
  weightLabel: string;
  score: number;
  subItems: Array<{ key: string; value: number }>;
}

function PillarRow({ label, weightLabel, score, subItems }: PillarRowProps) {
  const safeScore = clamp(score);
  const colors = pillarColors(safeScore);

  return (
    <div
      className="rounded-xl border p-3 flex flex-col gap-2"
      style={{
        backgroundColor: 'var(--surface-raised)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Pillar header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="text-sm font-semibold"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body, system-ui)' }}
        >
          {label}
        </span>
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border"
          style={{
            color: 'var(--text-tertiary)',
            backgroundColor: 'var(--surface-elevated)',
            borderColor: 'var(--border-default)',
            fontFamily: "'IBM Plex Mono', 'Fira Code', monospace",
          }}
        >
          {weightLabel}
        </span>

        {/* Score chip */}
        <span
          className="ms-auto text-xs font-semibold px-2 py-0.5 rounded-full border"
          style={{
            color: colors.text,
            backgroundColor: colors.bgSubtle,
            borderColor: colors.border,
            fontFamily: "'IBM Plex Mono', 'Fira Code', monospace",
          }}
        >
          {safeScore}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: 6, backgroundColor: 'var(--surface-elevated)' }}
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${safeScore}%`, backgroundColor: colors.bar, opacity: 0.85 }}
        />
      </div>

      {/* Sub-components */}
      {subItems.length > 0 && (
        <ul className="flex flex-col gap-1.5 mt-0.5" role="list">
          {subItems.map(({ key, value }) => {
            const safeVal = clamp(value);
            const subColors = pillarColors(safeVal);
            return (
              <li key={key} className="flex items-center gap-2">
                <span
                  className="text-xs text-[var(--text-secondary)] flex-1 min-w-0 truncate"
                  style={{ fontFamily: 'var(--font-body, system-ui)' }}
                >
                  {getBreakdownLabel(key)}
                </span>
                <div
                  className="w-16 rounded-full overflow-hidden shrink-0"
                  style={{ height: 4, backgroundColor: 'var(--surface-elevated)' }}
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${safeVal}%`,
                      backgroundColor: subColors.bar,
                      opacity: 0.75,
                    }}
                  />
                </div>
                <span
                  className="text-[10px] font-medium w-6 text-end shrink-0"
                  style={{
                    color: subColors.text,
                    fontFamily: "'IBM Plex Mono', 'Fira Code', monospace",
                  }}
                >
                  {safeVal}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScoreBreakdown({
  overall,
  financialHealth,
  transparency,
  governance,
  efficiency,
  breakdown,
  className,
}: ScoreBreakdownProps) {
  const [expanded, setExpanded] = React.useState(false);

  const safeOverall = clamp(overall);
  const overallColors = pillarColors(safeOverall);

  const pillarScores: Record<PillarKey, number> = {
    financialHealth,
    transparency,
    governance,
    efficiency,
  };

  // Group breakdown keys by pillar prefix
  const subItemsByPillar = React.useMemo<Record<PillarKey, Array<{ key: string; value: number }>>>(() => {
    const result: Record<PillarKey, Array<{ key: string; value: number }>> = {
      financialHealth: [],
      transparency: [],
      governance: [],
      efficiency: [],
    };
    for (const [key, value] of Object.entries(breakdown)) {
      const prefix = key.split('.')[0] as PillarKey;
      if (prefix in result) {
        result[prefix].push({ key, value });
      }
    }
    return result;
  }, [breakdown]);

  const panelId = React.useId();
  const buttonId = React.useId();

  return (
    <div
      className={cn('rounded-2xl border', className)}
      style={{
        backgroundColor: 'var(--surface-base)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 p-4">
        {/* Overall score badge */}
        <div
          className="flex items-center justify-center rounded-xl font-semibold text-base shrink-0"
          style={{
            width: 48,
            height: 48,
            backgroundColor: overallColors.bgSubtle,
            border: `1.5px solid ${overallColors.border}`,
            color: overallColors.text,
            fontFamily: "'IBM Plex Mono', 'Fira Code', monospace",
          }}
          aria-hidden="true"
        >
          {safeOverall}
        </div>

        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-semibold"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body, system-ui)' }}
          >
            Overall Score
          </p>
          <p
            className="text-xs mt-0.5"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Weighted across 4 scoring pillars
          </p>
        </div>

        {/* Toggle button */}
        <button
          id={buttonId}
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border',
            'transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] focus-visible:ring-offset-2',
          )}
          style={{
            color: 'var(--text-secondary)',
            backgroundColor: expanded ? 'var(--surface-elevated)' : 'var(--surface-raised)',
            borderColor: expanded ? 'var(--border-emphasis)' : 'var(--border-default)',
            fontFamily: 'var(--font-body, system-ui)',
          }}
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          aria-controls={panelId}
        >
          <InfoIcon />
          Why this score?
          <ChevronIcon expanded={expanded} />
        </button>
      </div>

      {/* Expandable panel */}
      {expanded && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={buttonId}
          className="flex flex-col gap-2.5 px-4 pb-4"
        >
          <div
            className="h-px mb-0.5"
            style={{ backgroundColor: 'var(--border-subtle)' }}
            aria-hidden="true"
          />

          {PILLARS.map((pillar) => (
            <PillarRow
              key={pillar.key}
              pillarKey={pillar.key}
              label={pillar.label}
              weightLabel={pillar.weightLabel}
              score={pillarScores[pillar.key]}
              subItems={subItemsByPillar[pillar.key]}
            />
          ))}

          {/* Scoring methodology footnote */}
          <p
            className="text-[10px] text-end"
            style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-body, system-ui)' }}
          >
            Weights: Financial Health 35% · Transparency 25% · Governance 25% · Efficiency 15%
          </p>
        </div>
      )}
    </div>
  );
}
