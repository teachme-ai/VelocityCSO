// src/services/scraperService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scrapeCompanyUrl } from './scraperService.js';

// Mock the logger to avoid polluting test output
vi.mock('./logger.js', () => ({
    log: vi.fn()
}));

describe('scraperService', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        // Mock global fetch
        vi.stubGlobal('fetch', vi.fn());
    });

    it('should successfully scrape and parse a URL', async () => {
        const mockMarkdown = `
# Acme Corp
This is a comprehensive platform for building better widgets.

## Features
- Widget Builder
- Analytics Dashboard

## Pricing
- Pro: $25/mo
- Enterprise: custom

## Team
- Jane Doe, CEO
- John Smith, CTO

Built with React and Vercel.
        `;

        const mockResponse = {
            ok: true,
            status: 200,
            text: async () => mockMarkdown,
        };

        (global.fetch as any).mockResolvedValue(mockResponse);

        const result = await scrapeCompanyUrl('https://acme.com');

        expect(result.url).toBe('https://acme.com/');
        expect(result.title).toBe('Acme Corp');
        expect(result.description).toContain('comprehensive platform');
        expect(result.product_pages[0]).toContain('Widget Builder');
        expect(result.pricing_signals[0]).toContain('Pro: $25/mo');
        expect(result.team_signals[0]).toContain('Jane Doe, CEO');
        expect(result.technology_signals).toContain('react');
        expect(result.technology_signals).toContain('vercel');
    });

    it('should handle invalid URLs', async () => {
        // Use a truly invalid URL that new URL() will reject even with https:// prepended
        await expect(scrapeCompanyUrl(' !!! ')).rejects.toThrow('Invalid URL');
    });

    it('should handle fetch errors', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: false,
            status: 404
        });

        await expect(scrapeCompanyUrl('https://missing.com')).rejects.toThrow('Scrape failed: 404');
    });

    it('should handle timeout or network failure', async () => {
        (global.fetch as any).mockRejectedValue(new Error('Network error'));
        await expect(scrapeCompanyUrl('https://fail.com')).rejects.toThrow('Network error');
    });
});
