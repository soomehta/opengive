'use client';

import * as React from 'react';
import { Card, CardHeader, CardContent } from '@opengive/ui';
import { SankeyFlow } from '@opengive/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AggregationMode = 'organization' | 'country';

interface FilterState {
  country: string;
  year: string;
  sector: string;
  minAmount: number;
  aggregation: AggregationMode;
}

// ---------------------------------------------------------------------------
// Mock data helpers
// ---------------------------------------------------------------------------

const COUNTRIES = ['All Countries', 'United States', 'United Kingdom', 'Germany', 'Switzerland', 'France', 'Canada'];
const YEARS = ['2024', '2023', '2022', '2021', '2020'];
const SECTORS = ['All Sectors', 'Health', 'Education', 'Environment', 'Human Services', 'International Aid', 'Arts'];

function buildOrgFlowData(filters: FilterState) {
  const nodes = [
    { name: 'ProPublica DB' },
    { name: 'UK Charity Comm.' },
    { name: 'EU Foundations' },
    { name: 'Global Health Fund' },
    { name: 'Education Alliance' },
    { name: 'Clean Water Trust' },
    { name: 'Programs' },
    { name: 'Administration' },
    { name: 'Fundraising' },
  ];

  const multiplier = filters.minAmount > 0 ? Math.max(0.3, 1 - filters.minAmount / 2000000) : 1;

  const links = [
    { source: 'ProPublica DB', target: 'Global Health Fund', value: Math.round(8_200_000 * multiplier) },
    { source: 'ProPublica DB', target: 'Education Alliance', value: Math.round(5_100_000 * multiplier) },
    { source: 'UK Charity Comm.', target: 'Clean Water Trust', value: Math.round(3_400_000 * multiplier) },
    { source: 'EU Foundations', target: 'Global Health Fund', value: Math.round(4_500_000 * multiplier) },
    { source: 'EU Foundations', target: 'Education Alliance', value: Math.round(2_900_000 * multiplier) },
    { source: 'Global Health Fund', target: 'Programs', value: Math.round(9_800_000 * multiplier) },
    { source: 'Global Health Fund', target: 'Administration', value: Math.round(1_600_000 * multiplier) },
    { source: 'Education Alliance', target: 'Programs', value: Math.round(5_800_000 * multiplier) },
    { source: 'Education Alliance', target: 'Fundraising', value: Math.round(1_200_000 * multiplier) },
    { source: 'Clean Water Trust', target: 'Programs', value: Math.round(2_900_000 * multiplier) },
    { source: 'Clean Water Trust', target: 'Administration', value: Math.round(500_000 * multiplier) },
  ].filter((l) => l.value > filters.minAmount);

  return { nodes, links };
}

function buildCountryFlowData(filters: FilterState) {
  const nodes = [
    { name: 'United States' },
    { name: 'United Kingdom' },
    { name: 'Germany' },
    { name: 'Sub-Saharan Africa' },
    { name: 'South Asia' },
    { name: 'Latin America' },
    { name: 'East Asia' },
  ];

  const multiplier = filters.minAmount > 0 ? Math.max(0.3, 1 - filters.minAmount / 2000000) : 1;

  const links = [
    { source: 'United States', target: 'Sub-Saharan Africa', value: Math.round(42_000_000 * multiplier) },
    { source: 'United States', target: 'South Asia', value: Math.round(28_000_000 * multiplier) },
    { source: 'United States', target: 'Latin America', value: Math.round(18_000_000 * multiplier) },
    { source: 'United Kingdom', target: 'Sub-Saharan Africa', value: Math.round(22_000_000 * multiplier) },
    { source: 'United Kingdom', target: 'South Asia', value: Math.round(14_000_000 * multiplier) },
    { source: 'Germany', target: 'Sub-Saharan Africa', value: Math.round(11_000_000 * multiplier) },
    { source: 'Germany', target: 'East Asia', value: Math.round(8_000_000 * multiplier) },
  ].filter((l) => l.value > filters.minAmount);

  return { nodes, links };
}

function buildAriaLabel(data: ReturnType<typeof buildOrgFlowData>, mode: AggregationMode): string {
  const totalFlow = data.links.reduce((sum, l) => sum + l.value, 0);
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(totalFlow);
  return `Money flow ${mode === 'organization' ? 'by organization' : 'by country'}. ` +
    `${data.nodes.length} nodes, ${data.links.length} flows, ` +
    `total value ${formatted}.`;
}

// ---------------------------------------------------------------------------
// Filter controls
// ---------------------------------------------------------------------------

interface FilterControlsProps {
  filters: FilterState;
  onChange: (next: Partial<FilterState>) => void;
}

const selectStyle: React.CSSProperties = {
  backgroundColor: 'var(--surface-raised)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  fontSize: 'var(--text-xs)',
  fontFamily: 'var(--font-body)',
  padding: '0.375rem 0.625rem',
  outline: 'none',
  cursor: 'pointer',
  minWidth: '120px',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
};

const labelTextStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--text-tertiary)',
  fontFamily: 'var(--font-body)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

function FilterControls({ filters, onChange }: FilterControlsProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1rem',
        alignItems: 'flex-end',
      }}
    >
      {/* Country */}
      <label style={labelStyle}>
        <span style={labelTextStyle}>Country</span>
        <select
          value={filters.country}
          onChange={(e) => onChange({ country: e.target.value })}
          style={selectStyle}
          aria-label="Filter by country"
        >
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>

      {/* Year */}
      <label style={labelStyle}>
        <span style={labelTextStyle}>Year</span>
        <select
          value={filters.year}
          onChange={(e) => onChange({ year: e.target.value })}
          style={selectStyle}
          aria-label="Filter by year"
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </label>

      {/* Sector */}
      <label style={labelStyle}>
        <span style={labelTextStyle}>Sector</span>
        <select
          value={filters.sector}
          onChange={(e) => onChange({ sector: e.target.value })}
          style={selectStyle}
          aria-label="Filter by sector"
        >
          {SECTORS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>

      {/* Min Amount */}
      <label style={labelStyle}>
        <span style={labelTextStyle}>
          Min Amount: ${filters.minAmount.toLocaleString()}
        </span>
        <input
          type="range"
          min={0}
          max={2_000_000}
          step={50_000}
          value={filters.minAmount}
          onChange={(e) => onChange({ minAmount: Number(e.target.value) })}
          aria-label={`Minimum flow amount: $${filters.minAmount.toLocaleString()}`}
          style={{
            accentColor: 'var(--accent-trust)',
            width: '140px',
            cursor: 'pointer',
          }}
        />
      </label>

      {/* Aggregation toggle */}
      <div style={labelStyle}>
        <span style={labelTextStyle}>Group By</span>
        <div
          style={{
            display: 'flex',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
          }}
          role="group"
          aria-label="Aggregation mode"
        >
          {(['organization', 'country'] as AggregationMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onChange({ aggregation: mode })}
              aria-pressed={filters.aggregation === mode}
              style={{
                padding: '0.375rem 0.75rem',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-body)',
                backgroundColor:
                  filters.aggregation === mode
                    ? 'var(--accent-trust)'
                    : 'var(--surface-raised)',
                color:
                  filters.aggregation === mode
                    ? '#fff'
                    : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color var(--transition-fast), color var(--transition-fast)',
                textTransform: 'capitalize',
              }}
            >
              {mode === 'organization' ? 'By Org' : 'By Country'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Node detail panel
// ---------------------------------------------------------------------------

interface NodeDetailPanelProps {
  nodeName: string | null;
  onClose: () => void;
}

function NodeDetailPanel({ nodeName, onClose }: NodeDetailPanelProps) {
  if (!nodeName) return null;

  return (
    <div
      role="dialog"
      aria-label={`Details for ${nodeName}`}
      aria-modal="false"
      style={{
        position: 'absolute',
        top: '1rem',
        insetInlineEnd: '1rem',
        width: '240px',
        backgroundColor: 'var(--surface-overlay)',
        border: '1px solid var(--border-emphasis)',
        borderRadius: 'var(--radius-md)',
        padding: '0.875rem',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: 'var(--text-sm)',
            color: 'var(--text-primary)',
          }}
        >
          {nodeName}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close detail panel"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            padding: '0.125rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--text-xs)',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-body)',
          lineHeight: 1.5,
        }}
      >
        Drill-down for this node will be available once tRPC
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent-trust)' }}>
          {' '}trpc.flows.getFlowData
        </code>
        {' '}is wired in Sprint 4 Conduit tasks.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const INITIAL_FILTERS: FilterState = {
  country: 'All Countries',
  year: '2024',
  sector: 'All Sectors',
  minAmount: 0,
  aggregation: 'organization',
};

export default function FlowsPage() {
  const [filters, setFilters] = React.useState<FilterState>(INITIAL_FILTERS);
  const [selectedNode, setSelectedNode] = React.useState<string | null>(null);

  function updateFilters(next: Partial<FilterState>) {
    setFilters((prev) => ({ ...prev, ...next }));
    setSelectedNode(null);
  }

  const flowData =
    filters.aggregation === 'organization'
      ? buildOrgFlowData(filters)
      : buildCountryFlowData(filters);

  const ariaLabel = buildAriaLabel(flowData, filters.aggregation);

  return (
    <div
      role="main"
      aria-label="Flow Mapper"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        height: '100%',
      }}
    >
      {/* Header + filter bar */}
      <Card>
        <CardHeader>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>
            Flow Mapper
          </span>
        </CardHeader>
        <CardContent>
          <FilterControls filters={filters} onChange={updateFilters} />
        </CardContent>
      </Card>

      {/* Main chart area */}
      <Card style={{ flex: 1, minHeight: '480px', position: 'relative' }}>
        <CardHeader
          actions={
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {flowData.nodes.length} nodes · {flowData.links.length} flows · FY{filters.year}
            </span>
          }
        >
          {filters.aggregation === 'organization' ? 'By Organization' : 'By Country'}
        </CardHeader>
        <CardContent noPadding style={{ padding: '1rem', height: 'calc(100% - 45px)' }}>
          {flowData.links.length === 0 ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-tertiary)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
              }}
            >
              No flows match the current filters. Try lowering the minimum amount.
            </div>
          ) : (
            <SankeyFlow
              data={flowData}
              aria-label={ariaLabel}
              height="100%"
            />
          )}
        </CardContent>

        {/* Node drill-down panel */}
        <NodeDetailPanel
          nodeName={selectedNode}
          onClose={() => setSelectedNode(null)}
        />
      </Card>

      {/* Legend / help */}
      <Card>
        <CardContent style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-body)',
            }}
          >
            Click any node in the chart to drill into that entity. Use the filters above to narrow flows by geography, sector, or size.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {[
              { color: '#3B82F6', label: 'Data Sources' },
              { color: '#22C55E', label: 'Organizations' },
              { color: '#F59E0B', label: 'Expense Categories' },
              { color: '#8B5CF6', label: 'Regions' },
            ].map(({ color, label }) => (
              <span
                key={label}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '2px',
                    backgroundColor: color,
                    flexShrink: 0,
                  }}
                />
                {label}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
