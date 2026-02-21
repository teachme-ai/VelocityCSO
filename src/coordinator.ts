import { LlmAgent, InMemoryRunner, isFinalResponse } from '@google/adk';
import { randomUUID } from 'crypto';
import { specialists } from './specialists.js';
import { strategicCritic } from './critic.js';
import { DiscoveryResult } from './agents/discovery.js';
import { log, estimateCost } from './services/logger.js';

// Re-export StrategySession type for index.ts
export type { StrategySession } from './services/sessionService.js';

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
        discovery: DiscoveryResult,
        sessionId: string
    ): Promise<{ proceed: boolean; gap?: string }> {
        if (discovery.isComplete || discovery.gaps.length === 0) {
            log({
                severity: 'INFO',
                message: 'Discovery completeness check passed — proceeding to analysis',
                agent_id: 'chief_strategy_agent',
                phase: 'evaluation',
                session_id: sessionId,
            });
            return { proceed: true };
        }

        const gap = discovery.gaps.slice(0, 2).join('. ');
        log({
            severity: 'WARNING',
            message: 'Discovery gap detected — triggering conversational clarification',
            agent_id: 'chief_strategy_agent',
            phase: 'evaluation',
            session_id: sessionId,
            gaps: discovery.gaps,
        });
        return { proceed: false, gap };
    }

    /**
     * Runs the full 15-dimension analysis pipeline.
     */
    async analyze(businessContext: string, sessionId: string): Promise<string> {
        log({
            severity: 'INFO',
            message: 'CSO analysis started',
            agent_id: 'chief_strategy_agent',
            phase: 'synthesis',
            session_id: sessionId,
        });

        const runner = new InMemoryRunner({
            agent: this.agent,
            appName: 'velocity_cso',
        });

        const internalSessionId = randomUUID();
        const userId = 'api_user';

        await runner.sessionService.createSession({
            appName: 'velocity_cso',
            userId,
            sessionId: internalSessionId
        });

        const eventStream = runner.runAsync({
            userId,
            sessionId: internalSessionId,
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

        const cost = estimateCost('gemini-2.5-pro', businessContext.length, finalReport.length);
        log({
            severity: 'INFO',
            message: 'CSO analysis complete',
            agent_id: 'chief_strategy_agent',
            phase: 'synthesis',
            session_id: sessionId,
            token_estimate: cost.inputTokens + cost.outputTokens,
            cost_usd: cost.usd,
        });

        return finalReport || 'Strategic analysis failed. No final response generated.';
    }
}
