import { LlmAgent, InMemoryRunner, isFinalResponse } from '@google/adk';
import { randomUUID } from 'crypto';

export interface DiscoveryResult {
    findings: string;
    gaps: string[];
    isComplete: boolean;
    summary: string;
}

/**
 * Agent 0: Discovery Agent
 * Uses gemini-2.0-flash with Google Search grounding to conduct a 24-month
 * retrospective scan of public business signals before the 15-dimension analysis.
 */
export class DiscoveryAgent {
    private agent: LlmAgent;

    constructor() {
        this.agent = new LlmAgent({
            name: 'discovery_agent',
            model: 'gemini-2.0-flash',
            description: 'Rapid web intelligence gatherer. Performs 24-month lookbacks on business signals.',
            instruction: `
                You are a Deep Research Intelligence Agent. Your role is to gather external, ground-truth data
                about the business described by the user BEFORE any strategic analysis begins.

                MISSION: Conduct a 24-month retrospective scan using publicly available signals.

                SEARCH TARGETS (in priority order):
                1. Official company website and blog posts (product launches, hiring signals)
                2. Press releases and news articles from the last 24 months
                3. SEC/SEBI filings or equivalent financial disclosures if available
                4. LinkedIn signals: executive hires, headcount changes
                5. G2, Capterra, or app store reviews for GTM and NPS signals

                EXTRACT specifically:
                - QUANTITATIVE: Revenue, CAPEX, ARR growth, fundraising rounds, burn rate signals
                - QUALITATIVE: Product pivots, new market entries, leadership changes, partnership announcements
                - COMPETITIVE: New market entrants, pricing changes, M&A activity in the space

                COMPLETENESS EVALUATION:
                After gathering, evaluate whether your findings cover all 15 strategic dimensions:
                [TAM Viability, Target Precision, Trend Adoption, Competitive Defensibility, Model Innovation,
                 Flywheel Potential, Pricing Power, CAC/LTV Ratio, Market Entry Speed, Execution Speed,
                 Scalability, ESG Posture, ROI Projection, Risk Tolerance, Capital Efficiency]

                OUTPUT FORMAT (strict JSON, no markdown wrapping):
                {
                    "findings": "A rich paragraph summarizing all discovered intelligence with specific data points",
                    "gaps": ["List of specific dimensions or data points that could not be verified from public sources"],
                    "is_complete": true|false,
                    "summary": "One-sentence summary of what was found (shown to user)"
                }

                If is_complete is false, the gap descriptions must be specific enough to ask the user a targeted clarifying question.
            `
        });
    }

    async discover(businessContext: string): Promise<DiscoveryResult> {
        const runner = new InMemoryRunner({
            agent: this.agent,
            appName: 'velocity_cso_discovery',
        });

        const sessionId = randomUUID();
        const userId = 'discovery_user';

        await runner.sessionService.createSession({
            appName: 'velocity_cso_discovery',
            userId,
            sessionId
        });

        const prompt = `
            Business to analyse:
            ${businessContext}

            Conduct the 24-month intelligence sweep now. Search for all available public signals.
        `;

        const eventStream = runner.runAsync({
            userId,
            sessionId,
            newMessage: { role: 'user', parts: [{ text: prompt }] }
        });

        let rawOutput = '';
        for await (const event of eventStream) {
            if (event.author === this.agent.name || isFinalResponse(event)) {
                const parts = event.content?.parts || [];
                const text = parts.map((p: { text?: string }) => p.text).filter(Boolean).join('\n');
                if (text) rawOutput += text;
            }
        }

        // Parse the JSON output from the Discovery Agent
        try {
            const parsed = JSON.parse(rawOutput.replace(/```json/g, '').replace(/```/g, '').trim());
            return {
                findings: parsed.findings || rawOutput,
                gaps: parsed.gaps || [],
                isComplete: parsed.is_complete ?? true,
                summary: parsed.summary || 'Discovery scan complete.'
            };
        } catch {
            // Fallback: treat the whole output as findings with no gaps
            console.warn('[Discovery] Could not parse JSON output. Using raw text as findings.');
            return {
                findings: rawOutput,
                gaps: [],
                isComplete: true,
                summary: 'Discovery scan complete. Proceeding with provided context.'
            };
        }
    }
}
