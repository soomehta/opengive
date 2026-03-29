'use client';

import * as React from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExpenseDataPoint {
  year: number | string;
  program: number;
  admin: number;
  fundraising: number;
}

interface ExpenseBreakdownProps {
  data: ExpenseDataPoint[];
  currencySymbol?: string;
  /** Accessible text summary */
  'aria-label'?: string;
  className?: string;
  height?: number | string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number, symbol = '$'): string {
  if (Math.abs(value) >= 1_000_000_000) {
    return `${symbol}${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (Math.abs(value) >= 1_000_000) {
    return `${symbol}${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${symbol}${(value / 1_000).toFixed(1)}K`;
  }
  return `${symbol}${value.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExpenseBreakdown({
  data,
  currencySymbol = '$',
  'aria-label': ariaLabel,
  className,
  height = 280,
}: ExpenseBreakdownProps) {
  const hasData = data.length > 0;

  if (!hasData) {
    return (
      <div
        role="img"
        aria-label={ariaLabel ?? 'No expense data available'}
        className={className}
        style={{
          height: typeof height === 'number' ? `${height}px` : height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-tertiary)',
          fontSize: '0.875rem',
        }}
      >
        No expense data available
      </div>
    );
  }

  const years = data.map((d) => String(d.year));
  const axisLabelStyle = {
    color: '#9A9A8E',
    fontSize: 11,
    fontFamily: "'IBM Plex Mono', 'Fira Code', monospace",
  };

  const tooltipTextStyle = {
    color: '#3A3A32',
    fontSize: 12,
    fontFamily: "'Nunito', system-ui, sans-serif",
  };

  const option: EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#FDFCF8',
      borderColor: '#DDD5CA',
      textStyle: tooltipTextStyle,
    },
    legend: {
      data: ['Program', 'Admin', 'Fundraising'],
      bottom: 0,
      textStyle: {
        color: '#6B6B60',
        fontSize: 11,
        fontFamily: "'Nunito', system-ui, sans-serif",
      },
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 4,
    },
    grid: {
      top: 8,
      right: 16,
      bottom: 44,
      left: 48,
      containLabel: false,
    },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        ...axisLabelStyle,
        formatter: (value: number) => formatCurrency(value, currencySymbol),
      },
      splitLine: { lineStyle: { color: '#E8E2D9', width: 1 } },
    },
    yAxis: {
      type: 'category',
      data: years,
      axisLine: { lineStyle: { color: '#E8E2D9' } },
      axisTick: { show: false },
      axisLabel: axisLabelStyle,
      splitLine: { show: false },
    },
    series: [
      {
        name: 'Program',
        type: 'bar',
        stack: 'expenses',
        data: data.map((d) => d.program),
        itemStyle: { color: '#6BAF7B', borderRadius: [0, 0, 0, 0] }, // --signal-healthy
        barMaxWidth: 28,
      },
      {
        name: 'Admin',
        type: 'bar',
        stack: 'expenses',
        data: data.map((d) => d.admin),
        itemStyle: { color: '#E8B86D' }, // --signal-caution
        barMaxWidth: 28,
      },
      {
        name: 'Fundraising',
        type: 'bar',
        stack: 'expenses',
        data: data.map((d) => d.fundraising),
        itemStyle: { color: '#A88BC4', borderRadius: [0, 3, 3, 0] }, // --signal-neutral
        barMaxWidth: 28,
      },
    ],
  };

  const defaultAriaLabel = ariaLabel ?? (() => {
    const latest = data[data.length - 1];
    if (!latest) return 'Expense breakdown stacked bar chart';
    const total = latest.program + latest.admin + latest.fundraising;
    const programPct = total > 0 ? Math.round((latest.program / total) * 100) : 0;
    return (
      `Expense breakdown chart from ${data[0]?.year} to ${latest.year}. ` +
      `Latest year: ${programPct}% program expenses, ` +
      `${total > 0 ? Math.round((latest.admin / total) * 100) : 0}% admin, ` +
      `${total > 0 ? Math.round((latest.fundraising / total) * 100) : 0}% fundraising.`
    );
  })();

  return (
    <div
      role="img"
      aria-label={defaultAriaLabel}
      className={className}
      style={{ width: '100%' }}
    >
      <ReactECharts
        option={option}
        style={{
          height: typeof height === 'number' ? `${height}px` : height,
          width: '100%',
        }}
        opts={{ renderer: 'svg' }}
        notMerge
      />
    </div>
  );
}
