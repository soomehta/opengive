'use client';

import * as React from 'react';
import { Card, CardHeader, CardContent } from '@opengive/ui';
import { StatCard } from '@opengive/ui';
import { DataTable, type Column } from '@opengive/ui';
import { GeoMap, type MapMarker } from '@opengive/ui';

// ---------------------------------------------------------------------------
// Sample map markers — in production these come from tRPC geo.getMarkers
// ---------------------------------------------------------------------------

const SAMPLE_MARKERS: MapMarker[] = [
  { id: '1', name: 'American Red Cross', lat: 38.9, lng: -77.04, country: 'United States', score: 82, alertCount: 0 },
  { id: '2', name: 'Oxfam International', lat: 51.75, lng: -1.26, country: 'United Kingdom', score: 78, alertCount: 1 },
  { id: '3', name: 'Doctors Without Borders', lat: 46.2, lng: 6.15, country: 'Switzerland', score: 91, alertCount: 0 },
  { id: '4', name: 'UNICEF', lat: 40.75, lng: -73.97, country: 'United States', score: 88, alertCount: 0 },
  { id: '5', name: 'Save the Children', lat: 51.5, lng: -0.12, country: 'United Kingdom', score: 75, alertCount: 2 },
  { id: '6', name: 'World Vision', lat: -1.29, lng: 36.82, country: 'Kenya', score: 67, alertCount: 1 },
  { id: '7', name: 'CARE International', lat: 46.05, lng: 14.51, country: 'Switzerland', score: 80, alertCount: 0 },
  { id: '8', name: 'Habitat for Humanity', lat: 33.75, lng: -84.39, country: 'United States', score: 85, alertCount: 0 },
  { id: '9', name: 'Plan International', lat: 51.5, lng: -0.09, country: 'United Kingdom', score: 72, alertCount: 0 },
  { id: '10', name: 'ActionAid', lat: 28.61, lng: 77.23, country: 'India', score: 65, alertCount: 3 },
  { id: '11', name: 'Médecins du Monde', lat: 48.86, lng: 2.35, country: 'France', score: 79, alertCount: 0 },
  { id: '12', name: 'Caritas Australia', lat: -33.87, lng: 151.21, country: 'Australia', score: 83, alertCount: 0 },
  { id: '13', name: 'Canadian Red Cross', lat: 45.42, lng: -75.7, country: 'Canada', score: 86, alertCount: 0 },
  { id: '14', name: 'Aga Khan Foundation', lat: 46.2, lng: 6.14, country: 'Switzerland', score: 90, alertCount: 0 },
  { id: '15', name: 'BRAC', lat: 23.81, lng: 90.41, country: 'Bangladesh', score: 58, alertCount: 2 },
];

// ---------------------------------------------------------------------------
// Placeholder Sankey
// ---------------------------------------------------------------------------

function SankeyPlaceholder() {
  return (
    <div
      role="img"
      aria-label="Money flow diagram — loading"
      style={{
        width: '100%',
        height: '100%',
        minHeight: '200px',
        backgroundColor: 'var(--surface-overlay)',
        borderRadius: 'var(--radius-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      <svg width="120" height="60" viewBox="0 0 120 60" aria-hidden="true" style={{ opacity: 0.25 }}>
        <path d="M10 10 C40 10, 40 30, 70 30" stroke="#6A7E5A" strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d="M10 50 C40 50, 40 30, 70 30" stroke="#E8B86D" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M70 30 C100 30, 100 15, 115 15" stroke="#6BAF7B" strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d="M70 30 C100 30, 100 45, 115 45" stroke="#A88BC4" strokeWidth="6" fill="none" strokeLinecap="round" />
      </svg>
      <span
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-body)',
        }}
      >
        Flow Sankey — Sprint 4 integration
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alert types + feed
// ---------------------------------------------------------------------------

interface Alert {
  id: string;
  severity: 'high' | 'medium' | 'low';
  org: string;
  message: string;
  time: string;
}

const SEVERITY_COLORS: Record<Alert['severity'], string> = {
  high: 'var(--signal-danger)',
  medium: 'var(--signal-caution)',
  low: 'var(--signal-neutral)',
};

const MOCK_ALERTS: Alert[] = [
  { id: '1', severity: 'high', org: 'Global Health Fund', message: 'Expense ratio anomaly detected (+34% YoY)', time: '2m ago' },
  { id: '2', severity: 'high', org: "Children First Int'l", message: "Benford's Law deviation in Q3 filings", time: '18m ago' },
  { id: '3', severity: 'medium', org: 'Clean Water Now', message: 'Missing 990 filing for FY2023', time: '1h ago' },
  { id: '4', severity: 'medium', org: 'Education Alliance', message: 'Related-party transaction flagged', time: '3h ago' },
  { id: '5', severity: 'low', org: 'Arts & Culture Trust', message: 'Fundraising costs above sector average', time: '5h ago' },
];

function AlertFeed({ alerts }: { alerts: Alert[] }) {
  return (
    <ul role="list" style={{ display: 'flex', flexDirection: 'column', gap: 0, margin: 0, padding: 0, listStyle: 'none' }}>
      {alerts.map((alert) => (
        <li
          key={alert.id}
          style={{
            display: 'flex',
            gap: '0.75rem',
            padding: '0.625rem 0',
            borderBottom: '1px solid var(--border-subtle)',
            alignItems: 'flex-start',
          }}
        >
          <span
            aria-label={`${alert.severity} severity`}
            style={{
              flexShrink: 0,
              marginTop: '0.3rem',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: SEVERITY_COLORS[alert.severity],
              boxShadow: `0 0 6px ${SEVERITY_COLORS[alert.severity]}80`,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-body)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {alert.org}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-body)',
                lineHeight: 1.4,
                marginTop: '0.125rem',
              }}
            >
              {alert.message}
            </p>
          </div>
          <span
            style={{
              flexShrink: 0,
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-mono)',
              whiteSpace: 'nowrap',
            }}
          >
            {alert.time}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Recent activity table
// ---------------------------------------------------------------------------

interface ActivityRow {
  org: string;
  country: string;
  sector: string;
  revenue: string;
  score: number;
  updated: string;
  [key: string]: unknown;
}

const ACTIVITY_COLUMNS: Column<ActivityRow>[] = [
  { key: 'org', header: 'Organization', sortable: true },
  { key: 'country', header: 'Country', sortable: true },
  { key: 'sector', header: 'Sector', sortable: true },
  { key: 'revenue', header: 'Revenue', align: 'end', mono: true, sortable: true },
  {
    key: 'score',
    header: 'Score',
    align: 'end',
    mono: true,
    sortable: true,
    render: (row) => {
      const color =
        row.score >= 70
          ? 'var(--signal-healthy)'
          : row.score >= 40
            ? 'var(--signal-caution)'
            : 'var(--signal-danger)';
      return (
        <span style={{ color, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
          {row.score}
        </span>
      );
    },
  },
  { key: 'updated', header: 'Updated', align: 'end', mono: true, sortable: true },
];

const MOCK_ACTIVITY: ActivityRow[] = [
  { org: 'Doctors Without Borders', country: 'CH', sector: 'Health', revenue: '$2.1B', score: 88, updated: '2026-03-28' },
  { org: 'CARE International', country: 'US', sector: 'Human Services', revenue: '$745M', score: 82, updated: '2026-03-27' },
  { org: 'Oxfam International', country: 'GB', sector: 'International Aid', revenue: '$1.4B', score: 74, updated: '2026-03-26' },
  { org: 'WWF Global', country: 'CH', sector: 'Environment', revenue: '$398M', score: 79, updated: '2026-03-25' },
  { org: 'Save the Children', country: 'GB', sector: 'Human Services', revenue: '$2.3B', score: 85, updated: '2026-03-25' },
  { org: 'Habitat for Humanity', country: 'US', sector: 'Human Services', revenue: '$559M', score: 81, updated: '2026-03-24' },
  { org: 'Global Fund for Women', country: 'US', sector: 'Human Services', revenue: '$123M', score: 76, updated: '2026-03-24' },
  { org: "Transparency Int'l", country: 'DE', sector: 'Human Services', revenue: '$29M', score: 91, updated: '2026-03-23' },
];

// ---------------------------------------------------------------------------
// Stat data
// ---------------------------------------------------------------------------

const STATS = [
  {
    label: 'Total Organizations',
    value: 248_419,
    currencySymbol: undefined,
    trend: 'up' as const,
    trendValue: 3.2,
    sparklineData: [
      { value: 220000 }, { value: 228000 }, { value: 232000 }, { value: 237000 },
      { value: 240000 }, { value: 244000 }, { value: 248419 },
    ],
  },
  {
    label: 'Total Assets Tracked',
    value: 4_820_000_000,
    currencySymbol: '$',
    trend: 'up' as const,
    trendValue: 7.1,
    sparklineData: [
      { value: 4.1e9 }, { value: 4.3e9 }, { value: 4.5e9 }, { value: 4.6e9 },
      { value: 4.7e9 }, { value: 4.75e9 }, { value: 4.82e9 },
    ],
  },
  {
    label: 'Active Alerts',
    value: 143,
    currencySymbol: undefined,
    trend: 'down' as const,
    trendValue: 12.4,
    sparklineData: [
      { value: 180 }, { value: 172 }, { value: 165 }, { value: 158 },
      { value: 152 }, { value: 148 }, { value: 143 },
    ],
  },
  {
    label: 'Countries Covered',
    value: 47,
    currencySymbol: undefined,
    trend: 'up' as const,
    trendValue: 4.4,
    sparklineData: [
      { value: 38 }, { value: 40 }, { value: 42 }, { value: 43 },
      { value: 44 }, { value: 45 }, { value: 47 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CommandCenterPage() {
  return (
    <div
      role="main"
      aria-label="Command Center dashboard"
      style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* TOP ROW: Global Map (8 cols) + Alerts feed (4 cols)                 */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: '1rem',
        }}
      >
        {/* Global Map — wider */}
        <div style={{ gridColumn: 'span 2' }}>
          <Card style={{ minHeight: '300px' }}>
            <CardHeader
              actions={
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontFamily: 'var(--font-mono)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    color: 'var(--signal-healthy)',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--signal-healthy)',
                      display: 'inline-block',
                    }}
                    aria-hidden="true"
                  />
                  Live
                </span>
              }
            >
              Global Activity Map
            </CardHeader>
            <CardContent noPadding>
              <GeoMap
                markers={SAMPLE_MARKERS}
                height="300px"
                onMarkerClick={(m) => window.location.href = `/explore/${m.id}`}
              />
            </CardContent>
          </Card>
        </div>

        {/* Alerts feed */}
        <div>
          <Card style={{ height: '100%' }}>
            <CardHeader
              actions={
                <span
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    padding: '0.1rem 0.4rem',
                    backgroundColor: 'var(--signal-danger-subtle)',
                    color: 'var(--signal-danger)',
                    borderRadius: '9999px',
                  }}
                >
                  {MOCK_ALERTS.length}
                </span>
              }
            >
              Top Alerts
            </CardHeader>
            <CardContent style={{ overflowY: 'auto', maxHeight: '260px' }}>
              <AlertFeed alerts={MOCK_ALERTS} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* MIDDLE ROW: Flow Sankey (7 units) + Stats Grid (5 units)            */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
          gap: '1rem',
        }}
      >
        {/* Sankey — wider column */}
        <div style={{ gridColumn: 'span 2' }}>
          <Card style={{ minHeight: '260px' }}>
            <CardHeader>Money Flows</CardHeader>
            <CardContent className="p-3">
              <SankeyPlaceholder />
            </CardContent>
          </Card>
        </div>

        {/* Stats 2x2 grid */}
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
            }}
          >
            {STATS.map((stat) => (
              <StatCard
                key={stat.label}
                label={stat.label}
                value={stat.value}
                currencySymbol={stat.currencySymbol}
                trend={stat.trend}
                trendValue={stat.trendValue}
                sparklineData={stat.sparklineData}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* BOTTOM ROW: Recent Activity Table (full width)                      */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader
          actions={
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Updated 2m ago
            </span>
          }
        >
          Recent Activity
        </CardHeader>
        <CardContent noPadding>
          <DataTable
            columns={ACTIVITY_COLUMNS}
            data={MOCK_ACTIVITY}
            caption="Recent organization activity"
          />
        </CardContent>
      </Card>
    </div>
  );
}
