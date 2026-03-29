'use client';

import * as React from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FinancialDataPoint {
  year: number | string;
  revenue: number;
  expenses: number;
}

interface FinancialTimelineProps {
  data: FinancialDataPoint[];
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

export function FinancialTimeline({
  data,
  currencySymbol = '$',
  'aria-label': ariaLabel,
  className,
  height = 320,
}: FinancialTimelineProps) {
  const hasData = data.length > 0;

  if (!hasData) {
    return (
      <div
        role="img"
        aria-label={ariaLabel ?? 'No financial data available'}
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
        No financial data available
      </div>
    );
  }

  const years = data.map((d) => String(d.year));
  const revenues = data.map((d) => d.revenue);
  const expenses = data.map((d) => d.expenses);

  const gridStyle = {
    lineStyle: { color: '#1F2533', width: 1 },
  };

  const axisLabelStyle = {
    color: '#636D82',
    fontSize: 11,
    fontFamily: "'IBM Plex Mono', 'Fira Code', monospace",
  };

  const option: EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1A1E27',
      borderColor: '#2C3240',
      textStyle: {
        color: '#E8ECF1',
        fontSize: 12,
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      },
      formatter: (params: unknown) => {
        const items = params as Array<{
          seriesName: string;
          value: number;
          color: string;
        }>;
        if (!Array.isArray(items) || items.length === 0) return '';
        const year = years[items[0] ? (data.findIndex((d) => String(d.year) === years[0]) ?? 0) : 0];
        const lines = items.map(
          (item) =>
            `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.color};margin-right:6px;"></span>` +
            `${item.seriesName}: <strong>${formatCurrency(item.value, currencySymbol)}</strong>`,
        );
        return `<div style="font-size:11px;">${lines.join('<br/>')}</div>`;
      },
    },
    legend: {
      data: ['Revenue', 'Expenses'],
      bottom: 0,
      textStyle: {
        color: '#9BA3B5',
        fontSize: 11,
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      },
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 4,
    },
    grid: {
      top: 16,
      right: 24,
      bottom: 40,
      left: 64,
      containLabel: false,
    },
    xAxis: {
      type: 'category',
      data: years,
      axisLine: { lineStyle: { color: '#1F2533' } },
      axisTick: { show: false },
      axisLabel: axisLabelStyle,
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        ...axisLabelStyle,
        formatter: (value: number) => formatCurrency(value, currencySymbol),
      },
      splitLine: gridStyle,
    },
    series: [
      {
        name: 'Revenue',
        type: 'line',
        data: revenues,
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: '#3B82F6', width: 2 }, // --accent-trust
        itemStyle: { color: '#3B82F6' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59,130,246,0.18)' },
              { offset: 1, color: 'rgba(59,130,246,0)' },
            ],
          },
        },
      },
      {
        name: 'Expenses',
        type: 'line',
        data: expenses,
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: '#F59E0B', width: 2 }, // --signal-caution
        itemStyle: { color: '#F59E0B' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(245,158,11,0.12)' },
              { offset: 1, color: 'rgba(245,158,11,0)' },
            ],
          },
        },
      },
    ],
  };

  const defaultAriaLabel = ariaLabel ?? (() => {
    const latest = data[data.length - 1];
    if (!latest) return 'Financial timeline chart';
    return (
      `Financial timeline from ${data[0]?.year} to ${latest.year}. ` +
      `Latest year: revenue ${formatCurrency(latest.revenue, currencySymbol)}, ` +
      `expenses ${formatCurrency(latest.expenses, currencySymbol)}.`
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
