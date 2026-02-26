import { LlmAgent, InMemoryRunner, isFinalResponse } from '@google/adk';
import { randomUUID } from 'crypto';
import { log, estimateCost } from '../services/logger.js';

export interface InterrogatorResult {
    category: string;
    question: string;
    isAuditable: boolean;
    strategyContext: string;
    idScore: number;
    idBreakdown: { specificity: number; completeness: number; moat: number };
}

const INSTRUCTION = `
You are a Strategic Interrogator and Information Density Scorer.

STEP 1 — CATEGORIZE: Identify the business category (Retail, SaaS, Manufacturing, Services, etc.)

STEP 2 — SCORE the FULL GROUNDED CONTEXT (not just the latest input) using this strict heuristic (max 100):
  +30 points: Contains a specific Location OR Demographic (e.g. "Koramangala", "Gen Z students", "near a hospital")
  +30 points: Identifies a Competitor OR Constraint (e.g. "Reliance Smart", "high CAPEX", "thin margins")
  +40 points: Identifies an Unfair Advantage (e.g. "exclusive farmer deal", "only Korean snack stockist", "hostel warden relationship")

STEP 3 — DECIDE:
  If score < 70: Generate ONE "Deep Dive" question targeting the missing highest-value dimension. Plain language only.
  If score >= 70: Set is_auditable = true. Summarize ALL facts into strategy_context.

OUTPUT: Raw JSON only, no markdown.
{
  "category": "Retail",
  "id_score": 100,
  "question": "",
  "is_auditable": true,
  "strategy_context": "FreshStop, 800 sq ft grocery in Koramangala Bangalore. Competitor: Reliance Smart. Exclusive deal with 3 local farmers. Only Korean/Japanese snack stockist. Customers: 22-30 tech workers from WeWork/Awfis. Revenue ₹4.5L/month, thin margins on staples."
}
`;

export class InterrogatorAgent {
    private agent: LlmAgent;

    constructor() {
        this.agent = new LlmAgent({
            name: 'interrogator_agent',
            model: 'gemini-2.0-flash-exp',
            description: 'Strategic Filter with Information Density scoring.',
            instruction: INSTRUCTION,
        });
    }

    async evaluateInformationDensity(
        groundedContext: string,  // always the FULL cumulative context from session
        turnCount: number,
        sessionId: string,
    ): Promise<InterrogatorResult> {

        // Hard stop — force audit at turn 3 regardless of score
        if (turnCount >= 3) {
            log({ severity: 'INFO', message: 'Interrogator: Turn limit reached. Forcing READY_FOR_AUDIT.', agent_id: 'interrogator_agent', session_id: sessionId });
            return {
                category: 'Unknown',
                question: '',
                isAuditable: true,
                strategyContext: groundedContext,
                idScore: 70,
                idBreakdown: { specificity: 70, completeness: 70, moat: 70 }
            };
        }

        const runner = new InMemoryRunner({ agent: this.agent, appName: 'velocity_interrogator' });
        const runnerSessionId = randomUUID();
        await runner.sessionService.createSession({
            appName: 'velocity_interrogator',
            userId: 'interrogator_user',
            sessionId: runnerSessionId
        });

        const eventStream = runner.runAsync({
            userId: 'interrogator_user',
            sessionId: runnerSessionId,
            newMessage: { role: 'user', parts: [{ text: `FULL GROUNDED CONTEXT:\n${groundedContext}` }] }
        });

        let rawOutput = '';
        for await (const event of eventStream) {
            if (event.author === this.agent.name || isFinalResponse(event)) {
                const parts = event.content?.parts || [];
                const text = parts.map((p: { text?: string }) => p.text).filter(Boolean).join('\n');
                if (text) rawOutput += text;
            }
        }

        const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const p = JSON.parse(jsonMatch[0]);
                const idScore = Math.min(100, p.id_score || 0);
                const isAuditable = p.is_auditable === true || idScore >= 70;

                const cost = estimateCost('gemini-2.0-flash', groundedContext.length, rawOutput.length);
                log({ severity: 'INFO', message: 'ID score calculated', agent_id: 'interrogator_agent', session_id: sessionId, id_score: idScore, turn: turnCount, cost_usd: cost.usd });

                return {
                    category: p.category || 'Unknown',
                    question: p.question || '',
                    isAuditable,
                    strategyContext: p.strategy_context || groundedContext,
                    idScore,
                    idBreakdown: { specificity: idScore, completeness: idScore, moat: idScore }
                };
            } catch {
                log({ severity: 'WARNING', message: 'Interrogator JSON parse failed', session_id: sessionId });
            }
        }

        return {
            category: 'Unknown',
            question: 'What makes your business hard for a well-funded competitor to copy in the next 12 months?',
            isAuditable: false,
            strategyContext: groundedContext,
            idScore: 20,
            idBreakdown: { specificity: 20, completeness: 15, moat: 10 }
        };
    }
}
