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
  '#6A7E5A', // --viz-1
  '#E8B86D', // --viz-2
  '#6BAF7B', // --viz-3
  '#D4736E', // --viz-4
  '#A88BC4', // --viz-5
  '#C4A5D4', // --viz-6
  '#7BA5AF', // --viz-7
  '#B88F6B', // --viz-8
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
      backgroundColor: '#FDFCF8',
      borderColor: '#DDD5CA',
      textStyle: {
        color: '#3A3A32',
        fontSize: 12,
        fontFamily: "'Nunito', system-ui, sans-serif",
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
          color: '#3A3A32',
          fontSize: 12,
          fontFamily: "'Nunito', system-ui, sans-serif",
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
