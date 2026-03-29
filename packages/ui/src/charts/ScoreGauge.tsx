'use client';

import * as React from 'react';
import { cn } from '../lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoreBreakdownLabel {
  label: string;
  value: number;
  /** Angle in degrees (0 = top, clockwise). Auto-positioned if omitted. */
  angle?: number;
}

export interface ScoreGaugeProps {
  /** 0-100 score */
  score: number;
  /** Label displayed below the center number */
  label?: string;
  /** Optional breakdown labels arranged around the arc */
  breakdown?: ScoreBreakdownLabel[];
  className?: string;
  size?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number): { stroke: string; text: string } {
  if (score >= 70) return { stroke: '#22C55E', text: '#22C55E' }; // --signal-healthy
  if (score >= 40) return { stroke: '#F59E0B', text: '#F59E0B' }; // --signal-caution
  return { stroke: '#EF4444', text: '#EF4444' };                   // --signal-danger
}

function scoreLabel(score: number): string {
  if (score >= 70) return 'Healthy';
  if (score >= 40) return 'Caution';
  return 'Danger';
}

// Convert polar coords (angle in degrees from top, clockwise) to SVG x/y
function polarToCart(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Build an SVG arc path string for a donut slice
function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = polarToCart(cx, cy, r, startDeg);
  const end = polarToCart(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScoreGauge({
  score,
  label = 'Accountability Score',
  breakdown,
  className,
  size = 200,
}: ScoreGaugeProps) {
  const safeScore = Math.min(100, Math.max(0, score));
  const colors = scoreColor(safeScore);

  // Gauge arc goes from -135deg to +135deg (270 deg sweep), centred at bottom
  const START_DEG = -135;
  const END_DEG = 135;
  const SWEEP = END_DEG - START_DEG; // 270

  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.38;
  const STROKE_W = size * 0.075;

  // Track arc (background)
  const trackPath = describeArc(cx, cy, R, START_DEG, END_DEG);

  // Fill arc
  const fillEndDeg = START_DEG + (safeScore / 100) * SWEEP;
  const fillPath = describeArc(cx, cy, R, START_DEG, fillEndDeg);

  // Needle tip position
  const needlePt = polarToCart(cx, cy, R, fillEndDeg);

  const ariaText = `${label}: ${safeScore} out of 100. Status: ${scoreLabel(safeScore)}.`;

  return (
    <div
      className={cn('inline-flex flex-col items-center', className)}
      role="img"
      aria-label={ariaText}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        style={{ overflow: 'visible' }}
      >
        {/* Background track */}
        <path
          d={trackPath}
          fill="none"
          stroke="var(--surface-elevated)"
          strokeWidth={STROKE_W}
          strokeLinecap="round"
        />

        {/* Danger zone tint (0-40) */}
        <path
          d={describeArc(cx, cy, R, START_DEG, START_DEG + (40 / 100) * SWEEP)}
          fill="none"
          stroke="#EF4444"
          strokeWidth={STROKE_W}
          strokeOpacity={0.12}
          strokeLinecap="round"
        />

        {/* Caution zone tint (40-70) */}
        <path
          d={describeArc(cx, cy, R, START_DEG + (40 / 100) * SWEEP, START_DEG + (70 / 100) * SWEEP)}
          fill="none"
          stroke="#F59E0B"
          strokeWidth={STROKE_W}
          strokeOpacity={0.12}
          strokeLinecap="round"
        />

        {/* Healthy zone tint (70-100) */}
        <path
          d={describeArc(cx, cy, R, START_DEG + (70 / 100) * SWEEP, END_DEG)}
          fill="none"
          stroke="#22C55E"
          strokeWidth={STROKE_W}
          strokeOpacity={0.12}
          strokeLinecap="round"
        />

        {/* Filled arc */}
        {safeScore > 0 && (
          <path
            d={fillPath}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={STROKE_W}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        )}

        {/* Needle dot at arc tip */}
        <circle cx={needlePt.x} cy={needlePt.y} r={STROKE_W * 0.6} fill={colors.stroke} />

        {/* Zone tick marks */}
        {[40, 70].map((tick) => {
          const tickDeg = START_DEG + (tick / 100) * SWEEP;
          const inner = polarToCart(cx, cy, R - STROKE_W / 2 - 2, tickDeg);
          const outer = polarToCart(cx, cy, R + STROKE_W / 2 + 2, tickDeg);
          return (
            <line
              key={tick}
              x1={inner.x} y1={inner.y}
              x2={outer.x} y2={outer.y}
              stroke="var(--border-emphasis)"
              strokeWidth={1.5}
            />
          );
        })}

        {/* Zone labels */}
        {([
          { deg: START_DEG + (20 / 100) * SWEEP, text: 'Danger', color: '#EF4444' },
          { deg: START_DEG + (55 / 100) * SWEEP, text: 'Caution', color: '#F59E0B' },
          { deg: START_DEG + (85 / 100) * SWEEP, text: 'Healthy', color: '#22C55E' },
        ] as const).map(({ deg, text, color }) => {
          const pt = polarToCart(cx, cy, R + STROKE_W * 1.4, deg);
          return (
            <text
              key={text}
              x={pt.x}
              y={pt.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill={color}
              fontSize={size * 0.055}
              fontFamily="'IBM Plex Sans', system-ui, sans-serif"
              fontWeight="500"
              opacity={0.8}
            >
              {text}
            </text>
          );
        })}

        {/* Center score number */}
        <text
          x={cx}
          y={cy - size * 0.02}
          textAnchor="middle"
          dominantBaseline="central"
          fill={colors.text}
          fontSize={size * 0.22}
          fontFamily="'IBM Plex Mono', 'Fira Code', monospace"
          fontWeight="700"
        >
          {safeScore}
        </text>

        {/* /100 sub-text */}
        <text
          x={cx}
          y={cy + size * 0.13}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--text-tertiary)"
          fontSize={size * 0.07}
          fontFamily="'IBM Plex Mono', 'Fira Code', monospace"
        >
          /100
        </text>

        {/* Breakdown labels */}
        {breakdown?.map((b, i) => {
          const totalBreakdown = breakdown.length;
          const autoDeg = START_DEG + ((i + 0.5) / totalBreakdown) * SWEEP;
          const deg = b.angle ?? autoDeg;
          const pt = polarToCart(cx, cy, R - STROKE_W * 2, deg);
          return (
            <g key={b.label}>
              <text
                x={pt.x}
                y={pt.y - 6}
                textAnchor="middle"
                fill="var(--text-tertiary)"
                fontSize={size * 0.05}
                fontFamily="'IBM Plex Sans', system-ui, sans-serif"
              >
                {b.value}
              </text>
              <text
                x={pt.x}
                y={pt.y + 6}
                textAnchor="middle"
                fill="var(--text-tertiary)"
                fontSize={size * 0.045}
                fontFamily="'IBM Plex Sans', system-ui, sans-serif"
              >
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Label below */}
      {label && (
        <p
          className="mt-1 text-xs font-medium text-[var(--text-secondary)] text-center"
          style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}
        >
          {label}
        </p>
      )}
    </div>
  );
}
