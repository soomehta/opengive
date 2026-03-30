'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MapMarker {
  id: string;
  name: string;
  slug?: string;
  lat: number;
  lng: number;
  country?: string;
  orgType?: string;
  /** 0-100 score for color coding */
  score?: number;
  /** Number of alerts for this org */
  alertCount?: number;
}

interface GeoMapProps {
  /** Array of organization markers to display */
  markers?: MapMarker[];
  /** Map center [lng, lat] — defaults to world view */
  center?: [number, number];
  /** Initial zoom level (0-22) — defaults to 1.8 for world view */
  zoom?: number;
  /** Height of the map container */
  height?: string;
  /** Callback when a marker is clicked */
  onMarkerClick?: (marker: MapMarker) => void;
  /** Show a subtle label */
  className?: string;
  /** Accessible label for the map */
  ariaLabel?: string;
}

// ---------------------------------------------------------------------------
// OSM Style — warm organic theme matching the design system
// ---------------------------------------------------------------------------

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: 'OpenGive Organic',
  sources: {
    osm: {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'osm-tiles',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
      maxzoom: 22,
      paint: {
        // Slight desaturation + warmth to match organic palette
        'raster-saturation': -0.3,
        'raster-brightness-min': 0.05,
        'raster-contrast': -0.1,
      },
    },
  ],
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
};

// ---------------------------------------------------------------------------
// Marker color based on score
// ---------------------------------------------------------------------------

function markerColor(score?: number): string {
  if (score === undefined) return '#6A7E5A'; // sage default
  if (score >= 70) return '#6BAF7B'; // healthy
  if (score >= 40) return '#E8B86D'; // caution
  return '#D4736E'; // danger
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GeoMap({
  markers = [],
  center = [10, 20],
  zoom = 1.8,
  height = '100%',
  onMarkerClick,
  className,
  ariaLabel = 'Interactive map showing charity organizations worldwide',
}: GeoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center,
      zoom,
      attributionControl: {},
      maxZoom: 18,
      minZoom: 1,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'top-right'
    );

    map.on('load', () => {
      setLoaded(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers when data changes
  useEffect(() => {
    if (!mapRef.current || !loaded) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    markers.forEach((m) => {
      const color = markerColor(m.score);

      // Create custom marker element
      const el = document.createElement('div');
      el.style.width = '14px';
      el.style.height = '14px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = color;
      el.style.border = '2.5px solid white';
      el.style.boxShadow = `0 2px 6px ${color}44`;
      el.style.cursor = 'pointer';
      el.style.transition = 'transform 0.2s ease';
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.4)';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
      });

      // Create popup
      const popup = new maplibregl.Popup({
        offset: 12,
        closeButton: false,
        className: 'opengive-popup',
      }).setHTML(`
        <div style="font-family: var(--font-body); padding: 4px 0;">
          <strong style="font-size: 13px; color: var(--text-primary);">${m.name}</strong>
          ${m.country ? `<br><span style="font-size: 11px; color: var(--text-secondary);">${m.country}</span>` : ''}
          ${m.score !== undefined ? `<br><span style="font-size: 11px; color: ${color}; font-weight: 600;">Score: ${m.score}/100</span>` : ''}
          ${m.alertCount ? `<br><span style="font-size: 11px; color: var(--signal-danger);">${m.alertCount} alert${m.alertCount > 1 ? 's' : ''}</span>` : ''}
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([m.lng, m.lat])
        .setPopup(popup)
        .addTo(mapRef.current!);

      if (onMarkerClick) {
        el.addEventListener('click', () => onMarkerClick(m));
      }

      markersRef.current.push(marker);
    });
  }, [markers, loaded, onMarkerClick]);

  return (
    <div
      className={className}
      style={{ position: 'relative', height, minHeight: '240px' }}
    >
      <div
        ref={containerRef}
        role="application"
        aria-label={ariaLabel}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          overflow: 'hidden',
        }}
      />
      {/* Loading state */}
      {!loaded && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--surface-elevated)',
            borderRadius: 'inherit',
          }}
        >
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
            Loading map...
          </span>
        </div>
      )}
      {/* Custom popup styles */}
      <style>{`
        .opengive-popup .maplibregl-popup-content {
          background: var(--surface-overlay);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-md);
          padding: 10px 14px;
          font-family: var(--font-body);
        }
        .opengive-popup .maplibregl-popup-tip {
          border-top-color: var(--surface-overlay);
        }
        .maplibregl-ctrl-attrib {
          font-size: 10px !important;
          opacity: 0.6;
        }
        .maplibregl-ctrl-group {
          border-radius: var(--radius-md) !important;
          border: 1px solid var(--border-default) !important;
          box-shadow: var(--shadow-sm) !important;
        }
        .maplibregl-ctrl-group button {
          background-color: var(--surface-overlay) !important;
        }
        .maplibregl-ctrl-group button:hover {
          background-color: var(--surface-elevated) !important;
        }
      `}</style>
    </div>
  );
}
