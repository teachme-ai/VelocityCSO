// src/services/benchmarkService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBenchmarkForSector } from './benchmarkService.js';
import { promises as fs } from 'fs';

// Mock fs
vi.mock('fs', () => ({
    promises: {
        readFile: vi.fn()
    }
}));

describe('benchmarkService', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should load benchmarks and return sector data', async () => {
        const mockBenchmarks = {
            'Saas': {
                avg_cac_payback_months: 12,
                avg_ltv_cac: 4,
                avg_churn_rate: 0.03,
                growth_benchmark_top_quartile: 0.8,
                market_multiple_range: [10, 15]
            }
        };

        (fs.readFile as any).mockResolvedValue(JSON.stringify(mockBenchmarks));

        // Test with different casing
        const result = await getBenchmarkForSector('saas');

        expect(result.avg_cac_payback_months).toBe(12);
        expect(result.avg_ltv_cac).toBe(4);
        expect(result.market_multiple_range).toEqual([10, 15]);
    });

    it('should return default benchmarks if sector not found', async () => {
        const mockBenchmarks = {
            'Default': {
                avg_cac_payback_months: 15,
                avg_ltv_cac: 3,
                avg_churn_rate: 0.05,
                growth_benchmark_top_quartile: 0.5,
                market_multiple_range: [5, 10]
            }
        };

        (fs.readFile as any).mockResolvedValue(JSON.stringify(mockBenchmarks));

        const result = await getBenchmarkForSector('UnknownSector');
        expect(result.avg_cac_payback_months).toBe(15);
    });

    it('should return hardcoded defaults if file loading fails', async () => {
        (fs.readFile as any).mockRejectedValue(new Error('File not found'));

        const result = await getBenchmarkForSector('any');
        expect(result.avg_cac_payback_months).toBe(15); // Fallback in the code
        expect(result.avg_ltv_cac).toBe(3);
    });
});
