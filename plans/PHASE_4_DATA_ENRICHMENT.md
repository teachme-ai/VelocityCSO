# Phase 4: Data Enrichment

> **Goal:** Move from text-only input to rich, multi-source context ingestion. Give the Discovery Agent real web search. Add financial and competitive data APIs.  
> **Depends on:** Phase 1 (Task 1.1 Google Search Grounding), Phase 2 (Discovery Agent PESTLE output).

---

## Task 4.1 — URL Scraping Input

### New file: `src/services/scraperService.ts`

```typescript
// src/services/scraperService.ts
// Scrapes a company website to extract structured context

import { log } from './logger.js';

export interface ScrapeResult {
  url: string;
  title: string;
  description: string;       // meta description or first paragraph
  product_pages: string[];   // extracted product/feature descriptions
  pricing_signals: string[]; // any pricing text found
  team_signals: string[];    // team/about page content
  technology_signals: string[]; // footer tech badges, "built with" signals
  raw_text: string;          // full cleaned text, max 4000 chars
}

export async function scrapeCompanyUrl(url: string): Promise<ScrapeResult> {
  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  // Use Google's URL Fetch or a headless browser service
  // Option A: Use fetch() directly (works for static sites)
  // Option B: Use Puppeteer for JS-rendered sites
  // Recommended: Use a scraping API like Firecrawl or Jina AI Reader
  // for production (they handle JS rendering, rate limits, anti-bot)

  // Using Jina AI Reader (free tier available, no setup needed):
  const jinaUrl = `https://r.jina.ai/${parsed.href}`;

  const response = await fetch(jinaUrl, {
    headers: {
      'Accept': 'application/json',
      'X-Return-Format': 'markdown',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Scrape failed: ${response.status}`);
  }

  const markdown = await response.text();
  const truncated = markdown.slice(0, 8000);

  // Extract signals with regex heuristics
  return {
    url: parsed.href,
    title: extractTitle(markdown),
    description: extractDescription(markdown),
    product_pages: extractSection(markdown, /##?\s*(product|features?|solution|platform)/i),
    pricing_signals: extractSection(markdown, /##?\s*(pricing|plans?|cost)/i),
    team_signals: extractSection(markdown, /##?\s*(team|about|founders?|leadership)/i),
    technology_signals: extractTechSignals(markdown),
    raw_text: truncated,
  };
}

function extractTitle(md: string): string {
  const match = md.match(/^#\s+(.+)/m);
  return match?.[1]?.trim() ?? '';
}

function extractDescription(md: string): string {
  const lines = md.split('\n').filter(l => l.trim().length > 50);
  return lines[0]?.trim().slice(0, 300) ?? '';
}

function extractSection(md: string, headingPattern: RegExp): string[] {
  const sections: string[] = [];
  const lines = md.split('\n');
  let inSection = false;
  let sectionText = '';

  for (const line of lines) {
    if (headingPattern.test(line)) {
      inSection = true;
      sectionText = '';
      continue;
    }
    if (inSection && /^##?\s/.test(line)) {
      if (sectionText.trim()) sections.push(sectionText.trim().slice(0, 500));
      inSection = false;
      continue;
    }
    if (inSection) sectionText += line + '\n';
  }

  if (sectionText.trim()) sections.push(sectionText.trim().slice(0, 500));
  return sections.slice(0, 3);
}

function extractTechSignals(md: string): string[] {
  const techPatterns = [
    /built with ([A-Za-z0-9\s,]+)/gi,
    /powered by ([A-Za-z0-9\s]+)/gi,
    /(react|vue|angular|next\.js|vercel|aws|gcp|azure|stripe|twilio|segment)/gi,
  ];
  const signals: string[] = [];
  for (const pattern of techPatterns) {
    const matches = md.match(pattern);
    if (matches) signals.push(...matches.slice(0, 3));
  }
  return [...new Set(signals)].slice(0, 10);
}
```

### New API endpoint in `src/index.ts`

```typescript
// src/index.ts — add new endpoint:

app.post('/enrich/url', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { url } = req.body as { url: string };

  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  try {
    const { scrapeCompanyUrl } = await import('./services/scraperService.js');
    const result = await scrapeCompanyUrl(url);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
```

### Frontend changes — `HeroSection.tsx`

Add URL input field above the main textarea:

```tsx
// frontend/src/components/HeroSection.tsx — add URL enrichment UI

const [companyUrl, setCompanyUrl] = useState('');
const [urlEnriching, setUrlEnriching] = useState(false);
const [urlEnriched, setUrlEnriched] = useState(false);

async function enrichFromUrl() {
  if (!companyUrl) return;
  setUrlEnriching(true);

  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/enrich/url`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url: companyUrl }),
    });
    const { data } = await res.json();

    // Append scraped context to the business context textarea
    const enrichedText = `
WEBSITE CONTEXT (scraped from ${companyUrl}):
${data.raw_text}

${context}`.trim();

    setContext(enrichedText);
    setUrlEnriched(true);
  } finally {
    setUrlEnriching(false);
  }
}

// JSX to add above the textarea:
<div className="flex gap-2 mb-3">
  <input
    type="url"
    placeholder="https://yourcompany.com (optional — auto-enriches context)"
    value={companyUrl}
    onChange={e => setCompanyUrl(e.target.value)}
    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
  />
  <button
    onClick={enrichFromUrl}
    disabled={!companyUrl || urlEnriching}
    className="px-4 py-2 text-sm bg-violet-600/20 border border-violet-500/30 rounded-lg text-violet-300 hover:bg-violet-600/40 disabled:opacity-50"
  >
    {urlEnriching ? 'Scraping...' : urlEnriched ? '✓ Enriched' : 'Auto-fill'}
  </button>
</div>
```

---

## Task 4.2 — PDF & Document Upload

### Install dependencies

```bash
# Backend:
npm install multer pdf-parse @types/multer @types/pdf-parse

# No frontend changes needed — use native file input
```

### New file: `src/services/documentParser.ts`

```typescript
// src/services/documentParser.ts

import pdfParse from 'pdf-parse';

export interface ParsedDocument {
  type: 'pdf' | 'text';
  filename: string;
  text: string;           // extracted text, max 6000 chars
  page_count?: number;
  metadata?: Record<string, string>;
}

export async function parsePDF(buffer: Buffer, filename: string): Promise<ParsedDocument> {
  const data = await pdfParse(buffer, {
    max: 10,  // max 10 pages
  });

  return {
    type: 'pdf',
    filename,
    text: data.text.slice(0, 6000),
    page_count: data.numpages,
    metadata: {
      title: data.info?.Title ?? '',
      author: data.info?.Author ?? '',
      created: data.info?.CreationDate ?? '',
    },
  };
}

export function parseTextFile(buffer: Buffer, filename: string): ParsedDocument {
  return {
    type: 'text',
    filename,
    text: buffer.toString('utf-8').slice(0, 6000),
  };
}
```

### New API endpoint in `src/index.ts`

```typescript
// src/index.ts — add file upload endpoint:

import multer from 'multer';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'text/plain', 'text/markdown'];
    cb(null, allowed.includes(file.mimetype));
  }
});

app.post('/enrich/document',
  requireAuth,
  upload.single('document'),
  async (req: AuthenticatedRequest, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { parsePDF, parseTextFile } = await import('./services/documentParser.js');

    try {
      let result;
      if (req.file.mimetype === 'application/pdf') {
        result = await parsePDF(req.file.buffer, req.file.originalname);
      } else {
        result = parseTextFile(req.file.buffer, req.file.originalname);
      }
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);
```

### Frontend: file upload in `HeroSection.tsx`

```tsx
// Add file upload button to the audit input form

async function handleFileUpload(file: File) {
  const formData = new FormData();
  formData.append('document', file);

  const token = await getAuthToken();
  const res = await fetch(`${API_BASE}/enrich/document`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });

  const { data } = await res.json();

  // Prepend document context to textarea
  setContext(prev => `DOCUMENT: ${data.filename}\n${data.text}\n\n${prev}`.trim());
}

// JSX:
<label className="cursor-pointer flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300">
  <input type="file" className="hidden" accept=".pdf,.txt,.md"
    onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
  <Paperclip size={14} />
  <span>Attach pitch deck or memo</span>
</label>
```

---

## Task 4.3 — Real-Time Market Data APIs

### Install dependencies

```bash
npm install node-fetch
# API keys stored in environment variables
```

### New file: `src/services/marketDataService.ts`

```typescript
// src/services/marketDataService.ts
// Aggregates real-time market signals from multiple sources

export interface MarketSignals {
  news_headlines: Array<{ title: string; source: string; date: string; url: string }>;
  funding_data?: { last_round: string; amount: string; investors: string[] };
  web_traffic?: { monthly_visits: string; growth_trend: string };
  competitor_signals: Array<{ name: string; signal: string; date: string }>;
}

export async function fetchNewsSignals(
  companyName: string,
  industry: string
): Promise<Array<{ title: string; source: string; date: string; url: string }>> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return [];

  const query = encodeURIComponent(`"${companyName}" OR "${industry} startup" OR "${industry} market"`);
  const url = `https://newsapi.org/v2/everything?q=${query}&sortBy=publishedAt&pageSize=5&apiKey=${apiKey}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json() as any;

    return (data.articles ?? []).map((a: any) => ({
      title: a.title,
      source: a.source.name,
      date: a.publishedAt?.slice(0, 10) ?? 'unknown',
      url: a.url,
    }));
  } catch {
    return [];
  }
}

export async function fetchCrunchbaseSignals(
  companyName: string
): Promise<{ last_round?: string; amount?: string; investors?: string[] } | null> {
  const apiKey = process.env.CRUNCHBASE_API_KEY;
  if (!apiKey) return null;

  // Crunchbase Basic API (free tier)
  const encoded = encodeURIComponent(companyName.toLowerCase().replace(/\s+/g, '-'));
  const url = `https://api.crunchbase.com/api/v4/entities/organizations/${encoded}?field_ids=short_description,funding_total,last_funding_type,last_funding_at,investor_identifiers&user_key=${apiKey}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const props = data.properties ?? {};

    return {
      last_round: props.last_funding_type ?? 'unknown',
      amount: props.funding_total?.value_usd
        ? `$${(props.funding_total.value_usd / 1e6).toFixed(1)}M`
        : 'undisclosed',
      investors: (props.investor_identifiers ?? []).slice(0, 5).map((i: any) => i.value),
    };
  } catch {
    return null;
  }
}

// Assemble all signals for injection into discovery context
export async function assembleMarketSignals(
  companyName: string,
  industry: string
): Promise<string> {
  const [news, funding] = await Promise.all([
    fetchNewsSignals(companyName, industry),
    fetchCrunchbaseSignals(companyName),
  ]);

  const parts: string[] = [];

  if (news.length > 0) {
    parts.push('RECENT NEWS:');
    news.forEach(n => parts.push(`- ${n.title} (${n.source}, ${n.date})`));
  }

  if (funding) {
    parts.push('\nFUNDING DATA (Crunchbase):');
    parts.push(`- Last round: ${funding.last_round}, Amount: ${funding.amount}`);
    if (funding.investors?.length) {
      parts.push(`- Investors: ${funding.investors.join(', ')}`);
    }
  }

  return parts.length > 0
    ? `REAL-TIME MARKET SIGNALS:\n${parts.join('\n')}`
    : '';
}
```

### Integration in `src/index.ts` — inject before Discovery Agent

```typescript
// src/index.ts — in the /analyze handler, before running discoveryAgent:

const { assembleMarketSignals } = await import('./services/marketDataService.js');

// Extract company name from context (use interrogator's org name extraction)
const orgName = context.match(/^([A-Z][a-zA-Z\s&]{2,40})/)?.[1]?.trim() ?? '';
const industry = context.match(/\b(saas|fintech|healthtech|edtech|marketplace|ecommerce|logistics)\b/i)?.[0] ?? '';

const marketSignals = await assembleMarketSignals(orgName, industry);

// Enrich the context sent to Discovery Agent:
const enrichedContext = marketSignals
  ? `${context}\n\n${marketSignals}`
  : context;
```

### Environment variables to add

```bash
# .env (backend) — add:
NEWS_API_KEY=your_newsapi_key_here          # newsapi.org (free tier: 100 requests/day)
CRUNCHBASE_API_KEY=your_crunchbase_key      # Crunchbase Basic API (free with account)
JINA_API_KEY=your_jina_key                 # jina.ai reader API (free tier available)
```

---

## Task 4.4 — Industry Benchmark Database

### New file: `src/data/benchmarks.ts`

```typescript
// src/data/benchmarks.ts
// Static benchmark data from public sources (OpenView, Bessemer, SaaStr)
// Update annually

export interface IndustryBenchmarks {
  industry: string;
  stage: 'pre-seed' | 'seed' | 'series-a' | 'series-b' | 'growth';
  ltv_cac_p25: number;
  ltv_cac_p50: number;
  ltv_cac_p75: number;
  gross_margin_p50: number;
  rule_of_40_p50: number;
  annual_churn_p50: number;   // % annual logo churn
  nrr_p50: number;            // net revenue retention %
}

export const BENCHMARKS: IndustryBenchmarks[] = [
  {
    industry: 'b2b-saas',
    stage: 'series-a',
    ltv_cac_p25: 1.8, ltv_cac_p50: 3.2, ltv_cac_p75: 5.1,
    gross_margin_p50: 72,
    rule_of_40_p50: 28,
    annual_churn_p50: 12,
    nrr_p50: 108,
  },
  {
    industry: 'b2b-saas',
    stage: 'series-b',
    ltv_cac_p25: 2.5, ltv_cac_p50: 4.0, ltv_cac_p75: 6.5,
    gross_margin_p50: 74,
    rule_of_40_p50: 35,
    annual_churn_p50: 8,
    nrr_p50: 115,
  },
  {
    industry: 'marketplace',
    stage: 'series-a',
    ltv_cac_p25: 1.5, ltv_cac_p50: 2.8, ltv_cac_p75: 4.2,
    gross_margin_p50: 38,
    rule_of_40_p50: 22,
    annual_churn_p50: 20,
    nrr_p50: 102,
  },
  {
    industry: 'fintech',
    stage: 'series-a',
    ltv_cac_p25: 2.0, ltv_cac_p50: 3.5, ltv_cac_p75: 5.8,
    gross_margin_p50: 55,
    rule_of_40_p50: 24,
    annual_churn_p50: 10,
    nrr_p50: 110,
  },
  {
    industry: 'healthtech',
    stage: 'series-a',
    ltv_cac_p25: 1.8, ltv_cac_p50: 3.0, ltv_cac_p75: 4.5,
    gross_margin_p50: 62,
    rule_of_40_p50: 20,
    annual_churn_p50: 8,
    nrr_p50: 112,
  },
];

export function getBenchmarks(
  industry: string,
  stage: string
): IndustryBenchmarks | null {
  const normalised = industry.toLowerCase().replace(/\s+/g, '-');
  return BENCHMARKS.find(b =>
    b.industry === normalised && b.stage === (stage as any)
  ) ?? BENCHMARKS.find(b => b.industry === normalised) ?? null;
}
```

### Inject benchmarks into `financeAnalyst` context

```typescript
// src/coordinator.ts — when building Phase C context, append benchmarks:

import { getBenchmarks } from './data/benchmarks.js';

// After detecting industry from discovery findings:
const benchmarks = getBenchmarks(detectedIndustry, detectedStage);
const benchmarkContext = benchmarks ? `
INDUSTRY BENCHMARKS (${benchmarks.industry}, ${benchmarks.stage}):
- LTV:CAC P50: ${benchmarks.ltv_cac_p50}:1 (P25: ${benchmarks.ltv_cac_p25}, P75: ${benchmarks.ltv_cac_p75})
- Gross Margin P50: ${benchmarks.gross_margin_p50}%
- Rule of 40 P50: ${benchmarks.rule_of_40_p50}
- Annual Logo Churn P50: ${benchmarks.annual_churn_p50}%
- NRR P50: ${benchmarks.nrr_p50}%
Use these benchmarks to calibrate your scoring and unit economics calculations.
` : '';
```

---

## Phase 4 Completion Checklist

- [ ] `scraperService.ts` uses Jina AI Reader to scrape company URLs
- [ ] `POST /enrich/url` endpoint works and returns structured `ScrapeResult`
- [ ] Frontend URL input field enriches the context textarea
- [ ] `documentParser.ts` extracts text from PDF and TXT files
- [ ] `POST /enrich/document` file upload endpoint works
- [ ] Frontend file attachment button appears in audit input form
- [ ] `marketDataService.ts` fetches from NewsAPI and Crunchbase
- [ ] Market signals are prepended to Discovery Agent context
- [ ] `benchmarks.ts` data file created with 5 industry profiles
- [ ] Benchmarks injected into `financeAnalyst` context
- [ ] `NEWS_API_KEY`, `CRUNCHBASE_API_KEY`, `JINA_API_KEY` documented in `.env.example`
- [ ] All data enrichment is additive (system works without API keys)
