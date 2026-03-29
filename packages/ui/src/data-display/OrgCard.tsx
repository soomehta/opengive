import * as React from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrgCardProps {
  name: string;
  /** ISO 3166-1 alpha-2 country code, e.g. "US" */
  countryCode?: string;
  countryFlag?: string;
  sector?: string;
  latestRevenue?: number;
  currencySymbol?: string;
  /** 0–100 transparency/accountability score placeholder */
  score?: number;
  alertCount?: number;
  href?: string;
  onClick?: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRevenue(value: number, symbol = '$'): string {
  if (Math.abs(value) >= 1_000_000_000) {
    return `${symbol}${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (Math.abs(value) >= 1_000_000) {
    return `${symbol}${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${symbol}${(value / 1_000).toFixed(0)}K`;
  }
  return `${symbol}${value.toLocaleString()}`;
}

/** Country code to flag emoji */
function countryCodeToFlag(code: string): string {
  const upper = code.toUpperCase();
  const points = [...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...points);
}

/** Tiny arc gauge SVG — score 0..100 */
function ScoreGauge({ score }: { score: number }) {
  const radius = 14;
  const strokeWidth = 3;
  const cx = 18;
  const cy = 18;
  const circumference = Math.PI * radius; // half-circle
  const clampedScore = Math.min(100, Math.max(0, score));
  const dash = (clampedScore / 100) * circumference;
  const gap = circumference - dash;

  const color =
    clampedScore >= 70
      ? '#6BAF7B'
      : clampedScore >= 40
        ? '#E8B86D'
        : '#D4736E';

  return (
    <svg
      width={cx * 2}
      height={cx}
      viewBox={`0 0 ${cx * 2} ${cx}`}
      aria-hidden="true"
      style={{ overflow: 'visible' }}
    >
      {/* Track */}
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        stroke="#E8E2D9"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Value */}
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${gap}`}
        style={{ transition: 'stroke-dasharray 400ms ease' }}
      />
      {/* Score label */}
      <text
        x={cx}
        y={cy - 1}
        textAnchor="middle"
        fontSize="8"
        fontFamily="'IBM Plex Mono', monospace"
        fontWeight="600"
        fill={color}
      >
        {clampedScore}
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OrgCard({
  name,
  countryCode,
  countryFlag,
  sector,
  latestRevenue,
  currencySymbol = '$',
  score,
  alertCount = 0,
  href,
  onClick,
  className,
}: OrgCardProps) {
  const flag = countryFlag ?? (countryCode ? countryCodeToFlag(countryCode) : undefined);

  const sectorColors: Record<string, string> = {
    Health: '#6BAF7B',
    Education: '#6A7E5A',
    Environment: '#7BA5AF',
    'Human Services': '#E8B86D',
    'International Aid': '#A88BC4',
    Arts: '#C4A5D4',
    Religion: '#B88F6B',
    default: '#9A9A8E',
  };
  const sectorColor =
    sector ? (sectorColors[sector] ?? sectorColors['default']) : sectorColors['default'];

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--surface-raised)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '0.875rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.625rem',
    boxShadow: 'var(--shadow-sm)',
    cursor: href || onClick ? 'pointer' : 'default',
    transition: 'background-color var(--transition-fast), border-color var(--transition-fast)',
    textDecoration: 'none',
    color: 'inherit',
  };

  const innerContent = (
    <>
      {/* Top row: name + alert badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: 'var(--text-sm)',
            color: 'var(--text-primary)',
            lineHeight: 1.3,
            flex: 1,
            minWidth: 0,
          }}
        >
          {name}
        </p>
        {alertCount > 0 && (
          <span
            aria-label={`${alertCount} alert${alertCount !== 1 ? 's' : ''}`}
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '1.25rem',
              height: '1.25rem',
              padding: '0 0.3rem',
              borderRadius: '9999px',
              backgroundColor: 'var(--signal-danger-subtle)',
              color: 'var(--signal-danger)',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
            }}
          >
            {alertCount > 99 ? '99+' : alertCount}
          </span>
        )}
      </div>

      {/* Middle row: flag + sector badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        {flag && (
          <span
            aria-label={countryCode ?? 'Country flag'}
            style={{ fontSize: '1rem', lineHeight: 1 }}
          >
            {flag}
          </span>
        )}
        {sector && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.1rem 0.5rem',
              borderRadius: '9999px',
              fontSize: '10px',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              color: sectorColor,
              backgroundColor: `${sectorColor}1A`,
              border: `1px solid ${sectorColor}33`,
              whiteSpace: 'nowrap',
            }}
          >
            {sector}
          </span>
        )}
      </div>

      {/* Bottom row: revenue + gauge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          {latestRevenue !== undefined && (
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatRevenue(latestRevenue, currencySymbol)}
            </p>
          )}
          {latestRevenue === undefined && (
            <p
              style={{
                margin: 0,
                fontSize: 'var(--text-xs)',
                color: 'var(--text-tertiary)',
              }}
            >
              Revenue N/A
            </p>
          )}
        </div>
        {score !== undefined && (
          <div
            aria-label={`Accountability score: ${score}/100`}
            title={`Score: ${score}/100`}
          >
            <ScoreGauge score={score} />
          </div>
        )}
      </div>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className={className}
        style={cardStyle}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'var(--surface-elevated)';
          (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border-emphasis)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'var(--surface-raised)';
          (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border-subtle)';
        }}
      >
        {innerContent}
      </a>
    );
  }

  return (
    <div
      className={className}
      style={cardStyle}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      onMouseEnter={(e) => {
        if (onClick) {
          (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--surface-elevated)';
          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-emphasis)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--surface-raised)';
          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-subtle)';
        }
      }}
    >
      {innerContent}
    </div>
  );
}
