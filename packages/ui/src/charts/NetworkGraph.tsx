'use client';

import * as React from 'react';
import * as d3 from 'd3';
import { cn } from '../lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NetworkNodeType = 'organization' | 'person' | 'address';
export type NetworkEdgeType = 'shared_director' | 'grant' | 'shared_address' | 'related';

export interface NetworkNode {
  id: string;
  label: string;
  country?: string;
  type?: NetworkNodeType;
  revenue?: number;
  /** 0-100 accountability score */
  score?: number;
  /** Pre-assigned color (overrides country/type coloring) */
  color?: string;
}

export interface NetworkEdge {
  source: string;
  target: string;
  type?: NetworkEdgeType;
  /** 0-1 strength; drives edge width */
  strength?: number;
  label?: string;
}

export interface NetworkGraphProps {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  /** Callback fired when a node is clicked */
  onNodeClick?: (node: NetworkNode) => void;
  /** Selected node id — highlights its neighbours */
  selectedNodeId?: string | null;
  /** Color nodes by 'country' | 'type' | 'score' */
  colorBy?: 'country' | 'type' | 'score';
  className?: string;
  /**
   * Fixed pixel height. When omitted the component fills its parent's height
   * (parent must have an explicit height for this to work).
   */
  height?: number;
  /** Accessible text summary (auto-generated if omitted) */
  'aria-label'?: string;
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const COUNTRY_COLORS: Record<string, string> = {
  'United States': '#6A7E5A',
  'United Kingdom': '#A88BC4',
  Switzerland: '#6BAF7B',
  Germany: '#E8B86D',
  Kenya: '#D4736E',
  Canada: '#7BA5AF',
  France: '#C4A5D4',
  Australia: '#B88F6B',
};
const FALLBACK_COLOR = '#9A9A8E';

const TYPE_COLORS: Record<NetworkNodeType, string> = {
  organization: '#6A7E5A',
  person: '#A88BC4',
  address: '#6BAF7B',
};

const EDGE_COLORS: Record<NetworkEdgeType, string> = {
  shared_director: '#A88BC4',
  grant: '#6BAF7B',
  shared_address: '#E8B86D',
  related: '#9A9A8E',
};

function scoreColor(score: number): string {
  if (score >= 70) return '#6BAF7B';
  if (score >= 40) return '#E8B86D';
  return '#D4736E';
}

function nodeColor(node: NetworkNode, colorBy: NetworkGraphProps['colorBy']): string {
  if (node.color) return node.color;
  if (colorBy === 'score' && node.score !== undefined) return scoreColor(node.score);
  if (colorBy === 'type' && node.type) return TYPE_COLORS[node.type] ?? FALLBACK_COLOR;
  // default: country
  return COUNTRY_COLORS[node.country ?? ''] ?? FALLBACK_COLOR;
}

function nodeRadius(node: NetworkNode): number {
  if (!node.revenue) return 18;
  if (node.revenue >= 1e9) return 36;
  if (node.revenue >= 1e8) return 28;
  if (node.revenue >= 1e7) return 22;
  return 18;
}

function initials(label: string): string {
  return label
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function formatRevenue(amount: number): string {
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(0)}M`;
  if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`;
  return `$${amount}`;
}

// ---------------------------------------------------------------------------
// Simulation-internal node/link types
// ---------------------------------------------------------------------------

interface SimNode extends d3.SimulationNodeDatum, NetworkNode {}
interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  type?: NetworkEdgeType;
  strength?: number;
  label?: string;
  /** Original source/target ids (preserved so we can look them up) */
  sourceId: string;
  targetId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NetworkGraph({
  nodes,
  edges,
  onNodeClick,
  selectedNodeId,
  colorBy = 'country',
  className,
  height,
  'aria-label': ariaLabel,
}: NetworkGraphProps) {
  // When height is not provided, we fill the container (100%)
  const resolvedHeight = height ?? '100%';
  const svgRef = React.useRef<SVGSVGElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const simulationRef = React.useRef<d3.Simulation<SimNode, SimLink> | null>(null);

  // Tooltip state
  const [tooltip, setTooltip] = React.useState<{
    x: number;
    y: number;
    node: NetworkNode;
  } | null>(null);

  const [dims, setDims] = React.useState({ width: 600, height: height ?? 480 });

  // Observe container size (width + height for fluid layouts)
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDims({
          width: entry.contentRect.width,
          height: height ?? (entry.contentRect.height || 480),
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);

  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    if (nodes.length === 0) return;

    // Clear previous render
    d3.select(svg).selectAll('*').remove();

    const { width, height: h } = dims;

    // Build simulation copies so D3 can mutate positions
    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }));
    const nodeById = new Map<string, SimNode>(simNodes.map((n) => [n.id, n]));

    const simLinks: SimLink[] = edges
      .map((e): SimLink | null => {
        const s = nodeById.get(e.source);
        const t = nodeById.get(e.target);
        if (!s || !t) return null;
        return {
          source: s,
          target: t,
          sourceId: e.source,
          targetId: e.target,
          type: e.type,
          strength: e.strength ?? 0.5,
          label: e.label,
        };
      })
      .filter((l): l is SimLink => l !== null);

    // Root SVG
    const root = d3
      .select(svg)
      .attr('width', width)
      .attr('height', h)
      .attr('viewBox', `0 0 ${width} ${h}`)
      .attr('role', 'img')
      .attr('aria-label', ariaLabel ?? buildAriaLabel(nodes, edges));

    // Zoom layer
    const g = root.append('g');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    root.call(zoom);

    // Arrow markers
    const defs = root.append('defs');
    const edgeTypes: (NetworkEdgeType | 'default')[] = [
      'shared_director',
      'grant',
      'shared_address',
      'related',
      'default',
    ];
    edgeTypes.forEach((et) => {
      const color =
        et === 'default' ? FALLBACK_COLOR : EDGE_COLORS[et as NetworkEdgeType];
      defs
        .append('marker')
        .attr('id', `arrow-${et}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 28)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', color)
        .attr('opacity', 0.6);
    });

    // Links
    const link = g
      .append('g')
      .attr('class', 'links')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', (d) =>
        d.type ? EDGE_COLORS[d.type] : FALLBACK_COLOR,
      )
      .attr('stroke-width', (d) => Math.max(1, (d.strength ?? 0.5) * 4))
      .attr('stroke-opacity', 0.5)
      .attr('marker-end', (d) => `url(#arrow-${d.type ?? 'default'})`);

    // Node groups
    const node = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, SimNode>('g')
      .data(simNodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on('start', (event, d) => {
            if (!event.active) simulationRef.current?.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulationRef.current?.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );

    // Circle
    node
      .append('circle')
      .attr('r', (d) => nodeRadius(d))
      .attr('fill', (d) => nodeColor(d, colorBy))
      .attr('fill-opacity', 0.15)
      .attr('stroke', (d) => nodeColor(d, colorBy))
      .attr('stroke-width', 2);

    // Initials label inside circle
    node
      .append('text')
      .text((d) => initials(d.label))
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', (d) => nodeColor(d, colorBy))
      .attr('font-size', (d) => Math.max(9, nodeRadius(d) * 0.55))
      .attr('font-weight', '600')
      .attr('font-family', "'IBM Plex Sans', system-ui, sans-serif")
      .style('pointer-events', 'none')
      .style('user-select', 'none');

    // Name label below
    node
      .append('text')
      .text((d) => truncate(d.label, 20))
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => nodeRadius(d) + 14)
      .attr('fill', '#9A9A8E')
      .attr('font-size', 10)
      .attr('font-family', "'IBM Plex Sans', system-ui, sans-serif")
      .style('pointer-events', 'none')
      .style('user-select', 'none');

    // Interaction: hover tooltip
    node
      .on('mouseenter', (event: MouseEvent, d) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (rect) {
          setTooltip({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            node: d,
          });
        }
      })
      .on('mousemove', (event: MouseEvent) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (rect) {
          setTooltip((prev) => prev ? { ...prev, x: event.clientX - rect.left, y: event.clientY - rect.top } : null);
        }
      })
      .on('mouseleave', () => setTooltip(null))
      .on('click', (_event, d) => {
        onNodeClick?.(d);
      });

    // Highlight selected node connections
    function applySelection(selId: string | null | undefined) {
      if (!selId) {
        node.selectAll('circle').attr('fill-opacity', 0.15).attr('stroke-opacity', 1);
        link.attr('stroke-opacity', 0.5);
        return;
      }
      const connected = new Set<string>([selId]);
      simLinks.forEach((l) => {
        const s = (l.source as SimNode).id;
        const t = (l.target as SimNode).id;
        if (s === selId) connected.add(t);
        if (t === selId) connected.add(s);
      });
      node.selectAll<SVGCircleElement, SimNode>('circle')
        .attr('fill-opacity', (d) => (connected.has(d.id) ? 0.3 : 0.05))
        .attr('stroke-opacity', (d) => (connected.has(d.id) ? 1 : 0.2));
      link
        .attr('stroke-opacity', (d) => {
          const s = (d.source as SimNode).id;
          const t = (d.target as SimNode).id;
          return s === selId || t === selId ? 0.85 : 0.1;
        });
    }

    applySelection(selectedNodeId);

    // Force simulation
    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(120),
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, h / 2))
      .force('collide', d3.forceCollide<SimNode>().radius((d) => nodeRadius(d) + 8));

    simulationRef.current = simulation;

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0);

      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // Re-apply selection when selectedNodeId changes (handled via separate effect below)

    return () => {
      simulation.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, colorBy, dims]);

  // Separate effect for selection changes to avoid full re-render
  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg || nodes.length === 0) return;
    const simLinks: SimLink[] = edges
      .map((e): SimLink | null => {
        const s = nodes.find((n) => n.id === e.source);
        const t = nodes.find((n) => n.id === e.target);
        if (!s || !t) return null;
        return { source: e.source, target: e.target, sourceId: e.source, targetId: e.target, type: e.type, strength: e.strength };
      })
      .filter((l): l is SimLink => l !== null);

    const selId = selectedNodeId;
    if (!selId) {
      d3.select(svg).selectAll<SVGCircleElement, SimNode>('.node circle')
        .attr('fill-opacity', 0.15).attr('stroke-opacity', 1);
      d3.select(svg).selectAll<SVGLineElement, SimLink>('line')
        .attr('stroke-opacity', 0.5);
      return;
    }
    const connected = new Set<string>([selId]);
    simLinks.forEach((l) => {
      if (l.sourceId === selId) connected.add(l.targetId);
      if (l.targetId === selId) connected.add(l.sourceId);
    });
    d3.select(svg).selectAll<SVGCircleElement, SimNode>('.node circle')
      .attr('fill-opacity', (d) => (connected.has(d.id) ? 0.3 : 0.05))
      .attr('stroke-opacity', (d) => (connected.has(d.id) ? 1 : 0.2));
    d3.select(svg).selectAll<SVGLineElement, SimLink>('line')
      .attr('stroke-opacity', (d) => {
        const s = typeof d.source === 'string' ? d.source : (d.source as SimNode).id;
        const t = typeof d.target === 'string' ? d.target : (d.target as SimNode).id;
        return s === selId || t === selId ? 0.85 : 0.1;
      });
  }, [selectedNodeId, nodes, edges]);

  // Empty state
  if (nodes.length === 0) {
    return (
      <div
        role="img"
        aria-label={ariaLabel ?? 'No network data available'}
        className={cn(
          'flex items-center justify-center text-sm text-[var(--text-tertiary)] rounded-md border border-[var(--border-subtle)]',
          className,
        )}
        style={{ height: resolvedHeight }}
      >
        No entities added to graph
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full overflow-hidden rounded-md border border-[var(--border-subtle)]', className)}
      style={{ height: resolvedHeight }}
    >
      <svg ref={svgRef} className="w-full h-full" style={{ background: 'var(--surface-raised)' }} />

      {/* Tooltip */}
      {tooltip && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            left: tooltip.x + 12,
            top: tooltip.y - 8,
            pointerEvents: 'none',
            zIndex: 50,
          }}
          className="rounded-md border border-[var(--border-default)] bg-[var(--surface-elevated)] px-3 py-2 shadow-lg text-xs max-w-[200px]"
        >
          <p className="font-semibold text-[var(--text-primary)] mb-1">{tooltip.node.label}</p>
          {tooltip.node.country && (
            <p className="text-[var(--text-tertiary)]">{tooltip.node.country}</p>
          )}
          {tooltip.node.revenue !== undefined && (
            <p className="text-[var(--text-secondary)]">Revenue: {formatRevenue(tooltip.node.revenue)}</p>
          )}
          {tooltip.node.score !== undefined && (
            <p className="text-[var(--text-secondary)]">Score: {tooltip.node.score}/100</p>
          )}
        </div>
      )}

      {/* Legend */}
      <div
        className="absolute bottom-2 start-2 flex flex-wrap gap-2"
        aria-hidden="true"
      >
        {colorBy === 'country' &&
          Object.entries(COUNTRY_COLORS)
            .filter(([country]) => nodes.some((n) => n.country === country))
            .map(([country, color]) => (
              <span key={country} className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {country}
              </span>
            ))}
        {colorBy === 'type' &&
          (Object.entries(TYPE_COLORS) as [NetworkNodeType, string][]).map(([type, color]) => (
            <span key={type} className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              {type}
            </span>
          ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '\u2026' : str;
}

function buildAriaLabel(nodes: NetworkNode[], edges: NetworkEdge[]): string {
  return (
    `Network graph with ${nodes.length} organization${nodes.length !== 1 ? 's' : ''} ` +
    `and ${edges.length} connection${edges.length !== 1 ? 's' : ''}. ` +
    `Nodes: ${nodes.map((n) => n.label).join(', ')}.`
  );
}
