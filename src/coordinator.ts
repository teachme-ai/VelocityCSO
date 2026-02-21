import { LlmAgent, InMemoryRunner, isFinalResponse } from '@google/adk';
import { randomUUID } from 'crypto';
import { specialists } from './specialists.js';
import { strategicCritic } from './critic.js';
import { DiscoveryResult } from './agents/discovery.js';

// ─── In-Memory Session Store ────────────────────────────────────────────────
export interface StrategySession {
    enrichedContext: string;
    discoveryFindings: string;
    gaps: string[];
    createdAt: number;
}

// Keyed by sessionId — survives within a single Cloud Run instance lifetime
export const sessionStore = new Map<string, StrategySession>();

// Clean up sessions older than 1 hour
setInterval(() => {
    const oneHourAgo = Date.now() - 3600_000;
    for (const [id, session] of sessionStore.entries()) {
        if (session.createdAt < oneHourAgo) sessionStore.delete(id);
    }
}, 5 * 60 * 1000);

// ─── Strategic Critic (re-exported from here for backward compat) ────────────
export { strategicCritic };

// ─── Chief Strategy Agent ────────────────────────────────────────────────────
export class ChiefStrategyAgent {
    private agent: LlmAgent;

    constructor() {
        this.agent = new LlmAgent({
            name: 'chief_strategy_agent',
            model: 'gemini-2.5-pro',
            description: 'Enterprise-grade Chief Strategy Officer (CSO) responsible for synthesizing business analysis.',
            instruction: `
        You are a McKinsey-level Chief Strategy Officer. 
        Your goal is to receive a business description (potentially enriched with Discovery findings),
        delegate analysis to your specialized team, and synthesize their outputs into a comprehensive markdown report.
        
        Mandatory Agentic Workflow (Self-Correction Loop):
        1. Delegate the user's business context to all 5 specialist agents (market, innovation, commercial, operations, finance).
        2. Collect their structured JSON responses and pass them to the 'strategic_critic' agent.
        3. If the critic returns "REWRITE_REQUIRED" with feedback, re-query the specific failing specialist with the critic's feedback.
        4. Once the critic approves (or after 1 rewrite attempt), synthesize the final multi-dimensional report.
        
        Report Requirements:
        - Must cover all 15 strategic dimensions.
        - Must integrate the specific '0-100' metrics provided by the specialists into the narrative.
        - **Strategic Blindspots**: If any final confidence_score from a specialist is below 70%, or if the critic flagged unresolvable contradictions, include a "Strategic Blindspots" section.
        
        Output Format: A robust Markdown report with an Executive Summary.
      `,
            subAgents: [...specialists, strategicCritic],
        });
    }

    /**
     * Evaluates whether the Discovery findings are sufficient to proceed
     * without asking the user for clarification.
     */
    async evaluateCompleteness(
        discovery: DiscoveryResult
    ): Promise<{ proceed: boolean; gap?: string }> {
        if (discovery.isComplete || discovery.gaps.length === 0) {
            return { proceed: true };
        }

        // If there are meaningful gaps, construct a specific clarifying question
        const gap = discovery.gaps.slice(0, 2).join('. ');
        return { proceed: false, gap };
    }

    /**
     * Runs the full 15-dimension analysis pipeline.
     */
    async analyze(businessContext: string): Promise<string> {
        console.log('[CSO] Starting analysis for:', businessContext.slice(0, 80));

        const runner = new InMemoryRunner({
            agent: this.agent,
            appName: 'velocity_cso',
        });

        const sessionId = randomUUID();
        const userId = 'api_user';

        await runner.sessionService.createSession({
            appName: 'velocity_cso',
            userId,
            sessionId
        });

        const eventStream = runner.runAsync({
            userId,
            sessionId,
            newMessage: { role: 'user', parts: [{ text: businessContext }] }
        });

        let finalReport = '';

        for await (const event of eventStream) {
            if (event.author === this.agent.name || isFinalResponse(event)) {
                const parts = event.content?.parts || [];
                const text = parts.map((p: { text?: string }) => p.text).filter(Boolean).join('\n');
                if (text) finalReport += text;
            }
        }

        console.log('[CSO] Analysis complete.');
        return finalReport || 'Strategic analysis failed. No final response generated.';
    }
}
