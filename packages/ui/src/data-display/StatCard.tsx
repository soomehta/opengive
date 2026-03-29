import * as React from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TrendDirection = 'up' | 'down' | 'neutral';

interface SparklineDataPoint {
  value: number;
}

interface StatCardProps {
  label: string;
  value: number | string;
  /** Optional currency symbol prepended to numeric values */
  currencySymbol?: string;
  trend?: TrendDirection;
  /** Percentage change for trend display */
  trendValue?: number;
  /** Sparkline data points — renders a tiny SVG line chart */
  sparklineData?: SparklineDataPoint[];
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(value: number, currencySymbol?: string): string {
  const symbol = currencySymbol ?? '';
  if (Math.abs(value) >= 1_000_000_000) {
    return `${symbol}${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (Math.abs(value) >= 1_000_000) {
    return `${symbol}${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${symbol}${(value / 1_000).toFixed(1)}K`;
  }
  return `${symbol}${value.toLocaleString()}`;
}

// ---------------------------------------------------------------------------
// Sparkline (pure SVG, no library)
// ---------------------------------------------------------------------------

function Sparkline({ data }: { data: SparklineDataPoint[] }) {
  if (data.length < 2) return null;

  const W = 80;
  const H = 28;
  const pad = 2;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = pad + ((W - pad * 2) / (values.length - 1)) * i;
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  // Closed area path for fill
  const firstX = pad;
  const lastX = pad + (W - pad * 2);
  const areaD = `M ${firstX},${H} L ${points.join(' L ')} L ${lastX},${H} Z`;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden="true"
      className="overflow-visible"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#spark-fill)" />
      <path
        d={pathD}
        fill="none"
        stroke="#3B82F6"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Trend icons
// ---------------------------------------------------------------------------

function TrendUp() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 10L6 6L9 9L12 4" stroke="#22C55E" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 4h3v3" stroke="#22C55E" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrendDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 4L6 8L9 5L12 10" stroke="#EF4444" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 10h3v-3" stroke="#EF4444" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrendNeutral() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 7h10" stroke="#9BA3B5" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

const trendConfig = {
  up: {
    icon: <TrendUp />,
    color: 'var(--signal-healthy)',
    label: 'Increase',
  },
  down: {
    icon: <TrendDown />,
    color: 'var(--signal-danger)',
    label: 'Decrease',
  },
  neutral: {
    icon: <TrendNeutral />,
    color: 'var(--text-tertiary)',
    label: 'No change',
  },
} as const;

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

export function StatCard({
  label,
  value,
  currencySymbol,
  trend,
  trendValue,
  sparklineData,
  className,
}: StatCardProps) {
  const displayValue =
    typeof value === 'number' ? formatNumber(value, currencySymbol) : value;

  const trendInfo = trend ? trendConfig[trend] : undefined;

  return (
    <div
      className={className}
      style={{
        backgroundColor: 'var(--surface-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Label */}
      <p
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-body)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          margin: 0,
        }}
      >
        {label}
      </p>

      {/* Value row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.75rem' }}>
        <p
          style={{
            fontSize: 'clamp(1.25rem, 1.15rem + 0.5vw, 1.75rem)',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-primary)',
            fontWeight: 600,
            lineHeight: 1,
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          {displayValue}
        </p>

        {/* Sparkline */}
        {sparklineData && sparklineData.length >= 2 && (
          <div style={{ flexShrink: 0, alignSelf: 'center' }}>
            <Sparkline data={sparklineData} />
          </div>
        )}
      </div>

      {/* Trend */}
      {trendInfo && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          {trendInfo.icon}
          {trendValue !== undefined && (
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: trendInfo.color,
                fontFamily: 'var(--font-mono)',
                fontWeight: 500,
              }}
              aria-label={`${trendInfo.label}: ${Math.abs(trendValue).toFixed(1)}%`}
            >
              {trend === 'up' ? '+' : trend === 'down' ? '-' : ''}
              {Math.abs(trendValue).toFixed(1)}%
            </span>
          )}
          {!trendValue && (
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: trendInfo.color,
                fontFamily: 'var(--font-mono)',
              }}
              aria-label={trendInfo.label}
            >
              {trendInfo.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
