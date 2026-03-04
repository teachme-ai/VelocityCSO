// src/services/benchmarkService.ts
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface BenchmarkData {
    avg_cac_payback_months: number;
    avg_ltv_cac: number;
    avg_churn_rate: number;
    growth_benchmark_top_quartile: number;
    market_multiple_range: [number, number];
}

let benchmarks: Record<string, BenchmarkData> | null = null;

async function loadBenchmarks() {
    if (benchmarks) return benchmarks;
    const filePath = path.join(__dirname, '../../data/benchmarks.json');
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        benchmarks = JSON.parse(data);
        return benchmarks;
    } catch (err) {
        console.error('Failed to load benchmarks:', err);
        return {};
    }
}

export async function getBenchmarkForSector(sector: string): Promise<BenchmarkData> {
    const data = await loadBenchmarks();
    const normalized = sector.charAt(0).toUpperCase() + sector.slice(1).toLowerCase();
    return data?.[normalized] || data?.['Default'] || {
        avg_cac_payback_months: 15,
        avg_ltv_cac: 3,
        avg_churn_rate: 0.05,
        growth_benchmark_top_quartile: 0.5,
        market_multiple_range: [5, 10]
    };
}
