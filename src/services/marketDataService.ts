// src/services/marketDataService.ts
// Aggregates real-time market signals from multiple sources

import { log } from './logger.js';

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
    if (!apiKey) {
        log({ severity: 'WARNING', message: 'NEWS_API_KEY not set. Skipping news enrichment.' });
        return [];
    }

    const query = encodeURIComponent(`"${companyName}" OR "${industry} startup" OR "${industry} market"`);
    const url = `https://newsapi.org/v2/everything?q=${query}&sortBy=publishedAt&pageSize=5&apiKey=${apiKey}`;

    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        const data = await res.json() as any;

        return (data.articles ?? []).map((a: any) => ({
            title: a.title,
            source: a.source?.name ?? 'Unknown',
            date: a.publishedAt?.slice(0, 10) ?? 'unknown',
            url: a.url,
        }));
    } catch (err: any) {
        log({ severity: 'ERROR', message: `NewsAPI fetch failed: ${err.message}` });
        return [];
    }
}

export async function fetchCrunchbaseSignals(
    companyName: string
): Promise<{ last_round?: string; amount?: string; investors?: string[] } | null> {
    const apiKey = process.env.CRUNCHBASE_API_KEY;
    if (!apiKey) {
        log({ severity: 'WARNING', message: 'CRUNCHBASE_API_KEY not set. Skipping funding enrichment.' });
        return null;
    }

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
    } catch (err: any) {
        log({ severity: 'ERROR', message: `Crunchbase fetch failed: ${err.message}` });
        return null;
    }
}

// Assemble all signals for injection into discovery context
export async function assembleMarketSignals(
    companyName: string,
    industry: string
): Promise<string> {
    if (!companyName && !industry) return '';

    const [news, funding] = await Promise.all([
        fetchNewsSignals(companyName, industry),
        fetchCrunchbaseSignals(companyName),
    ]);

    const parts: string[] = [];

    if (news.length > 0) {
        parts.push('RECENT NEWS HEADLINES:');
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
        ? `\n--- REAL-TIME MARKET SIGNALS ---\n${parts.join('\n')}\n`
        : '';
}
