'use client';

import * as React from 'react';
import Link from 'next/link';
import { type Route } from 'next';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  NetworkGraph,
  cn,
  type NetworkNode,
  type NetworkEdge,
} from '@opengive/ui';
import { useInvestigationStore } from '../../../lib/stores/investigation';
import { trpc } from '../../../lib/trpc';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrgResult {
  id: string;
  name: string;
  slug: string;
  country: string;
  sector: string;
  latestRevenue: number;
  score: number;
}

interface CanvasOrg extends OrgResult {
  addedAt: number;
}

interface TimelineEvent {
  id: string;
  orgId: string;
  orgName: string;
  date: string;
  type: 'filing' | 'alert' | 'director_change' | 'grant';
  description: string;
}

// ---------------------------------------------------------------------------
// Placeholder data — replace with tRPC in Sprint 7
// ---------------------------------------------------------------------------

const ALL_ORGS: OrgResult[] = [
  { id: '1', name: 'American Red Cross', slug: 'american-red-cross', country: 'United States', sector: 'Humanitarian', latestRevenue: 2_900_000_000, score: 72 },
  { id: '2', name: 'Doctors Without Borders', slug: 'doctors-without-borders', country: 'Switzerland', sector: 'Healthcare', latestRevenue: 1_600_000_000, score: 88 },
  { id: '3', name: 'Oxfam International', slug: 'oxfam-international', country: 'United Kingdom', sector: 'Poverty Relief', latestRevenue: 450_000_000, score: 55 },
  { id: '4', name: 'Save the Children', slug: 'save-the-children', country: 'United Kingdom', sector: 'Children', latestRevenue: 1_100_000_000, score: 81 },
  { id: '5', name: 'World Wildlife Fund', slug: 'world-wildlife-fund', country: 'Switzerland', sector: 'Environment', latestRevenue: 310_000_000, score: 78 },
  { id: '6', name: 'UNICEF USA', slug: 'unicef-usa', country: 'United States', sector: 'Children', latestRevenue: 700_000_000, score: 91 },
  { id: '7', name: 'Gates Foundation', slug: 'gates-foundation', country: 'United States', sector: 'Global Health', latestRevenue: 6_000_000_000, score: 94 },
  { id: '8', name: 'Habitat for Humanity', slug: 'habitat-for-humanity', country: 'United States', sector: 'Housing', latestRevenue: 1_800_000_000, score: 76 },
  { id: '9', name: 'Cancer Research UK', slug: 'cancer-research-uk', country: 'United Kingdom', sector: 'Medical Research', latestRevenue: 680_000_000, score: 83 },
  { id: '10', name: 'Caritas Germany', slug: 'caritas-germany', country: 'Germany', sector: 'Social Services', latestRevenue: 4_200_000_000, score: 68 },
];

function buildMockEdges(orgIds: string[]): NetworkEdge[] {
  if (orgIds.length < 2) return [];
  const edges: NetworkEdge[] = [];
  // Create a connected chain with some cross-links for demo
  for (let i = 0; i < orgIds.length - 1; i++) {
    edges.push({
      source: orgIds[i]!,
      target: orgIds[i + 1]!,
      type: i % 3 === 0 ? 'shared_director' : i % 3 === 1 ? 'grant' : 'shared_address',
      strength: 0.3 + Math.random() * 0.7,
    });
  }
  if (orgIds.length >= 3) {
    edges.push({
      source: orgIds[0]!,
      target: orgIds[orgIds.length - 1]!,
      type: 'related',
      strength: 0.4,
    });
  }
  return edges;
}

function buildMockTimeline(orgs: CanvasOrg[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const types: TimelineEvent['type'][] = ['filing', 'alert', 'director_change', 'grant'];
  orgs.forEach((org, i) => {
    const year = 2024 - i;
    types.forEach((type, j) => {
      events.push({
        id: `${org.id}-${type}`,
        orgId: org.id,
        orgName: org.name,
        date: `${year}-${String(j + 1).padStart(2, '0')}-15`,
        type,
        description: `${type.replace('_', ' ')} event for ${org.name}`,
      });
    });
  });
  return events.sort((a, b) => b.date.localeCompare(a.date));
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function IconSearch() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.75" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconX() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconSave() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="17 21 17 13 7 13 7 21" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="7 3 7 8 15 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTimeline() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3 12h6M15 12h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconNetwork() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="5" r="2" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="5" cy="19" r="2" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="19" cy="19" r="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 7v4M12 11l-5 6M12 11l5 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function formatRevenue(amount: number): string {
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(0)}M`;
  return `$${amount}`;
}

function timelineEventColor(type: TimelineEvent['type']): string {
  switch (type) {
    case 'alert': return '#EF4444';
    case 'filing': return '#3B82F6';
    case 'director_change': return '#8B5CF6';
    case 'grant': return '#22C55E';
    default: return '#6B7280';
  }
}

function timelineEventLabel(type: TimelineEvent['type']): string {
  switch (type) {
    case 'alert': return 'Alert';
    case 'filing': return 'Filing';
    case 'director_change': return 'Director Change';
    case 'grant': return 'Grant';
    default: return 'Event';
  }
}

// ---------------------------------------------------------------------------
// Entity detail panel
// ---------------------------------------------------------------------------

interface DetailPanelProps {
  org: CanvasOrg;
  allOrgs: CanvasOrg[];
}

function DetailPanel({ org, allOrgs }: DetailPanelProps) {
  // Mock shared directors between org and others in canvas
  const sharedDirectors = allOrgs
    .filter((o) => o.id !== org.id)
    .slice(0, 2)
    .map((o) => ({ name: `Director A (${o.name})`, org: o.name }));

  return (
    <div className="flex flex-col gap-4 overflow-y-auto h-full">
      {/* Org header */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{org.name}</h3>
        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{org.country} · {org.sector}</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md bg-[var(--surface-elevated)] p-2.5">
          <p className="text-[10px] text-[var(--text-tertiary)] mb-0.5">Revenue</p>
          <p className="text-sm font-semibold font-mono text-[var(--text-primary)]">{formatRevenue(org.latestRevenue)}</p>
        </div>
        <div className="rounded-md bg-[var(--surface-elevated)] p-2.5">
          <p className="text-[10px] text-[var(--text-tertiary)] mb-0.5">Score</p>
          <p
            className="text-sm font-semibold font-mono"
            style={{ color: org.score >= 70 ? '#22C55E' : org.score >= 40 ? '#F59E0B' : '#EF4444' }}
          >
            {org.score}/100
          </p>
        </div>
      </div>

      {/* Shared directors */}
      {sharedDirectors.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-2">Shared Directors</h4>
          <div className="flex flex-col gap-1.5">
            {sharedDirectors.map((d) => (
              <div key={d.name} className="text-xs text-[var(--text-tertiary)] flex items-start gap-1.5">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-[#8B5CF6] shrink-0" aria-hidden="true" />
                <span>{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grants between orgs */}
      {allOrgs.length > 1 && (
        <div>
          <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-2">Grants Received (mock)</h4>
          <div className="flex flex-col gap-1.5">
            {allOrgs.filter((o) => o.id !== org.id).slice(0, 2).map((grantOrg) => (
              <div key={grantOrg.id} className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-tertiary)] truncate max-w-[120px]">{grantOrg.name}</span>
                <span className="text-[var(--signal-healthy)] font-mono">$2.4M</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Link to org detail */}
      <div className="mt-auto">
        <Link
          href={`/explore/${org.slug}` as Route}
          className="text-xs text-[var(--accent-trust)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] rounded-sm"
        >
          View full profile
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function InvestigatePage() {
  const store = useInvestigationStore();
  const trpcUtils = trpc.useUtils();

  // tRPC mutations
  const createMutation = trpc.investigations.create.useMutation();
  const updateMutation = trpc.investigations.update.useMutation();

  // Canvas state
  const [canvasOrgs, setCanvasOrgs] = React.useState<CanvasOrg[]>([]);
  const [selectedOrgId, setSelectedOrgId] = React.useState<string | null>(null);
  const [view, setView] = React.useState<'network' | 'timeline'>('network');

  // Search state (left panel)
  const [searchQuery, setSearchQuery] = React.useState('');

  // Save/load UI state
  const [loadId, setLoadId] = React.useState('');
  const [showLoadInput, setShowLoadInput] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isLoadingInv, setIsLoadingInv] = React.useState(false);

  // Filtered search results
  const searchResults = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ALL_ORGS.slice(0, 8);
    return ALL_ORGS.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.country.toLowerCase().includes(q) ||
        o.sector.toLowerCase().includes(q),
    ).slice(0, 8);
  }, [searchQuery]);

  // Build network data from canvas orgs
  const networkNodes: NetworkNode[] = canvasOrgs.map((o) => ({
    id: o.id,
    label: o.name,
    country: o.country,
    revenue: o.latestRevenue,
    score: o.score,
    type: 'organization',
  }));
  const networkEdges = buildMockEdges(canvasOrgs.map((o) => o.id));

  // Timeline events
  const timelineEvents = buildMockTimeline(canvasOrgs);

  // Selected org detail
  const selectedOrg = canvasOrgs.find((o) => o.id === selectedOrgId) ?? null;

  function handleAddOrg(org: OrgResult) {
    if (canvasOrgs.some((o) => o.id === org.id)) return;
    const canvasOrg: CanvasOrg = { ...org, addedAt: Date.now() };
    setCanvasOrgs((prev) => [...prev, canvasOrg]);
    store.addOrganization(org.id);
    setSelectedOrgId(org.id);
  }

  function handleRemoveOrg(id: string) {
    setCanvasOrgs((prev) => prev.filter((o) => o.id !== id));
    store.removeOrganization(id);
    if (selectedOrgId === id) setSelectedOrgId(null);
  }

  async function handleSave() {
    setSaveSuccess(false);
    const payload = {
      title: store.title,
      organizationIds: store.organizationIds,
      queryState: store.queryState,
      isPublic: store.isPublic,
    };
    try {
      if (store.id) {
        await updateMutation.mutateAsync({ ...payload, id: store.id });
      } else {
        const record = await createMutation.mutateAsync(payload);
        store.setSavedId(record.id);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // mutation error is surfaced via createMutation.error / updateMutation.error
    }
  }

  async function handleLoad() {
    if (!loadId.trim()) return;
    setIsLoadingInv(true);
    setLoadError(null);
    try {
      const record = await trpcUtils.investigations.getById.fetch({ id: loadId.trim() });
      store.hydrate(record);
      // Hydrate canvas from loaded org ids
      const loaded = record.organizationIds
        .map((id) => ALL_ORGS.find((o) => o.id === id))
        .filter((o): o is OrgResult => !!o)
        .map((o): CanvasOrg => ({ ...o, addedAt: Date.now() }));
      setCanvasOrgs(loaded);
      setShowLoadInput(false);
      setLoadId('');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load investigation');
    } finally {
      setIsLoadingInv(false);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-h-[900px]">
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Title */}
        <input
          type="text"
          value={store.title}
          onChange={(e) => store.setTitle(e.target.value)}
          className="flex-1 min-w-[200px] h-9 px-3 rounded-md border border-[var(--border-default)] bg-[var(--surface-raised)] text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]"
          placeholder="Investigation title"
          aria-label="Investigation title"
        />

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-md border border-[var(--border-default)] p-0.5" role="group" aria-label="Canvas view">
          <button
            type="button"
            onClick={() => setView('network')}
            aria-pressed={view === 'network'}
            className={cn(
              'flex items-center gap-1.5 h-7 px-2.5 rounded text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]',
              view === 'network'
                ? 'bg-[var(--accent-trust-subtle)] text-[var(--accent-trust)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
            )}
          >
            <IconNetwork />
            Network
          </button>
          <button
            type="button"
            onClick={() => setView('timeline')}
            aria-pressed={view === 'timeline'}
            className={cn(
              'flex items-center gap-1.5 h-7 px-2.5 rounded text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]',
              view === 'timeline'
                ? 'bg-[var(--accent-trust-subtle)] text-[var(--accent-trust)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
            )}
          >
            <IconTimeline />
            Timeline
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Save */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSave}
            isLoading={isSaving}
            disabled={canvasOrgs.length === 0}
          >
            <IconSave />
            <span className="ms-1.5">{saveSuccess ? 'Saved!' : 'Save'}</span>
          </Button>

          {/* Load */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowLoadInput((v) => !v)}
          >
            Load
          </Button>

          {/* Export (placeholder) */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => alert('Export report — coming in Sprint 7')}
            disabled={canvasOrgs.length === 0}
          >
            <IconDownload />
            <span className="ms-1.5">Export Report</span>
          </Button>
        </div>
      </div>

      {/* Load input */}
      {showLoadInput && (
        <div className="flex items-center gap-2 mb-3 p-3 rounded-md border border-[var(--border-default)] bg-[var(--surface-raised)]">
          <input
            type="text"
            value={loadId}
            onChange={(e) => setLoadId(e.target.value)}
            placeholder="Paste investigation ID"
            className="flex-1 h-8 px-3 rounded border border-[var(--border-default)] bg-[var(--surface-elevated)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]"
            aria-label="Investigation ID to load"
          />
          <Button size="sm" onClick={handleLoad} isLoading={isLoadingInv}>Load</Button>
          <Button variant="ghost" size="sm" onClick={() => setShowLoadInput(false)}>Cancel</Button>
          {loadError && <p className="text-xs text-[var(--signal-danger)]">{loadError}</p>}
        </div>
      )}

      {/* Three-panel layout */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left panel: Search to add orgs */}
        <aside className="w-64 shrink-0 flex flex-col gap-3 overflow-y-auto">
          <Card noOverflowClip className="flex-1 flex flex-col min-h-0">
            <CardHeader>
              <h2 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wide">
                Add Organizations
              </h2>
            </CardHeader>
            <CardContent className="p-3 flex-1 flex flex-col min-h-0">
              {/* Search */}
              <div className="relative mb-3">
                <span className="absolute start-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
                  <IconSearch />
                </span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search organizations"
                  aria-label="Search organizations to add"
                  className="w-full h-8 ps-8 pe-3 rounded-md text-xs border border-[var(--border-default)] bg-[var(--surface-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]"
                />
              </div>

              {/* Results list */}
              <ul className="flex flex-col gap-1 overflow-y-auto flex-1" role="list" aria-label="Search results">
                {searchResults.map((org) => {
                  const isAdded = canvasOrgs.some((o) => o.id === org.id);
                  return (
                    <li key={org.id}>
                      <button
                        type="button"
                        onClick={() => handleAddOrg(org)}
                        disabled={isAdded}
                        className={cn(
                          'w-full flex items-center gap-2 text-start px-2 py-1.5 rounded-md text-xs transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]',
                          isAdded
                            ? 'text-[var(--text-tertiary)] cursor-default'
                            : 'hover:bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                        )}
                        aria-label={isAdded ? `${org.name} already on canvas` : `Add ${org.name} to canvas`}
                      >
                        <span className={cn('w-5 h-5 rounded shrink-0 flex items-center justify-center', isAdded ? 'text-[var(--text-tertiary)]' : 'text-[var(--accent-trust)]')}>
                          {isAdded ? (
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <IconPlus />
                          )}
                        </span>
                        <span className="truncate">{org.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          {/* Canvas org list */}
          {canvasOrgs.length > 0 && (
            <Card noOverflowClip>
              <CardHeader>
                <h2 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wide">
                  On Canvas ({canvasOrgs.length})
                </h2>
              </CardHeader>
              <CardContent className="p-2">
                <ul className="flex flex-col gap-1" role="list">
                  {canvasOrgs.map((org) => (
                    <li key={org.id}>
                      <div
                        className={cn(
                          'flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-xs',
                          selectedOrgId === org.id
                            ? 'bg-[var(--accent-trust-subtle)] text-[var(--accent-trust)]'
                            : 'hover:bg-[var(--surface-elevated)] text-[var(--text-secondary)]',
                        )}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedOrgId(org.id === selectedOrgId ? null : org.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedOrgId(org.id === selectedOrgId ? null : org.id);
                          }
                        }}
                        aria-pressed={selectedOrgId === org.id}
                        aria-label={`Select ${org.name}`}
                      >
                        <span className="flex-1 truncate">{org.name}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleRemoveOrg(org.id); }}
                          className="p-0.5 rounded text-[var(--text-tertiary)] hover:text-[var(--signal-danger)] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--signal-danger)]"
                          aria-label={`Remove ${org.name} from canvas`}
                        >
                          <IconX />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </aside>

        {/* Main canvas */}
        <main className="flex-1 min-w-0 flex flex-col">
          {canvasOrgs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center rounded-md border-2 border-dashed border-[var(--border-subtle)]">
              <div className="text-[var(--text-tertiary)] mb-2" aria-hidden="true">
                <IconNetwork />
              </div>
              <p className="text-sm text-[var(--text-secondary)] font-medium mb-1">Canvas is empty</p>
              <p className="text-xs text-[var(--text-tertiary)] max-w-[220px]">
                Search and add organizations from the left panel to begin building your investigation.
              </p>
            </div>
          ) : view === 'network' ? (
            <NetworkGraph
              nodes={networkNodes}
              edges={networkEdges}
              selectedNodeId={selectedOrgId}
              onNodeClick={(node) => setSelectedOrgId(node.id === selectedOrgId ? null : node.id)}
              colorBy="country"
              className="flex-1 min-h-0"
            />
          ) : (
            /* Timeline view */
            <Card noOverflowClip className="flex-1 flex flex-col min-h-0">
              <CardHeader>
                <h2 className="text-sm font-medium text-[var(--text-primary)]">Timeline</h2>
              </CardHeader>
              <CardContent className="p-4 overflow-y-auto flex-1" noPadding>
                <div className="relative ps-5 border-s border-[var(--border-subtle)] ms-3">
                  {timelineEvents.map((event) => (
                    <div key={event.id} className="relative mb-4 last:mb-0">
                      {/* Dot */}
                      <span
                        className="absolute -start-[21px] top-1 h-3 w-3 rounded-full border-2 border-[var(--surface-base)]"
                        style={{ backgroundColor: timelineEventColor(event.type) }}
                        aria-hidden="true"
                      />
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-[var(--text-primary)]">{event.orgName}</p>
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{event.description}</p>
                        </div>
                        <div className="text-end shrink-0">
                          <Badge
                            variant={
                              event.type === 'alert' ? 'danger'
                                : event.type === 'filing' ? 'info'
                                : event.type === 'grant' ? 'success'
                                : 'default'
                            }
                            size="sm"
                          >
                            {timelineEventLabel(event.type)}
                          </Badge>
                          <p className="text-[10px] text-[var(--text-tertiary)] mt-1">{event.date}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </main>

        {/* Right panel: entity details */}
        <aside
          className={cn(
            'w-60 shrink-0 transition-all duration-200',
            selectedOrg ? 'opacity-100' : 'opacity-0 pointer-events-none',
          )}
          aria-hidden={!selectedOrg}
        >
          {selectedOrg && (
            <Card noOverflowClip className="h-full flex flex-col">
              <CardHeader
                actions={
                  <button
                    type="button"
                    onClick={() => setSelectedOrgId(null)}
                    className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-trust)]"
                    aria-label="Close detail panel"
                  >
                    <IconX />
                  </button>
                }
              >
                <h2 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wide">
                  Entity Detail
                </h2>
              </CardHeader>
              <CardContent className="p-4 flex-1 min-h-0">
                <DetailPanel org={selectedOrg} allOrgs={canvasOrgs} />
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
