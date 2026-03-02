# Phase 5: Product Features

> **Goal:** Transform VelocityCSO from a one-shot audit tool into a persistent strategy platform with monitoring, collaboration, and enterprise-grade exports.  
> **Depends on:** Phase 1 (Auth), Phase 2 (20 dimensions).

---

## Task 5.1 — Audit History & Dimension Drift Tracking

### Firestore data model

```
enterprise_strategy_reports/{reportId}
  - userId: string
  - orgId: string
  - businessContext: string
  - fingerprint: string           // first 120 chars of context (for grouping)
  - dimensions: Record<string, number>
  - createdAt: Timestamp
  - moatRationale: string
  - orgName: string
  - shareToken: string

  subcollections:
    specialist_outputs/{specialistName}
    audit_versions/   ← NEW: stores each re-audit as a version
```

### New API endpoint — audit history

```typescript
// src/index.ts — add:

// Get all audits for the same company (grouped by fingerprint prefix)
app.get('/history/:orgId', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { orgId } = req.params;

  // Only return audits belonging to this user's org
  if (req.orgId !== orgId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const snapshot = await admin.firestore()
    .collection('enterprise_strategy_reports')
    .where('orgId', '==', orgId)
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();

  const audits = snapshot.docs.map(doc => ({
    id: doc.id,
    orgName: doc.data().orgName,
    createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
    dimensions: doc.data().dimensions,
    overallScore: Object.values(doc.data().dimensions as Record<string, number>)
      .reduce((a, b) => a + b, 0) / Object.keys(doc.data().dimensions).length,
  }));

  res.json({ audits });
});

// Get dimension trend for a specific company (by fingerprint)
app.get('/history/:orgId/trend/:fingerprint', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { orgId, fingerprint } = req.params;
  if (req.orgId !== orgId) return res.status(403).json({ error: 'Forbidden' });

  const snapshot = await admin.firestore()
    .collection('enterprise_strategy_reports')
    .where('orgId', '==', orgId)
    .where('fingerprint', '>=', fingerprint.slice(0, 80))
    .where('fingerprint', '<', fingerprint.slice(0, 80) + '\uf8ff')
    .orderBy('fingerprint')
    .orderBy('createdAt', 'asc')
    .limit(12)
    .get();

  const trend = snapshot.docs.map(doc => ({
    date: doc.data().createdAt?.toDate?.()?.toISOString(),
    dimensions: doc.data().dimensions,
    reportId: doc.id,
  }));

  res.json({ trend });
});
```

### New frontend page: `frontend/src/components/AuditHistory.tsx`

```tsx
// frontend/src/components/AuditHistory.tsx

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';

interface AuditSnapshot {
  date: string;
  dimensions: Record<string, number>;
  reportId: string;
}

interface AuditHistoryProps {
  trend: AuditSnapshot[];
  onSelectAudit: (reportId: string) => void;
}

// Key dimensions to show in trend chart (show top 5 by variance)
function getTopVarianceDimensions(trend: AuditSnapshot[]): string[] {
  if (trend.length < 2) return Object.keys(trend[0]?.dimensions ?? {}).slice(0, 5);

  const dims = Object.keys(trend[0].dimensions);
  return dims
    .map(dim => {
      const values = trend.map(t => t.dimensions[dim] ?? 0);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
      return { dim, variance };
    })
    .sort((a, b) => b.variance - a.variance)
    .slice(0, 5)
    .map(d => d.dim);
}

const TREND_COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

export function AuditHistory({ trend, onSelectAudit }: AuditHistoryProps) {
  if (trend.length === 0) {
    return (
      <div className="glass-card p-8 text-center text-gray-400">
        No audit history yet. Run your first audit to start tracking trends.
      </div>
    );
  }

  const trackedDims = getTopVarianceDimensions(trend);
  const chartData = trend.map(t => ({
    date: format(new Date(t.date), 'MMM d'),
    ...Object.fromEntries(trackedDims.map(d => [d, t.dimensions[d] ?? 0])),
    reportId: t.reportId,
  }));

  // Find dimensions with >10 point drop between last two audits
  const driftAlerts: string[] = [];
  if (trend.length >= 2) {
    const latest = trend[trend.length - 1].dimensions;
    const previous = trend[trend.length - 2].dimensions;
    for (const [dim, score] of Object.entries(latest)) {
      const prev = previous[dim] ?? score;
      if (prev - score > 10) {
        driftAlerts.push(`${dim.replace(/_/g, ' ')}: dropped ${(prev - score).toFixed(0)} pts`);
      }
    }
  }

  return (
    <div className="space-y-6">
      {driftAlerts.length > 0 && (
        <div className="glass-card p-4 border border-amber-500/30">
          <h4 className="text-sm font-semibold text-amber-400 mb-2">⚠ Dimension Drift Alerts</h4>
          <ul className="space-y-1">
            {driftAlerts.map(alert => (
              <li key={alert} className="text-sm text-amber-300">• {alert}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="glass-card p-4">
        <h4 className="text-sm font-semibold text-white mb-4">
          Dimension Trend — Top {trackedDims.length} by Volatility
        </h4>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData}>
            <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#0f1829', border: '1px solid #1e2a3a' }} />
            <Legend />
            {trackedDims.map((dim, i) => (
              <Line key={dim} type="monotone" dataKey={dim} stroke={TREND_COLORS[i]}
                    strokeWidth={2} dot={{ r: 4 }} name={dim.replace(/_/g, ' ')} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-white">Audit Log</h4>
        {[...trend].reverse().map(snapshot => (
          <button key={snapshot.reportId}
            onClick={() => onSelectAudit(snapshot.reportId)}
            className="w-full glass-card p-3 flex justify-between items-center hover:border-violet-500/40 transition-colors text-left">
            <span className="text-sm text-gray-300">
              {format(new Date(snapshot.date), 'MMM d, yyyy HH:mm')}
            </span>
            <span className="text-sm text-violet-400 font-semibold">
              Avg: {(Object.values(snapshot.dimensions).reduce((a, b) => a + b, 0) /
                Object.keys(snapshot.dimensions).length).toFixed(0)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

## Task 5.2 — 90-Day Action Roadmap

### Changes to `src/coordinator.ts` — CSO synthesis prompt

```typescript
// src/coordinator.ts — extend the CSO synthesis instruction to require a roadmap section:

`
After the main strategy report, generate a 90-DAY STRATEGIC ROADMAP section.

Format it as:
## 90-Day Strategic Roadmap

### Days 1-30: Quick Wins
[3 specific actions with measurable outcomes. Format each as:]
**Action:** [Specific action]
**Owner:** [CEO / CTO / Head of Sales / etc]
**Success metric:** [Quantifiable outcome]
**Why now:** [One sentence urgency]

### Days 31-60: Foundation Building
[3 specific actions]

### Days 61-90: Strategic Bets
[2-3 specific actions with higher uncertainty but high upside]

Each action must:
- Reference a specific dimension from the 20-dimension scorecard
- Name a specific person or role responsible
- Have a measurable success metric (not "improve" — specify a number)
- Connect to a specific business outcome (revenue, cost, risk reduction)
`
```

### New frontend component: `frontend/src/components/ActionRoadmap.tsx`

```tsx
// frontend/src/components/ActionRoadmap.tsx

interface Action {
  title: string;
  owner: string;
  success_metric: string;
  why_now: string;
  dimension_reference: string;
  status: 'not_started' | 'in_progress' | 'done';
}

interface RoadmapData {
  phase_1_30: Action[];
  phase_31_60: Action[];
  phase_61_90: Action[];
}

const PHASE_CONFIG = [
  { key: 'phase_1_30', label: 'Days 1–30', subtitle: 'Quick Wins', color: '#10b981' },
  { key: 'phase_31_60', label: 'Days 31–60', subtitle: 'Foundation', color: '#8b5cf6' },
  { key: 'phase_61_90', label: 'Days 61–90', subtitle: 'Strategic Bets', color: '#f59e0b' },
];

export function ActionRoadmap({ roadmap, reportId }: { roadmap: RoadmapData; reportId: string }) {
  // Status is stored in localStorage per report+action
  const getStatus = (actionKey: string) =>
    (localStorage.getItem(`${reportId}_${actionKey}`) ?? 'not_started') as Action['status'];

  const setStatus = (actionKey: string, status: Action['status']) => {
    localStorage.setItem(`${reportId}_${actionKey}`, status);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">90-Day Strategic Roadmap</h2>
      {PHASE_CONFIG.map(phase => {
        const actions = roadmap[phase.key as keyof RoadmapData] ?? [];
        return (
          <div key={phase.key} className="glass-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-8 rounded" style={{ background: phase.color }} />
              <div>
                <h3 className="font-semibold text-white">{phase.label}</h3>
                <p className="text-xs text-gray-400">{phase.subtitle}</p>
              </div>
            </div>
            <div className="space-y-3">
              {actions.map((action, i) => {
                const key = `${phase.key}_${i}`;
                return (
                  <div key={key} className="bg-white/5 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-sm font-semibold text-white">{action.title}</p>
                      <select
                        value={getStatus(key)}
                        onChange={e => setStatus(key, e.target.value as Action['status'])}
                        className="text-xs bg-transparent border border-white/10 rounded px-2 py-1 text-gray-400"
                      >
                        <option value="not_started">Not Started</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done ✓</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                      <span>👤 {action.owner}</span>
                      <span>📊 {action.dimension_reference}</span>
                      <span className="col-span-2">🎯 {action.success_metric}</span>
                      <span className="col-span-2 text-amber-400/80">⚡ {action.why_now}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

---

## Task 5.3 — Multi-User Report Sharing

### Changes to the report access model

```typescript
// src/index.ts — replace the 8-char token check with proper share token:

app.get('/report/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { token } = req.query as { token?: string };

  const doc = await admin.firestore()
    .collection('enterprise_strategy_reports').doc(id).get();

  if (!doc.exists) return res.status(404).json({ error: 'Report not found' });

  const data = doc.data()!;

  // Access is granted if:
  // 1. The user owns the report (userId matches), OR
  // 2. A valid share token is provided AND it hasn't expired, OR
  // 3. The user is in the same org

  const isOwner = data.userId === req.userId;
  const isSameOrg = data.orgId === req.orgId;
  const isValidToken = token &&
    data.shareToken === token &&
    data.shareTokenExpiry > Date.now();

  if (!isOwner && !isSameOrg && !isValidToken) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Return role based on access type
  const role = isOwner ? 'owner' : isSameOrg ? 'editor' : 'viewer';
  res.json({ ...data, role });
});

// Generate a new share link
app.post('/report/:id/share', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { expiryHours = 168 } = req.body as { expiryHours?: number }; // default 7 days

  const { generateShareToken } = await import('./middleware/auth.js');
  const shareToken = generateShareToken();
  const shareTokenExpiry = Date.now() + expiryHours * 60 * 60 * 1000;

  await admin.firestore()
    .collection('enterprise_strategy_reports').doc(id)
    .update({ shareToken, shareTokenExpiry });

  res.json({
    shareUrl: `${process.env.APP_URL}/report/${id}?token=${shareToken}`,
    expiresAt: new Date(shareTokenExpiry).toISOString(),
  });
});
```

### Frontend: Share button in report dashboard

```tsx
// Add to HeroSection.tsx report dashboard header:

const [shareUrl, setShareUrl] = useState<string | null>(null);
const [sharing, setSharing] = useState(false);

async function generateShareLink() {
  setSharing(true);
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/report/${currentReportId}/share`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ expiryHours: 168 }),
    });
    const { shareUrl: url } = await res.json();
    setShareUrl(url);
    await navigator.clipboard.writeText(url);
  } finally {
    setSharing(false);
  }
}

// JSX:
<button onClick={generateShareLink} disabled={sharing}
  className="flex items-center gap-2 px-4 py-2 text-sm glass-card hover:border-violet-500/40">
  <Share2 size={14} />
  {sharing ? 'Generating...' : shareUrl ? '✓ Link Copied' : 'Share Report'}
</button>
```

---

## Task 5.4 — Board-Quality PDF Export

### Rewrite `src/services/pdfService.ts`

Key changes needed:

**1. Fix Unicode destruction**
```typescript
// Replace:
function sanitizeText(text: string): string {
  return text.replace(/[^\x20-\x7E]/g, '');
}

// With:
function sanitizeText(text: string): string {
  // Only remove truly unprintable control characters, preserve Unicode
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}
```

**2. Add Table of Contents**
```typescript
function addTableOfContents(doc: PDFKit.PDFDocument, sections: Array<{ title: string; page: number }>) {
  doc.addPage();
  doc.fontSize(20).font('Helvetica-Bold').text('Contents', 50, 60);
  doc.moveDown(1);

  sections.forEach(section => {
    doc.fontSize(11).font('Helvetica')
       .fillColor('#6b7280')
       .text(section.title, 60)
       .text(section.page.toString(), { align: 'right' });
    doc.moveDown(0.5);
  });
}
```

**3. Add SVG Radar Chart to PDF**

The radar chart data is available in the report. Render it as an SVG string and embed in PDF:

```typescript
import { createCanvas } from 'canvas'; // npm install canvas

function renderRadarToPDF(
  doc: PDFKit.PDFDocument,
  dimensions: Record<string, number>,
  x: number, y: number, size: number
) {
  // Generate SVG path for radar polygon
  const entries = Object.entries(dimensions).slice(0, 15);
  const n = entries.length;
  const center = size / 2;
  const maxRadius = center - 20;

  const points = entries.map(([, score], i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    const r = (score / 100) * maxRadius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  });

  // Draw filled polygon
  doc.save()
     .translate(x, y)
     .polygon(...points.map(p => [p.x, p.y] as [number, number]))
     .fillOpacity(0.3)
     .fillAndStroke('#8b5cf6', '#8b5cf6')
     .restore();

  // Draw dimension labels
  entries.forEach(([name], i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    const r = maxRadius + 15;
    const labelX = x + center + r * Math.cos(angle);
    const labelY = y + center + r * Math.sin(angle);
    doc.fontSize(7).fillColor('#6b7280')
       .text(name.replace(/_/g, ' ').slice(0, 15), labelX - 25, labelY - 5, { width: 50, align: 'center' });
  });
}
```

**4. Add the REGULATORY scenario** (currently missing)

```typescript
// src/services/pdfService.ts — in the scenarios array:
// Change from:
const SCENARIO_IDS = ['RECESSION', 'PRICE_WAR', 'SCALE_UP', 'TALENT'];
// To:
const SCENARIO_IDS = ['RECESSION', 'PRICE_WAR', 'SCALE_UP', 'TALENT', 'REGULATORY'];
```

**5. Source attribution appendix**
```typescript
function addSourcesAppendix(doc: PDFKit.PDFDocument, sources: string[]) {
  doc.addPage();
  sectionTitle(doc, 'Data Sources & Methodology');
  doc.moveDown(0.5);

  const unique = [...new Set(sources)].filter(Boolean);
  unique.forEach((source, i) => {
    doc.fontSize(9).fillColor('#6b7280')
       .text(`${i + 1}. ${source}`, 50, doc.y, { indent: 20 });
  });
}
```

---

## Task 5.5 — Weekly Strategy Digest Email

### New file: `src/services/emailService.ts`

```typescript
// src/services/emailService.ts
// Uses SendGrid (free tier: 100 emails/day)

export async function sendWeeklyDigest(params: {
  email: string;
  orgName: string;
  latestDimensions: Record<string, number>;
  previousDimensions: Record<string, number>;
  topChanges: Array<{ dimension: string; delta: number }>;
  reportUrl: string;
}): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return;

  const { email, orgName, topChanges, reportUrl } = params;

  const changes = topChanges.slice(0, 3).map(c =>
    `${c.dimension.replace(/_/g, ' ')}: ${c.delta > 0 ? '+' : ''}${c.delta.toFixed(0)} pts`
  ).join('\n');

  const avgScore = Object.values(params.latestDimensions)
    .reduce((a, b) => a + b, 0) / Object.keys(params.latestDimensions).length;

  await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email }] }],
      from: { email: 'digest@velocitycso.com', name: 'VelocityCSO' },
      subject: `${orgName} Strategy Digest — Week of ${new Date().toLocaleDateString()}`,
      content: [{
        type: 'text/plain',
        value: `
VelocityCSO Weekly Strategy Digest

${orgName} — Overall Score: ${avgScore.toFixed(0)}/100

Notable changes this week:
${changes || 'No significant changes detected.'}

View your full strategy dashboard: ${reportUrl}

—
VelocityCSO | Your AI Chief Strategy Officer
        `.trim(),
      }],
    }),
  });
}
```

### Scheduled digest via Cloud Scheduler

```typescript
// src/index.ts — add digest trigger endpoint (called by Cloud Scheduler):

app.post('/internal/send-digests', async (req, res) => {
  // Verify request is from Cloud Scheduler (check X-CloudScheduler header)
  if (req.headers['x-cloudscheduler'] !== 'true') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { sendWeeklyDigest } = await import('./services/emailService.js');

  // Fetch all users with digest enabled
  const snapshot = await admin.firestore()
    .collection('user_preferences')
    .where('weeklyDigest', '==', true)
    .get();

  const results = await Promise.allSettled(
    snapshot.docs.map(async (doc) => {
      const prefs = doc.data();
      // Fetch their latest report...
      // Compare to previous report...
      // Send digest
      await sendWeeklyDigest({ ...prefs });
    })
  );

  res.json({ sent: results.filter(r => r.status === 'fulfilled').length });
});
```

---

## Phase 5 Completion Checklist

- [ ] `GET /history/:orgId` returns paginated audit list
- [ ] `GET /history/:orgId/trend/:fingerprint` returns dimension time-series
- [ ] `AuditHistory.tsx` renders drift alerts and trend line chart
- [ ] CSO prompt generates structured 90-Day Roadmap section
- [ ] `ActionRoadmap.tsx` renders 3-phase action cards with status toggles
- [ ] `POST /report/:id/share` generates cryptographically safe share tokens
- [ ] Share link button appears in report dashboard
- [ ] PDF sanitizeText preserves Unicode characters
- [ ] PDF includes Table of Contents
- [ ] PDF includes radar chart SVG
- [ ] PDF includes all 5 stress scenarios (including REGULATORY)
- [ ] PDF includes sources/methodology appendix
- [ ] `emailService.ts` sends weekly digest via SendGrid
- [ ] Cloud Scheduler endpoint `/internal/send-digests` is documented
- [ ] `SENDGRID_API_KEY` added to `.env.example`
