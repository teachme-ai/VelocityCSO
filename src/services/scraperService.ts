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

    log({ severity: 'INFO', message: `Scraping company URL: ${parsed.href}...` });

    // Using Jina AI Reader (free tier available, no setup needed):
    const jinaUrl = `https://r.jina.ai/${parsed.href}`;

    try {
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
            raw_text: truncated.slice(0, 4000), // Standardized to 4k for token efficiency
        };
    } catch (err: any) {
        log({ severity: 'ERROR', message: `Failed to scrape ${url}: ${err.message}` });
        throw err;
    }
}

function extractTitle(md: string): string {
    const match = md.match(/^#\s+(.+)/m);
    return match?.[1]?.trim() ?? '';
}

function extractDescription(md: string): string {
    // Find first paragraph without headings
    const paragraphs = md.split('\n\n').filter(p => p.trim() && !p.startsWith('#') && p.length > 50);
    return paragraphs[0]?.trim().slice(0, 300) ?? '';
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
        if (inSection) sectionText += line + ' ';
    }

    if (sectionText.trim()) sections.push(sectionText.trim().slice(0, 500));
    return sections.slice(0, 3);
}

function extractTechSignals(md: string): string[] {
    const techPatterns = [
        /built with ([A-Za-z0-9\s,]+)/gi,
        /powered by ([A-Za-z0-9\s]+)/gi,
        /(react|vue|angular|next\.js|vercel|aws|gcp|azure|stripe|twilio|segment|hubspot|salesforce)/gi,
    ];
    const signals: string[] = [];
    for (const pattern of techPatterns) {
        const matches = md.match(pattern);
        if (matches) signals.push(...matches.slice(0, 3));
    }
    return [...new Set(signals.map(s => s.toLowerCase()))].slice(0, 10);
}
