// src/services/marketDataService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchNewsSignals, fetchCrunchbaseSignals, assembleMarketSignals } from './marketDataService.js';

vi.mock('./logger.js', () => ({
    log: vi.fn()
}));

describe('marketDataService', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.stubGlobal('fetch', vi.fn());
        process.env.NEWS_API_KEY = 'test-news-key';
        process.env.CRUNCHBASE_API_KEY = 'test-cb-key';
    });

    describe('fetchNewsSignals', () => {
        it('should fetch and format news articles', async () => {
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({
                    articles: [
                        { title: 'Test News', source: { name: 'BBC' }, publishedAt: '2024-03-01T12:00:00Z', url: 'https://test.com' }
                    ]
                })
            });

            const result = await fetchNewsSignals('Acme', 'SaaS');
            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('Test News');
            expect(result[0].source).toBe('BBC');
            expect(result[0].date).toBe('2024-03-01');
        });

        it('should return empty array if API key is missing', async () => {
            delete process.env.NEWS_API_KEY;
            const result = await fetchNewsSignals('Acme', 'SaaS');
            expect(result).toEqual([]);
        });
    });

    describe('fetchCrunchbaseSignals', () => {
        it('should fetch and format funding data', async () => {
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({
                    properties: {
                        last_funding_type: 'series_a',
                        funding_total: { value_usd: 12500000 },
                        investor_identifiers: [{ value: 'Sequoia' }, { value: 'Accel' }]
                    }
                })
            });

            const result = await fetchCrunchbaseSignals('Acme');
            expect(result?.last_round).toBe('series_a');
            expect(result?.amount).toBe('$12.5M');
            expect(result?.investors).toContain('Sequoia');
        });

        it('should return null if API key is missing', async () => {
            delete process.env.CRUNCHBASE_API_KEY;
            const result = await fetchCrunchbaseSignals('Acme');
            expect(result).toBeNull();
        });
    });

    describe('assembleMarketSignals', () => {
        it('should combine news and funding into a block of text', async () => {
            // Mock both fetches
            (global.fetch as any)
                .mockResolvedValueOnce({ // News
                    ok: true,
                    json: async () => ({
                        articles: [{ title: 'News 1', source: { name: 'S1' }, publishedAt: '2024-01-01', url: 'u1' }]
                    })
                })
                .mockResolvedValueOnce({ // Crunchbase
                    ok: true,
                    json: async () => ({
                        properties: { last_funding_type: 'Seed', funding_total: { value_usd: 1000000 } }
                    })
                });

            const result = await assembleMarketSignals('Acme', 'SaaS');
            expect(result).toContain('--- REAL-TIME MARKET SIGNALS ---');
            expect(result).toContain('RECENT NEWS HEADLINES:');
            expect(result).toContain('FUNDING DATA (Crunchbase):');
            expect(result).toContain('Seed');
            expect(result).toContain('$1.0M');
        });

        it('should return empty string if no inputs provided', async () => {
            const result = await assembleMarketSignals('', '');
            expect(result).toBe('');
        });
    });
});
