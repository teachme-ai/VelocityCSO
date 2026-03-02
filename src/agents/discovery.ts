import { LlmAgent, InMemoryRunner, isFinalResponse, GOOGLE_SEARCH } from '@google/adk';
import { randomUUID } from 'crypto';
import { log, estimateCost } from '../services/logger.js';

export interface DiscoveryResult {
    findings: Array<{
        signal: string;
        source: string;
        date: string;
        relevance: 'high' | 'medium' | 'low';
    }>;
    gaps: string[];
    isComplete: boolean;
    summary: string;
    pestle?: {
        political: PestleItem;
        economic: PestleItem;
        social: PestleItem;
        technological: PestleItem;
        legal: PestleItem;
        environmental: PestleItem;
    };
}

interface PestleItem {
    signal: string;
    impact: number;   // 0-10
    likelihood: number; // 0-10
}

function buildDiscoveryInstruction(): string {
    return `
You are a market intelligence analyst. Perform MARKET GROUNDING using Google Search to find REAL, CURRENT information.

SEARCH STRATEGY:
1. Search for "[company/product name] news 2025 2026"
2. Search for "[industry] market size 2025 funding"
3. Search for "[top competitor names] recent announcements"
4. Search for "[industry] regulatory changes 2025"

For each search, cite the source URL and publication date.

OUTPUT FORMAT (strict JSON):
{
  "findings": [
    {
      "signal": "string — what was found",
      "source": "URL or publication name",
      "date": "YYYY-MM or 'unknown'",
      "relevance": "high | medium | low"
    }
  ],
  "gaps": ["string — what could not be found via search"],
  "isComplete": boolean,
  "summary": "2-3 sentence synthesis of the most important findings",
  "pestle": {
    "political": { "signal": "string", "impact": 0-10, "likelihood": 0-10 },
    "economic": { "signal": "string", "impact": 0-10, "likelihood": 0-10 },
    "social": { "signal": "string", "impact": 0-10, "likelihood": 0-10 },
    "technological": { "signal": "string", "impact": 0-10, "likelihood": 0-10 },
    "legal": { "signal": "string", "impact": 0-10, "likelihood": 0-10 },
    "environmental": { "signal": "string", "impact": 0-10, "likelihood": 0-10 }
  }
}
`;
}

/**
 * Agent 0: Discovery Agent
 * Uses gemini-2.0-flash with real-time web search to ground strategic analysis.
 */
export class DiscoveryAgent {
    private agent: LlmAgent;

    constructor() {
        this.agent = new LlmAgent({
            name: 'discovery_agent',
            model: 'gemini-2.0-flash',
            description: 'Market intelligence gatherer with Google Search grounding and PESTLE analysis.',
            instruction: buildDiscoveryInstruction(),
            tools: [GOOGLE_SEARCH],
        });
    }


    async discover(businessContext: string, sessionId?: string): Promise<DiscoveryResult> {
        const runner = new InMemoryRunner({
            agent: this.agent,
            appName: 'velocity_cso_discovery',
        });

        const runnerSessionId = randomUUID();
        const userId = 'discovery_user';

        await runner.sessionService.createSession({
            appName: 'velocity_cso_discovery',
            userId,
            sessionId: runnerSessionId
        });

        const eventStream = runner.runAsync({
            userId,
            sessionId: runnerSessionId,
            newMessage: {
                role: 'user',
                parts: [{ text: `Business to analyse:\n${businessContext}\n\nBegin the 24-month intelligence sweep. Return ONLY the JSON object.` }]
            }
        });

        log({ severity: 'INFO', message: 'Discovery sweep started', agent_id: 'discovery_agent', phase: 'discovery', session_id: sessionId });
        let rawOutput = '';
        for await (const event of eventStream) {
            if (event.author === this.agent.name || isFinalResponse(event)) {
                const parts = event.content?.parts || [];
                const text = parts.map((p: { text?: string }) => p.text).filter(Boolean).join('\n');
                if (text) rawOutput += text;
            }
        }

        // Robust JSON extraction: pull the first {...} block out of any surrounding text
        const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                const cost = estimateCost('gemini-2.0-flash', businessContext.length, rawOutput.length);
                log({
                    severity: 'INFO',
                    message: 'Market grounding complete',
                    agent_id: 'discovery_agent',
                    phase: 'discovery',
                    session_id: sessionId,
                    is_complete: parsed.isComplete,
                    gaps_count: Array.isArray(parsed.gaps) ? parsed.gaps.length : 0,
                    cost_usd: cost.usd,
                });
                return {
                    findings: Array.isArray(parsed.findings) ? parsed.findings : [],
                    gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
                    isComplete: parsed.isComplete === true,
                    summary: parsed.summary || 'Market grounding complete.',
                    pestle: parsed.pestle
                };
            } catch (parseErr) {
                log({ severity: 'WARNING', message: 'Regex-extracted JSON failed to parse', agent_id: 'discovery_agent', session_id: sessionId, error: String(parseErr) });
            }
        }

        // Fallback
        log({ severity: 'WARNING', message: 'Could not extract valid JSON from Discovery output — triggering clarification', agent_id: 'discovery_agent', session_id: sessionId });
        return {
            findings: [],
            gaps: [
                'Could not extract sufficient market data via search. What is the current revenue model?',
                'What is the primary GTM motion (PLG or sales-led) and target growth for the next 12 months?'
            ],
            isComplete: false,
            summary: 'Limited web signals found. Clarifying questions required.'
        };
    }
}

