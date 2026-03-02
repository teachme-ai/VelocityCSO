# Phase 4 Tests — Data Enrichment

> **Companion to:** `PHASE_4_DATA_ENRICHMENT.md`
> **Prerequisite:** Phase 1–3 tests passing. Phase 4 tasks complete.
> **Key additions:** URL scraper, document parser, market data APIs, industry benchmarks.
> **Approach:** All external HTTP calls are mocked with `vi.mock(fetch)` — no live API calls in tests.

---

## What This Covers

| Task (Phase 4) | Test File |
|----------------|-----------|
| Task 4.1 — URL scraper (Jina AI) | `src/services/scraperService.test.ts` |
| Task 4.2 — PDF/document parser | `src/services/documentParser.test.ts` |
| Task 4.3 — Market data (NewsAPI + Crunchbase) | `src/services/marketDataService.test.ts` |
| Task 4.4 — Industry benchmarks | `src/data/benchmarks.test.ts` |
| Integration | `src/routes/enrich.integration.test.ts` |

---

## Test File 1: `src/services/scraperService.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScraperService, ScraperResult } from './scraperService';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeJinaResponse(content: string, statusCode = 200) {
  return {
    ok: statusCode >= 200 && statusCode < 300,
    status: statusCode,
    text: async () => content,
    json: async () => ({ content }),
  };
}

describe('ScraperService', () => {
  let scraper: ScraperService;

  beforeEach(() => {
    scraper = new ScraperService({ apiKey: 'test-jina-key' });
    mockFetch.mockClear();
  });

  describe('fetchUrl()', () => {
    it('calls the Jina AI Reader endpoint with the target URL', async () => {
      mockFetch.mockResolvedValueOnce(makeJinaResponse('# Title\nThis is the page content.'));

      await scraper.fetchUrl('https://example.com/about');

      expect(mockFetch).toHaveBeenCalledOnce();
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('r.jina.ai');
      expect(callUrl).toContain('example.com');
    });

    it('returns ScraperResult with text and wordCount', async () => {
      const content = 'Word one two three four five six seven eight nine ten.';
      mockFetch.mockResolvedValueOnce(makeJinaResponse(content));

      const result: ScraperResult = await scraper.fetchUrl('https://example.com');

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('wordCount');
      expect(result.wordCount).toBeGreaterThan(0);
    });

    it('includes Authorization header when API key is provided', async () => {
      mockFetch.mockResolvedValueOnce(makeJinaResponse('content'));

      await scraper.fetchUrl('https://example.com');

      const callOptions = mockFetch.mock.calls[0][1] as RequestInit;
      const headers = callOptions?.headers as Record<string, string>;
      expect(headers?.Authorization).toContain('test-jina-key');
    });

    it('throws a descriptive error on non-200 response', async () => {
      mockFetch.mockResolvedValueOnce(makeJinaResponse('Not Found', 404));

      await expect(scraper.fetchUrl('https://example.com/missing')).rejects.toThrow(/404|not found/i);
    });

    it('throws on invalid (non-http) URL', async () => {
      await expect(scraper.fetchUrl('not-a-url')).rejects.toThrow(/invalid url/i);
    });

    it('throws on file:// URL (security check)', async () => {
      await expect(scraper.fetchUrl('file:///etc/passwd')).rejects.toThrow();
    });

    it('truncates content to MAX_CHARS when response is very large', async () => {
      const hugeContent = 'x'.repeat(200_000);
      mockFetch.mockResolvedValueOnce(makeJinaResponse(hugeContent));

      const result = await scraper.fetchUrl('https://example.com');
      expect(result.text.length).toBeLessThanOrEqual(50_000); // reasonable cap
      expect(result.truncated).toBe(true);
    });
  });
});
```

---

## Test File 2: `src/services/documentParser.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { DocumentParser } from './documentParser';

// Mock pdf-parse to avoid binary parsing in tests
vi.mock('pdf-parse', () => ({
  default: vi.fn().mockImplementation(async (buffer: Buffer) => {
    if (buffer.toString().includes('CORRUPTED')) {
      throw new Error('Invalid PDF structure');
    }
    return {
      text: 'Extracted PDF text content here. Revenue grew 40% YoY. Team of 25 people.',
      numpages: 3,
      info: { Title: 'Business Overview' },
    };
  }),
}));

describe('DocumentParser', () => {
  let parser: DocumentParser;

  beforeEach(() => {
    parser = new DocumentParser();
  });

  describe('parsePDF()', () => {
    it('extracts text from a valid PDF buffer', async () => {
      const fakeBuffer = Buffer.from('valid PDF content');
      const result = await parser.parsePDF(fakeBuffer);
      expect(result.text).toContain('Extracted PDF text content');
    });

    it('returns page count from PDF metadata', async () => {
      const fakeBuffer = Buffer.from('valid PDF content');
      const result = await parser.parsePDF(fakeBuffer);
      expect(result.pageCount).toBe(3);
    });

    it('returns word count', async () => {
      const fakeBuffer = Buffer.from('valid PDF content');
      const result = await parser.parsePDF(fakeBuffer);
      expect(result.wordCount).toBeGreaterThan(0);
    });

    it('throws gracefully on corrupted PDF', async () => {
      const corruptedBuffer = Buffer.from('CORRUPTED binary data');
      await expect(parser.parsePDF(corruptedBuffer)).rejects.toThrow(/invalid pdf|parse error/i);
    });

    it('truncates very long extracted text to MAX_CHARS', async () => {
      const { default: pdfParse } = await import('pdf-parse');
      (pdfParse as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        text: 'word '.repeat(30_000), // 150,000 chars
        numpages: 100,
        info: {},
      });

      const result = await parser.parsePDF(Buffer.from('big PDF'));
      expect(result.text.length).toBeLessThanOrEqual(50_000);
      expect(result.truncated).toBe(true);
    });

    it('returns empty text without throwing for empty PDF', async () => {
      const { default: pdfParse } = await import('pdf-parse');
      (pdfParse as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        text: '',
        numpages: 0,
        info: {},
      });

      const result = await parser.parsePDF(Buffer.from('empty'));
      expect(result.text).toBe('');
      expect(result.wordCount).toBe(0);
    });
  });
});
```

---

## Test File 3: `src/services/marketDataService.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketDataService, MarketDataResult } from './marketDataService';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeNewsApiResponse(articles: unknown[] = []) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      status: 'ok',
      totalResults: articles.length,
      articles,
    }),
  };
}

function makeCrunchbaseResponse(data: unknown = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data }),
  };
}

const mockArticles = [
  { title: 'Market grows 30%', description: 'Strong Q1 results', url: 'https://techcrunch.com/1', publishedAt: '2025-11-01T00:00:00Z', source: { name: 'TechCrunch' } },
  { title: 'New competitor launches', description: 'Startup raises $10M', url: 'https://techcrunch.com/2', publishedAt: '2025-10-15T00:00:00Z', source: { name: 'TechCrunch' } },
];

describe('MarketDataService', () => {
  let service: MarketDataService;

  beforeEach(() => {
    service = new MarketDataService({
      newsApiKey: 'test-news-key',
      crunchbaseApiKey: 'test-cb-key',
    });
    mockFetch.mockClear();
    service.clearCache(); // reset in-memory cache between tests
  });

  describe('fetchNews()', () => {
    it('calls NewsAPI with the query string', async () => {
      mockFetch.mockResolvedValueOnce(makeNewsApiResponse(mockArticles));

      await service.fetchNews('SaaS analytics startups');

      expect(mockFetch).toHaveBeenCalledOnce();
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('newsapi.org');
      expect(url).toContain('SaaS');
    });

    it('returns articles with title, url, and publishedAt', async () => {
      mockFetch.mockResolvedValueOnce(makeNewsApiResponse(mockArticles));

      const result = await service.fetchNews('test');
      expect(result.articles.length).toBeGreaterThan(0);
      for (const article of result.articles) {
        expect(article).toHaveProperty('title');
        expect(article).toHaveProperty('url');
        expect(article).toHaveProperty('publishedAt');
      }
    });

    it('returns empty articles array gracefully when NEWS_API_KEY is absent', async () => {
      const serviceNoKey = new MarketDataService({ newsApiKey: undefined, crunchbaseApiKey: undefined });
      const result = await serviceNoKey.fetchNews('test');
      expect(result.articles).toEqual([]);
    });

    it('caches results — second call does not hit the API', async () => {
      mockFetch.mockResolvedValueOnce(makeNewsApiResponse(mockArticles));

      await service.fetchNews('cached query');
      await service.fetchNews('cached query'); // second call should use cache

      expect(mockFetch).toHaveBeenCalledOnce(); // only 1 fetch, not 2
    });

    it('refreshes cache after TTL expires', async () => {
      vi.useFakeTimers();
      mockFetch.mockResolvedValue(makeNewsApiResponse(mockArticles));

      await service.fetchNews('ttl query');
      vi.advanceTimersByTime(16 * 60 * 1000); // advance 16 minutes (beyond 15-min TTL)
      await service.fetchNews('ttl query');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });
  });

  describe('fetchCrunchbase()', () => {
    it('calls Crunchbase API with the company name', async () => {
      mockFetch.mockResolvedValueOnce(makeCrunchbaseResponse({ total_funding: 5_000_000 }));

      await service.fetchCrunchbase('Acme Corp');

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('crunchbase');
    });

    it('returns empty result gracefully when CRUNCHBASE_API_KEY is absent', async () => {
      const serviceNoKey = new MarketDataService({ newsApiKey: undefined, crunchbaseApiKey: undefined });
      const result = await serviceNoKey.fetchCrunchbase('test');
      expect(result).toEqual({});
    });
  });
});
```

---

## Test File 4: `src/data/benchmarks.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { getBenchmarks, INDUSTRY_TYPES, IndustryBenchmark } from './benchmarks';

// benchmarks.ts is pure static data — no mocking needed

describe('getBenchmarks()', () => {
  it('returns a benchmark object for a known industry', () => {
    const result = getBenchmarks('b2b_saas');
    expect(result).toBeDefined();
    expect(result).not.toBeNull();
  });

  it('returns a generic fallback for unknown industry types', () => {
    const result = getBenchmarks('unknown_industry_xyz');
    expect(result).toBeDefined();
    expect(result.isGeneric).toBe(true);
  });

  it('every known industry type has a benchmark entry', () => {
    for (const industry of INDUSTRY_TYPES) {
      const result = getBenchmarks(industry);
      expect(result, `Missing benchmark for ${industry}`).toBeDefined();
    }
  });

  describe('b2b_saas benchmarks', () => {
    let bench: IndustryBenchmark;

    beforeEach(() => {
      bench = getBenchmarks('b2b_saas');
    });

    it('has ltv_cac ratio benchmark', () => {
      expect(bench).toHaveProperty('ltv_cac');
      expect(bench.ltv_cac).toBeGreaterThan(0);
    });

    it('has arr_growth_rate benchmark', () => {
      expect(bench).toHaveProperty('arr_growth_rate');
      expect(bench.arr_growth_rate).toBeGreaterThan(0);
      expect(bench.arr_growth_rate).toBeLessThanOrEqual(200); // sanity check %
    });

    it('has gross_margin benchmark', () => {
      expect(bench).toHaveProperty('gross_margin');
      expect(bench.gross_margin).toBeGreaterThan(0);
      expect(bench.gross_margin).toBeLessThanOrEqual(100);
    });

    it('has burn_multiple benchmark', () => {
      expect(bench).toHaveProperty('burn_multiple');
    });

    it('has rule_of_40 benchmark', () => {
      expect(bench).toHaveProperty('rule_of_40');
    });
  });

  describe('marketplace benchmarks', () => {
    it('has take_rate field specific to marketplaces', () => {
      const bench = getBenchmarks('marketplace');
      expect(bench).toHaveProperty('take_rate');
    });
  });

  describe('all industry benchmarks', () => {
    it('all benchmarks have ltv_cac, arr_growth_rate, and gross_margin', () => {
      for (const industry of INDUSTRY_TYPES) {
        const bench = getBenchmarks(industry);
        expect(bench, `${industry} missing ltv_cac`).toHaveProperty('ltv_cac');
        expect(bench, `${industry} missing arr_growth_rate`).toHaveProperty('arr_growth_rate');
        expect(bench, `${industry} missing gross_margin`).toHaveProperty('gross_margin');
      }
    });
  });
});
```

---

## Test File 5: `src/routes/enrich.integration.test.ts`

```typescript
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock external services before importing app
vi.mock('../services/scraperService', () => ({
  ScraperService: vi.fn().mockImplementation(() => ({
    fetchUrl: vi.fn().mockResolvedValue({
      text: 'Scraped content from the page',
      wordCount: 250,
      truncated: false,
    }),
  })),
}));

vi.mock('../services/documentParser', () => ({
  DocumentParser: vi.fn().mockImplementation(() => ({
    parsePDF: vi.fn().mockResolvedValue({
      text: 'Extracted PDF text',
      wordCount: 120,
      pageCount: 2,
      truncated: false,
    }),
  })),
}));

// Mock auth middleware to auto-pass in test
vi.mock('../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: () => void) => {
    req.user = { uid: 'test-uid' };
    next();
  },
}));

describe('POST /enrich/url (integration)', () => {
  let app: express.Application;

  beforeAll(async () => {
    const { createApp } = await import('../index');
    app = createApp();
  });

  it('returns 200 with scraped content for a valid URL', async () => {
    const res = await request(app)
      .post('/enrich/url')
      .set('Authorization', 'Bearer test-token')
      .send({ url: 'https://example.com/about' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('text');
    expect(res.body.text).toContain('Scraped content');
  });

  it('returns 400 for a missing URL body', async () => {
    const res = await request(app)
      .post('/enrich/url')
      .set('Authorization', 'Bearer test-token')
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    // Un-mock auth for this test
    const res = await request(app)
      .post('/enrich/url')
      .send({ url: 'https://example.com' });

    expect(res.status).toBe(401);
  });
});

describe('POST /enrich/document (integration)', () => {
  let app: express.Application;

  beforeAll(async () => {
    const { createApp } = await import('../index');
    app = createApp();
  });

  it('returns 200 with parsed text for a valid PDF upload', async () => {
    // Create a minimal fake PDF buffer
    const fakeBuffer = Buffer.from('%PDF-1.4 fake content');

    const res = await request(app)
      .post('/enrich/document')
      .set('Authorization', 'Bearer test-token')
      .attach('document', fakeBuffer, 'pitch-deck.pdf');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('text');
  });

  it('returns 400 when no file is attached', async () => {
    const res = await request(app)
      .post('/enrich/document')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(400);
  });
});
```

---

## Coverage Targets — Phase 4

| File | Target |
|------|--------|
| `src/services/scraperService.ts` | 90% |
| `src/services/documentParser.ts` | 90% |
| `src/services/marketDataService.ts` | 85% |
| `src/data/benchmarks.ts` | 100% (pure data) |
| Enrich endpoints in `src/index.ts` | 80% |

---

## How to Run Phase 4 Tests

```bash
# Install multer types if not already present
npm install -D @types/multer

npx vitest run \
  src/services/scraperService.test.ts \
  src/services/documentParser.test.ts \
  src/services/marketDataService.test.ts \
  src/data/benchmarks.test.ts \
  src/routes/enrich.integration.test.ts
```

---

## AG Prompt — Phase 4 Tests

```
I've completed Phase 4 of VelocityCSO (PHASE_4_DATA_ENRICHMENT.md).
Now I need the test suite from PHASE_4_TESTS.md.

Key requirement: ALL external HTTP calls (Jina AI, NewsAPI, Crunchbase)
must be mocked — no live API calls. Use vi.stubGlobal('fetch', mockFetch).

Testing setup: plans/TESTING_STRATEGY.md
Test plan: plans/PHASE_4_TESTS.md
Source files:
  - src/services/scraperService.ts
  - src/services/documentParser.ts
  - src/services/marketDataService.ts
  - src/data/benchmarks.ts

Read each source file, then implement the tests. The benchmarks tests require
no mocking and should run immediately. Run npm test and fix failures.
```
