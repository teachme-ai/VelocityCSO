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
 * Uses gemini-2.0-flash to conduct a 24-month retrospective scan of public
 * business signals before the 15-dimension analysis begins.
 */
export class DiscoveryAgent {
    private agent: LlmAgent;

    constructor() {
        this.agent = new LlmAgent({
            name: 'discovery_agent',
            model: 'gemini-2.0-flash',
            description: 'Rapid business intelligence gatherer with 24-month lookback capability.',
            instruction: `
You are a Deep Research Intelligence Agent. Analyse the business described by the user.

TASK: Based on your training knowledge, identify publicly known signals about this business or its market sector from the last 24 months. If the business is unnamed/novel, infer from the sector.

EXTRACTION TARGETS:
- Revenue, funding, ARR growth, burn rate signals
- Product launches, pivots, GTM changes
- Leadership changes, headcount signals
- Competitor moves, pricing changes, M&A
- Market sizing and trend data

COMPLETENESS CHECK: Evaluate if your findings are sufficient to score all 15 dimensions:
[TAM Viability, Target Precision, Trend Adoption, Competitive Defensibility, Model Innovation,
 Flywheel Potential, Pricing Power, CAC/LTV Ratio, Market Entry Speed, Execution Speed,
 Scalability, ESG Posture, ROI Projection, Risk Tolerance, Capital Efficiency]

CRITICAL OUTPUT RULE: You MUST respond with ONLY a raw JSON object. 
Do NOT write any text before or after it. Do NOT wrap it in markdown or code blocks.
Your ENTIRE response must start with { and end with }.

Required JSON structure:
{
  "findings": "Rich paragraph of all discovered intelligence with specific data points",
  "gaps": ["Each gap must be a specific question: e.g. 'What is the current GTM motion — PLG or sales-led?'"],
  "is_complete": true or false,
  "summary": "One sentence: what you found and whether gaps exist"
}

Set is_complete to false if ANY of the 15 dimensions lacks sufficient data.
For pre-revenue, unnamed, or niche businesses, is_complete should almost always be false.
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

        const eventStream = runner.runAsync({
            userId,
            sessionId,
            newMessage: {
                role: 'user',
                parts: [{ text: `Business to analyse:\n${businessContext}\n\nBegin the 24-month intelligence sweep. Return ONLY the JSON object.` }]
            }
        });

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
                return {
                    findings: parsed.findings || rawOutput,
                    gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
                    isComplete: parsed.is_complete === true,
                    summary: parsed.summary || 'Discovery scan complete.'
                };
            } catch (parseErr) {
                console.warn('[Discovery] Regex-extracted JSON still failed to parse:', parseErr);
            }
        }

        // Fallback: parsing failed entirely — treat as incomplete so clarification triggers
        console.warn('[Discovery] Could not extract valid JSON. Triggering clarification path.');
        return {
            findings: rawOutput || 'No structured findings available.',
            gaps: [
                'Could not extract sufficient public data for this business. What is the current revenue model and target customer segment?',
                'What is the primary GTM motion (PLG, sales-led, or channel) and what is the 12-month growth target?'
            ],
            isComplete: false,
            summary: 'Limited public signals found. A few clarifying questions will sharpen the analysis.'
        };
    }
}

