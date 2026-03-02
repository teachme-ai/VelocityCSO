# Phase 5 Tests — Product Features

> **Companion to:** `PHASE_5_PRODUCT_FEATURES.md`
> **Prerequisite:** Phase 1–4 tests passing. Phase 5 tasks complete.
> **Key additions:** Audit history, share tokens, PDF quality fixes, email digests.

---

## What This Covers

| Task (Phase 5) | Test File |
|----------------|-----------|
| Task 5.1 — Audit history & trend | `src/routes/history.test.ts` |
| Task 5.3 — Share token generation | `src/services/shareService.test.ts` |
| Task 5.4 — PDF quality (Unicode, REGULATORY, ToC) | `src/services/pdfService.test.ts` |
| Task 5.5 — Email digest | `src/services/emailService.test.ts` |
| Frontend | `frontend/src/components/ActionRoadmap.test.tsx` |

---

## Test File 1: `src/routes/history.test.ts`

```typescript
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';

// Mock Firestore memory service
vi.mock('../services/memory', () => ({
  listAuditReports: vi.fn().mockResolvedValue([
    {
      id: 'audit-001',
      orgId: 'org-001',
      overallScore: 72,
      createdAt: '2025-11-01T10:00:00Z',
      businessContext: 'B2B SaaS analytics tool',
    },
    {
      id: 'audit-002',
      orgId: 'org-001',
      overallScore: 78,
      createdAt: '2025-12-01T10:00:00Z',
      businessContext: 'B2B SaaS analytics tool',
    },
  ]),
  getAuditTrend: vi.fn().mockResolvedValue({
    fingerprint: 'saas-analytics',
    scores: [
      { date: '2025-11-01', score: 72 },
      { date: '2025-12-01', score: 78 },
    ],
    delta: +6,
    trend: 'improving',
  }),
}));

vi.mock('../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: () => void) => {
    req.user = { uid: 'user-001', orgId: 'org-001' };
    next();
  },
}));

describe('GET /history/:orgId', () => {
  let app: any;

  beforeAll(async () => {
    const { createApp } = await import('../index');
    app = createApp();
  });

  it('returns 200 with a list of audits for the org', async () => {
    const res = await request(app)
      .get('/history/org-001')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.audits)).toBe(true);
    expect(res.body.audits.length).toBeGreaterThan(0);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/history/org-001');
    expect(res.status).toBe(401);
  });

  it('each audit in the list has id, overallScore, and createdAt', async () => {
    const res = await request(app)
      .get('/history/org-001')
      .set('Authorization', 'Bearer test-token');

    for (const audit of res.body.audits) {
      expect(audit).toHaveProperty('id');
      expect(audit).toHaveProperty('overallScore');
      expect(audit).toHaveProperty('createdAt');
    }
  });

  it('returns empty audits array for a new org', async () => {
    const { listAuditReports } = await import('../services/memory');
    (listAuditReports as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/history/new-org-999')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.audits).toEqual([]);
  });
});

describe('GET /history/:orgId/trend/:fingerprint', () => {
  let app: any;

  beforeAll(async () => {
    const { createApp } = await import('../index');
    app = createApp();
  });

  it('returns trend data with scores array and delta', async () => {
    const res = await request(app)
      .get('/history/org-001/trend/saas-analytics')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('scores');
    expect(res.body).toHaveProperty('delta');
    expect(res.body).toHaveProperty('trend');
  });

  it('trend value is one of: improving, declining, stable', async () => {
    const res = await request(app)
      .get('/history/org-001/trend/saas-analytics')
      .set('Authorization', 'Bearer test-token');

    expect(['improving', 'declining', 'stable']).toContain(res.body.trend);
  });
});
```

---

## Test File 2: `src/services/shareService.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { generateShareToken, validateShareToken } from './shareService';

// Mock Firestore for token persistence
vi.mock('../services/memory', () => ({
  saveShareToken: vi.fn().mockResolvedValue(undefined),
  getShareToken: vi.fn().mockImplementation(async (token: string) => {
    if (token === 'valid-share-token-32chars-abcd') {
      return { reportId: 'audit-001', expiresAt: new Date(Date.now() + 3600_000).toISOString() };
    }
    return null;
  }),
}));

describe('generateShareToken()', () => {
  it('returns a string of exactly 32 characters', async () => {
    const token = await generateShareToken('audit-001');
    expect(typeof token).toBe('string');
    expect(token.length).toBe(32);
  });

  it('generates unique tokens for repeated calls', async () => {
    const tokens = await Promise.all(
      Array.from({ length: 100 }, () => generateShareToken('audit-001'))
    );
    const unique = new Set(tokens);
    expect(unique.size).toBe(100); // all 100 tokens must be unique
  });

  it('token consists only of URL-safe characters (hex or base64url)', async () => {
    const token = await generateShareToken('audit-001');
    expect(token).toMatch(/^[a-zA-Z0-9_-]+$/);
  });

  it('calls saveShareToken with the reportId and generated token', async () => {
    const { saveShareToken } = await import('../services/memory');
    await generateShareToken('audit-XYZ');
    expect(saveShareToken).toHaveBeenCalledWith(
      expect.any(String), // token
      expect.objectContaining({ reportId: 'audit-XYZ' })
    );
  });
});

describe('validateShareToken()', () => {
  it('returns the reportId for a valid token', async () => {
    const result = await validateShareToken('valid-share-token-32chars-abcd');
    expect(result).toMatchObject({ reportId: 'audit-001' });
  });

  it('returns null for an invalid/unknown token', async () => {
    const result = await validateShareToken('completely-made-up-token-xx99');
    expect(result).toBeNull();
  });

  it('returns null for an expired token', async () => {
    const { getShareToken } = await import('../services/memory');
    (getShareToken as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      reportId: 'audit-002',
      expiresAt: new Date(Date.now() - 1000).toISOString(), // expired 1 second ago
    });

    const result = await validateShareToken('expired-token-string');
    expect(result).toBeNull();
  });
});
```

---

## Test File 3: `src/services/pdfService.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { generatePDF, sanitizeText } from './pdfService';
import { makeAuditReport } from '../__tests__/factories/auditFactory';

// Mock PDFKit to avoid binary output in tests
vi.mock('pdfkit', () => {
  const events: Record<string, ((...args: unknown[]) => void)[]> = {};
  const chunks: Buffer[] = [];

  return {
    default: vi.fn().mockImplementation(() => ({
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        events[event] = events[event] || [];
        events[event].push(cb);
      }),
      end: vi.fn(() => {
        events['end']?.[0]?.();
      }),
      pipe: vi.fn(),
      text: vi.fn().mockReturnThis(),
      fontSize: vi.fn().mockReturnThis(),
      font: vi.fn().mockReturnThis(),
      moveDown: vi.fn().mockReturnThis(),
      addPage: vi.fn().mockReturnThis(),
      image: vi.fn().mockReturnThis(),
    })),
  };
});

describe('sanitizeText()', () => {
  it('preserves standard ASCII characters', () => {
    expect(sanitizeText('Hello World 123!')).toBe('Hello World 123!');
  });

  it('preserves Unicode accented characters (é, ü, ñ)', () => {
    // Phase 5 Task 5.4: fix strips all non-ASCII
    const input = 'Ré­su­mé — Über­ra­schung — Niño';
    const result = sanitizeText(input);
    expect(result).toContain('é');
    expect(result).toContain('ü');
    expect(result).toContain('ñ');
  });

  it('preserves common business symbols (%, $, €, £)', () => {
    const input = 'Revenue grew 40% to $2M (€1.8M / £1.5M)';
    const result = sanitizeText(input);
    expect(result).toContain('%');
    expect(result).toContain('$');
    expect(result).toContain('€');
    expect(result).toContain('£');
  });

  it('removes control characters that break PDF generation', () => {
    const input = 'Clean text\x00\x01\x02\x1F with control chars';
    const result = sanitizeText(input);
    expect(result).not.toMatch(/[\x00-\x08\x0E-\x1F]/);
    expect(result).toContain('Clean text');
  });

  it('preserves Chinese/Japanese characters in company names', () => {
    const input = 'Company: 阿里巴巴 (Alibaba)';
    const result = sanitizeText(input);
    expect(result).toContain('阿里巴巴');
  });
});

describe('generatePDF()', () => {
  it('resolves to a Buffer', async () => {
    const report = makeAuditReport({ overallScore: 72 });
    const buffer = await generatePDF(report);
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  it('includes REGULATORY scenario in stress test section', async () => {
    // Phase 5 Task 5.4: REGULATORY was previously missing from PDF
    const report = makeAuditReport({
      stressResults: {
        RECESSION: { overallImpact: -15, recommendations: ['Cut burn'] },
        PRICE_WAR: { overallImpact: -20, recommendations: ['Deepen moat'] },
        SCALE_UP: { overallImpact: +10, recommendations: ['Hire fast'] },
        TALENT: { overallImpact: -8, recommendations: ['Build bench'] },
        REGULATORY: { overallImpact: -12, recommendations: ['Engage lobbyists'] },
      },
    });

    // Track which sections were written
    const { default: PDFDocument } = await import('pdfkit');
    const mockDoc = (PDFDocument as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    const textCalls = (mockDoc?.text as ReturnType<typeof vi.fn>)?.mock.calls ?? [];

    await generatePDF(report);

    const allText = textCalls.flat().join(' ').toLowerCase();
    expect(allText).toContain('regulatory');
  });
});
```

---

## Test File 4: `src/services/emailService.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailService } from './emailService';

const mockSend = vi.fn().mockResolvedValue([{ statusCode: 202, body: 'Accepted' }]);

vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: vi.fn(),
    send: mockSend,
  },
}));

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(() => {
    service = new EmailService({ apiKey: 'SG.test-key' });
    mockSend.mockClear();
  });

  describe('sendDigest()', () => {
    const mockDigestPayload = {
      to: 'cso@company.com',
      orgName: 'Acme Corp',
      auditId: 'audit-001',
      overallScore: 72,
      topRecommendations: [
        'Strengthen competitive moat through data network effects',
        'Improve unit economics: current LTV:CAC is 2.1, target 3+',
      ],
      auditUrl: 'https://velocitycso.com/report/audit-001',
    };

    it('calls SendGrid send() with the recipient email', async () => {
      await service.sendDigest(mockDigestPayload);
      expect(mockSend).toHaveBeenCalledOnce();
      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.to).toBe('cso@company.com');
    });

    it('includes audit score in the email body', async () => {
      await service.sendDigest(mockDigestPayload);
      const callArgs = mockSend.mock.calls[0][0];
      const body = callArgs.html || callArgs.text || '';
      expect(body).toContain('72');
    });

    it('includes a link to the full report', async () => {
      await service.sendDigest(mockDigestPayload);
      const callArgs = mockSend.mock.calls[0][0];
      const body = callArgs.html || callArgs.text || '';
      expect(body).toContain('audit-001');
    });

    it('does not throw and does not call SendGrid when SENDGRID_API_KEY is absent', async () => {
      const serviceNoKey = new EmailService({ apiKey: undefined });
      await expect(serviceNoKey.sendDigest(mockDigestPayload)).resolves.not.toThrow();
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('email subject includes the org name', async () => {
      await service.sendDigest(mockDigestPayload);
      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.subject).toContain('Acme Corp');
    });
  });
});
```

---

## Test File 5: `frontend/src/components/ActionRoadmap.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ActionRoadmap } from '../components/ActionRoadmap';

const mockRoadmap = {
  period1: {
    label: 'Days 1-30',
    actions: [
      { id: 'a1', title: 'Commission TAM analysis', owner: 'CEO', metric: 'TAM report delivered', whyNow: 'Investor due diligence in 45 days' },
      { id: 'a2', title: 'Hire Head of Product', owner: 'CEO', metric: 'Offer accepted', whyNow: 'Product roadmap blocked' },
    ],
  },
  period2: {
    label: 'Days 31-60',
    actions: [
      { id: 'b1', title: 'Launch referral programme', owner: 'CMO', metric: '50 referrals', whyNow: 'CAC reduction target' },
    ],
  },
  period3: {
    label: 'Days 61-90',
    actions: [
      { id: 'c1', title: 'Close Series A', owner: 'CFO', metric: '$5M raised', whyNow: '18-month runway target' },
    ],
  },
};

describe('ActionRoadmap', () => {
  it('renders all three period labels', () => {
    render(<ActionRoadmap roadmap={mockRoadmap} />);
    expect(screen.getByText(/Days 1-30/i)).toBeInTheDocument();
    expect(screen.getByText(/Days 31-60/i)).toBeInTheDocument();
    expect(screen.getByText(/Days 61-90/i)).toBeInTheDocument();
  });

  it('renders all action titles', () => {
    render(<ActionRoadmap roadmap={mockRoadmap} />);
    expect(screen.getByText(/Commission TAM analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/Hire Head of Product/i)).toBeInTheDocument();
    expect(screen.getByText(/Close Series A/i)).toBeInTheDocument();
  });

  it('renders owner for each action', () => {
    render(<ActionRoadmap roadmap={mockRoadmap} />);
    expect(screen.getByText(/CEO/)).toBeInTheDocument();
    expect(screen.getByText(/CMO/)).toBeInTheDocument();
    expect(screen.getByText(/CFO/)).toBeInTheDocument();
  });

  it('allows marking an action as complete', () => {
    render(<ActionRoadmap roadmap={mockRoadmap} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).not.toBeChecked();
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).toBeChecked();
  });

  it('persists completed state to localStorage', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    render(<ActionRoadmap roadmap={mockRoadmap} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(setItemSpy).toHaveBeenCalled();
    setItemSpy.mockRestore();
  });

  it('renders gracefully with empty roadmap', () => {
    expect(() => render(<ActionRoadmap roadmap={null as any} />)).not.toThrow();
  });
});
```

---

## Coverage Targets — Phase 5

| File | Target |
|------|--------|
| `src/services/shareService.ts` | **100%** |
| `src/services/pdfService.ts` (sanitizeText) | **100%** |
| `src/services/emailService.ts` | 90% |
| History endpoints | 85% |
| `frontend/src/components/ActionRoadmap.tsx` | 80% |

---

## How to Run Phase 5 Tests

```bash
npx vitest run \
  src/routes/history.test.ts \
  src/services/shareService.test.ts \
  src/services/pdfService.test.ts \
  src/services/emailService.test.ts

cd frontend && npx vitest run src/components/ActionRoadmap.test.tsx
```

---

## AG Prompt — Phase 5 Tests

```
I've completed Phase 5 of VelocityCSO (PHASE_5_PRODUCT_FEATURES.md).
Now I need the test suite from PHASE_5_TESTS.md.

CRITICAL: The sanitizeText() tests in pdfService.test.ts validate that
Unicode characters (é, ü, ñ, €, 中文) are preserved. If these tests fail,
the Phase 5 fix was not correctly implemented.

Testing setup: plans/TESTING_STRATEGY.md
Test plan: plans/PHASE_5_TESTS.md
Source files:
  - src/routes/history endpoints in src/index.ts
  - src/services/shareService.ts
  - src/services/pdfService.ts
  - src/services/emailService.ts
  - frontend/src/components/ActionRoadmap.tsx

Run npm test and confirm all sanitizeText Unicode tests pass.
```
