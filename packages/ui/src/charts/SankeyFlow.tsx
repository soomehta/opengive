'use client';

import * as React from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SankeyNode {
  name: string;
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

interface SankeyFlowProps {
  data: {
    nodes: SankeyNode[];
    links: SankeyLink[];
  };
  /** Accessible text summary describing the flows */
  'aria-label'?: string;
  className?: string;
  height?: number | string;
}

// ---------------------------------------------------------------------------
// Clarity viz palette — resolved at runtime to handle SSR safely
// ---------------------------------------------------------------------------

const VIZ_COLORS = [
  '#3B82F6', // --viz-1
  '#F59E0B', // --viz-2
  '#22C55E', // --viz-3
  '#EF4444', // --viz-4
  '#8B5CF6', // --viz-5
  '#EC4899', // --viz-6
  '#06B6D4', // --viz-7
  '#F97316', // --viz-8
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SankeyFlow({
  data,
  'aria-label': ariaLabel,
  className,
  height = 400,
}: SankeyFlowProps) {
  const hasData =
    data.nodes.length > 0 && data.links.length > 0;

  if (!hasData) {
    return (
      <div
        role="img"
        aria-label={ariaLabel ?? 'No flow data available'}
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
        No flow data available
      </div>
    );
  }

  const nodesWithColor: (SankeyNode & { itemStyle: { color: string } })[] =
    data.nodes.map((node, index) => ({
      ...node,
      itemStyle: {
        color: VIZ_COLORS[index % VIZ_COLORS.length],
      },
    }));

  const option: EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
      backgroundColor: '#1A1E27',
      borderColor: '#2C3240',
      textStyle: {
        color: '#E8ECF1',
        fontSize: 12,
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      },
    },
    series: [
      {
        type: 'sankey',
        data: nodesWithColor,
        links: data.links,
        emphasis: {
          focus: 'adjacency',
        },
        lineStyle: {
          color: 'gradient',
          opacity: 0.4,
          curveness: 0.5,
        },
        label: {
          color: '#E8ECF1',
          fontSize: 12,
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        },
        nodeGap: 12,
        nodeWidth: 18,
        left: '5%',
        right: '5%',
        top: '5%',
        bottom: '5%',
      },
    ],
  };

  return (
    <div
      role="img"
      aria-label={ariaLabel ?? `Sankey flow diagram with ${data.nodes.length} nodes and ${data.links.length} connections`}
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
