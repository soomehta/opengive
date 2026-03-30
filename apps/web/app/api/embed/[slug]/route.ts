import { NextResponse, type NextRequest } from 'next/server';
import { createDb } from '@opengive/db/client';
import { organizations, organizationScores } from '@opengive/db/schema';
import { eq, desc } from 'drizzle-orm';

const db = createDb(process.env.DATABASE_URL!);

// ---------------------------------------------------------------------------
// CORS / framing headers for embeddable widget responses
// ---------------------------------------------------------------------------

const EMBED_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  // Allow any origin to embed this widget in an iframe
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  // Override Next.js default X-Frame-Options to allow cross-origin embedding
  'X-Frame-Options': 'ALLOWALL',
  'Content-Security-Policy': "frame-ancestors *",
  // Cache for 5 minutes at the CDN level; private data changes infrequently
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
};

// ---------------------------------------------------------------------------
// Score gauge — self-contained SVG arc
// ---------------------------------------------------------------------------

function buildGaugeArc(score: number): string {
  // The gauge is a 180-degree arc (top semicircle).
  // score: 0-100. Arc fills from left (180°) toward right (0°).
  const clampedScore = Math.max(0, Math.min(100, score));
  const radius = 54;
  const cx = 70;
  const cy = 66;
  const startAngle = 180;
  const endAngle = 180 - clampedScore * 1.8; // 100 → 0deg, 0 → 180deg

  function polarToCart(angle: number) {
    const rad = (angle * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy - radius * Math.sin(rad),
    };
  }

  const start = polarToCart(startAngle);
  const end = polarToCart(endAngle);
  const largeArc = clampedScore > 50 ? 1 : 0;

  const trackPath = `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`;
  const fillPath =
    clampedScore <= 0
      ? ''
      : `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;

  const color =
    clampedScore >= 75
      ? '#22c55e'
      : clampedScore >= 50
        ? '#f59e0b'
        : '#ef4444';

  return `
    <svg width="140" height="80" viewBox="0 0 140 80" aria-label="Score gauge: ${clampedScore} out of 100" role="img" xmlns="http://www.w3.org/2000/svg">
      <!-- Track -->
      <path d="${trackPath}" fill="none" stroke="#e5e7eb" stroke-width="10" stroke-linecap="round"/>
      <!-- Fill -->
      ${fillPath ? `<path d="${fillPath}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round"/>` : ''}
      <!-- Score label -->
      <text x="${cx}" y="${cy + 2}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="22" font-weight="700" fill="#111827">${Math.round(clampedScore)}</text>
      <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#6b7280">/ 100</text>
    </svg>
  `;
}

// ---------------------------------------------------------------------------
// Metric chip
// ---------------------------------------------------------------------------

function metricChip(label: string, value: string): string {
  return `
    <div style="display:flex;flex-direction:column;gap:2px;padding:8px 12px;background:#f9fafb;border-radius:8px;min-width:80px;">
      <span style="font-size:11px;color:#6b7280;font-weight:500;">${label}</span>
      <span style="font-size:14px;color:#111827;font-weight:700;white-space:nowrap;">${value}</span>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '—';
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: EMBED_HEADERS });
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { slug } = await context.params;

  // Fetch org + latest score in a single round-trip where possible
  const orgRows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (orgRows.length === 0) {
    const notFoundHtml = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#6b7280;padding:16px;font-size:13px;">Organization not found.</body></html>`;
    return new NextResponse(notFoundHtml, {
      status: 404,
      headers: EMBED_HEADERS,
    });
  }

  const org = orgRows[0];

  // Latest score (may not exist)
  const scoreRows = await db
    .select()
    .from(organizationScores)
    .where(eq(organizationScores.organizationId, org.id))
    .orderBy(desc(organizationScores.fiscalYear))
    .limit(1);

  const latestScore = scoreRows[0] ?? null;
  const overallScore = latestScore?.overallScore ?? null;

  const statusColor: Record<string, string> = {
    active: '#22c55e',
    inactive: '#f59e0b',
    dissolved: '#ef4444',
    suspended: '#ef4444',
    unknown: '#9ca3af',
  };

  const dotColor = statusColor[org.status ?? 'unknown'] ?? '#9ca3af';
  const statusLabel =
    org.status != null
      ? org.status.charAt(0).toUpperCase() + org.status.slice(1)
      : 'Unknown';

  const openGiveUrl = `https://opengive.org/orgs/${org.slug}`;

  const gaugeSection =
    overallScore != null
      ? `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
           ${buildGaugeArc(overallScore)}
           <span style="font-size:11px;color:#6b7280;font-weight:500;">Accountability Score</span>
         </div>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${org.name} — OpenGive Widget</title>
  <style>
    *,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #ffffff;
      color: #111827;
      padding: 16px;
      min-height: 100vh;
    }
    .widget {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 16px;
      max-width: 480px;
      margin: 0 auto;
      background: #ffffff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    }
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }
    .org-name {
      font-size: 16px;
      font-weight: 700;
      color: #111827;
      line-height: 1.3;
    }
    .meta {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
      flex-wrap: wrap;
    }
    .status-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: ${dotColor};
      flex-shrink: 0;
    }
    .meta-text {
      font-size: 12px;
      color: #6b7280;
    }
    .body {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .metrics {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      flex: 1;
    }
    .footer {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid #f3f4f6;
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }
    .footer a {
      font-size: 11px;
      color: #9ca3af;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .footer a:hover { color: #6b7280; }
    .footer-logo {
      font-weight: 700;
      color: #2563eb;
    }
  </style>
</head>
<body>
  <div class="widget">
    <div class="header">
      <div>
        <div class="org-name">${escapeHtml(org.name)}</div>
        <div class="meta">
          <span class="status-dot" aria-hidden="true"></span>
          <span class="meta-text">${escapeHtml(statusLabel)}</span>
          <span class="meta-text" aria-hidden="true">·</span>
          <span class="meta-text">${escapeHtml(org.countryCode.toUpperCase())}</span>
          ${org.sector ? `<span class="meta-text" aria-hidden="true">·</span><span class="meta-text">${escapeHtml(org.sector)}</span>` : ''}
        </div>
      </div>
    </div>
    <div class="body">
      ${gaugeSection}
      <div class="metrics">
        ${metricChip('Country', org.countryCode.toUpperCase())}
        ${metricChip('Type', org.orgType.replace('_', ' '))}
        ${latestScore?.fiscalYear != null ? metricChip('Fiscal Year', String(latestScore.fiscalYear)) : ''}
        ${latestScore?.financialHealthScore != null ? metricChip('Financial Health', `${Math.round(latestScore.financialHealthScore)}/100`) : ''}
        ${latestScore?.transparencyScore != null ? metricChip('Transparency', `${Math.round(latestScore.transparencyScore)}/100`) : ''}
      </div>
    </div>
    <div class="footer">
      <a href="${openGiveUrl}" target="_blank" rel="noopener noreferrer" aria-label="View ${escapeHtml(org.name)} on OpenGive">
        Powered by <span class="footer-logo">OpenGive</span>
      </a>
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, { status: 200, headers: EMBED_HEADERS });
}

// ---------------------------------------------------------------------------
// Minimal HTML escape to prevent XSS in server-rendered strings
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
