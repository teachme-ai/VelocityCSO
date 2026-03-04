// src/routes/enrich.integration.test.ts
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock everything before importing the app
vi.mock('@google/adk', () => ({
    LlmAgent: vi.fn().mockImplementation(() => ({})),
    InMemoryRunner: vi.fn().mockImplementation(() => ({})),
    isFinalResponse: vi.fn(),
    GOOGLE_SEARCH: 'google_search_tool_id'
}));

vi.mock('../services/logger.js', () => ({
    log: vi.fn(),
    tlog: vi.fn(),
}));

vi.mock('../services/scraperService.js', () => ({
    scrapeCompanyUrl: vi.fn().mockResolvedValue({
        success: true,
        data: { title: 'Mock Scrape', raw_text: 'Scraped content' }
    }),
}));

vi.mock('../services/documentParser.js', () => ({
    parsePDF: vi.fn().mockResolvedValue({ type: 'pdf', text: 'Mock PDF Content' }),
    parseTextFile: vi.fn().mockReturnValue({ type: 'text', text: 'Mock Text Content' }),
}));

// Mock auth middleware to pass
vi.mock('../middleware/auth.js', () => ({
    authMiddleware: (req: any, res: any, next: any) => {
        req.user = { uid: 'test-user' };
        next();
    }
}));

describe('Enrichment Endpoints (Integration)', () => {
    let app: express.Application;

    beforeAll(async () => {
        // Need to import the app after mocks are established
        const { app: mainApp } = await import('../index.js');
        app = mainApp;
    });

    describe('POST /enrich/url', () => {
        it('should return 200 and scraped data for valid URL', async () => {
            const res = await request(app)
                .post('/enrich/url')
                .send({ url: 'https://example.com' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.data.title).toBe('Mock Scrape');
        });

        it('should return 400 for missing url', async () => {
            const res = await request(app)
                .post('/enrich/url')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('url is required');
        });
    });

    describe('POST /enrich/document', () => {
        it('should return 200 and parsed data for PDF upload', async () => {
            const res = await request(app)
                .post('/enrich/document')
                .attach('document', Buffer.from('fake-pdf'), 'test.pdf');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.text).toBe('Mock PDF Content');
        });

        it('should return 200 and parsed data for text upload', async () => {
            const res = await request(app)
                .post('/enrich/document')
                .attach('document', Buffer.from('fake-text'), 'test.txt');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.text).toBe('Mock Text Content');
        });

        it('should return 400 when no file is uploaded', async () => {
            const res = await request(app)
                .post('/enrich/document');

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('No file uploaded or invalid format');
        });
    });
});
