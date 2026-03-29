'use client';

import * as React from 'react';
import { cn } from '../lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RatioGaugeProps {
  /** 0-100 current value (percentage) */
  value: number;
  /** Human-readable label */
  label: string;
  /** Optional sub-label / description */
  description?: string;
  /** Start of the "good/benchmark" zone (0-100) */
  benchmarkMin?: number;
  /** End of the "good/benchmark" zone (0-100) */
  benchmarkMax?: number;
  /** Label for the benchmark zone */
  benchmarkLabel?: string;
  /** Whether higher = better (default true; false for e.g. overhead ratio) */
  higherIsBetter?: boolean;
  className?: string;
  /** Bar height in px */
  barHeight?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val));
}

function valueColor(value: number, benchmarkMin?: number, benchmarkMax?: number, higherIsBetter = true): string {
  if (benchmarkMin !== undefined && benchmarkMax !== undefined) {
    if (value >= benchmarkMin && value <= benchmarkMax) return '#22C55E'; // in benchmark
    const distMin = benchmarkMin - value;
    const distMax = value - benchmarkMax;
    const dist = Math.max(distMin, distMax);
    if (dist < 10) return '#F59E0B';
    return higherIsBetter
      ? value < benchmarkMin ? '#EF4444' : '#22C55E'
      : '#EF4444';
  }
  // No benchmark: color by value
  if (value >= 70) return '#22C55E';
  if (value >= 40) return '#F59E0B';
  return '#EF4444';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RatioGauge({
  value,
  label,
  description,
  benchmarkMin,
  benchmarkMax,
  benchmarkLabel,
  higherIsBetter = true,
  className,
  barHeight = 12,
}: RatioGaugeProps) {
  const safeValue = clamp(value, 0, 100);
  const color = valueColor(safeValue, benchmarkMin, benchmarkMax, higherIsBetter);

  const ariaText = [
    `${label}: ${safeValue}%.`,
    benchmarkMin !== undefined && benchmarkMax !== undefined
      ? `Benchmark range: ${benchmarkMin}%-${benchmarkMax}%.`
      : '',
    description ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cn('w-full', className)} role="img" aria-label={ariaText}>
      {/* Header */}
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <div className="min-w-0">
          <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
          {description && (
            <span className="ms-2 text-xs text-[var(--text-tertiary)]">{description}</span>
          )}
        </div>
        <span
          className="text-sm font-semibold font-mono shrink-0"
          style={{ color, fontFamily: "'IBM Plex Mono', 'Fira Code', monospace" }}
        >
          {safeValue.toFixed(1)}%
        </span>
      </div>

      {/* Bar track */}
      <div
        className="relative w-full rounded-full overflow-visible"
        style={{ height: barHeight, backgroundColor: 'var(--surface-elevated)' }}
        aria-hidden="true"
      >
        {/* Benchmark zone highlight */}
        {benchmarkMin !== undefined && benchmarkMax !== undefined && (
          <div
            className="absolute top-0 rounded-full"
            style={{
              left: `${benchmarkMin}%`,
              width: `${benchmarkMax - benchmarkMin}%`,
              height: '100%',
              backgroundColor: '#22C55E',
              opacity: 0.18,
            }}
          />
        )}

        {/* Benchmark zone border lines */}
        {benchmarkMin !== undefined && (
          <div
            className="absolute top-0 bottom-0 w-px"
            style={{ left: `${benchmarkMin}%`, backgroundColor: '#22C55E', opacity: 0.5 }}
          />
        )}
        {benchmarkMax !== undefined && (
          <div
            className="absolute top-0 bottom-0 w-px"
            style={{ left: `${benchmarkMax}%`, backgroundColor: '#22C55E', opacity: 0.5 }}
          />
        )}

        {/* Fill bar */}
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
          style={{
            width: `${safeValue}%`,
            backgroundColor: color,
            opacity: 0.85,
          }}
        />

        {/* Value marker (vertical line + dot) */}
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{ left: `${safeValue}%`, transform: 'translate(-50%, -50%)' }}
        >
          <div
            className="rounded-full border-2 border-[var(--surface-base)]"
            style={{
              width: barHeight + 4,
              height: barHeight + 4,
              backgroundColor: color,
              boxShadow: `0 0 0 2px ${color}33`,
            }}
          />
        </div>
      </div>

      {/* Benchmark label + scale */}
      <div className="flex items-center justify-between mt-1.5 text-[10px] text-[var(--text-tertiary)]">
        <span>0%</span>
        {benchmarkMin !== undefined && benchmarkMax !== undefined && (
          <span
            className="flex items-center gap-1"
            style={{ position: 'relative', left: `${(benchmarkMin + benchmarkMax) / 2 - 50}%` }}
          >
            <span
              className="inline-block w-2 h-2 rounded-sm"
              style={{ backgroundColor: '#22C55E', opacity: 0.5 }}
            />
            {benchmarkLabel ?? `${benchmarkMin}–${benchmarkMax}% benchmark`}
          </span>
        )}
        <span>100%</span>
      </div>
    </div>
  );
}
