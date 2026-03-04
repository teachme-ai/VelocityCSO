import { log } from '../services/logger.js';
import { emitHeartbeat } from '../services/sseService.js';

export interface InterrogatorResult {
    category: string;
    question: string;
    isAuditable: boolean;
    strategyContext: string;
    idScore: number;
    lensUsed: string;
    idBreakdown: { specificity: number; completeness: number; moat: number };
}

/**
 * Three fixed questions — one per turn — targeting the minimum signal
 * required to populate Porter's 5 Forces, Ansoff Matrix, and VRIO.
 *
 * Turn 0 → Porter's: competitive landscape, buyer/supplier dynamics
 * Turn 1 → Ansoff:   growth vector intent (penetration / development / new product / diversification)
 * Turn 2 → VRIO:     primary competitive advantage and why it's hard to copy
 * Turn 3+ → auditable, proceed to analysis
 */
const FRAMEWORK_QUESTIONS: Record<number, string> = {
    0: "Who are your top 2–3 direct competitors, and what do customers typically choose them over you for? Also, how much leverage do your key suppliers or buyers have over your pricing?",
    1: "Is your primary growth focus on selling more to existing customers, entering new geographies or customer segments, launching new products, or diversifying into a new market entirely?",
    2: "What is the single capability, asset, or relationship that would take a well-funded competitor at least 2 years to replicate — and what makes it so hard to copy?",
};

export class InterrogatorAgent {

    async evaluateInformationDensity(
        groundedContext: string,
        turnCount: number,
        sessionId: string,
        _usedLenses: string[] = [],
    ): Promise<InterrogatorResult> {
        emitHeartbeat(sessionId, `[DEBUG] InterrogatorAgent: turn ${turnCount}`, 'debug');

        // After 3 questions, always proceed to audit
        if (turnCount >= 3) {
            log({ severity: 'INFO', message: 'Interrogator: All 3 framework questions answered. Proceeding to audit.', agent_id: 'interrogator_agent', session_id: sessionId });
            return {
                category: 'Strategic Business',
                question: '',
                isAuditable: true,
                strategyContext: groundedContext,
                idScore: 100,
                lensUsed: '',
                idBreakdown: { specificity: 100, completeness: 100, moat: 100 },
            };
        }

        const question = FRAMEWORK_QUESTIONS[turnCount];
        log({ severity: 'INFO', message: `Interrogator: Asking framework question ${turnCount + 1}/3`, agent_id: 'interrogator_agent', session_id: sessionId, question });
        emitHeartbeat(sessionId, `[DEBUG] Framework question ${turnCount + 1}/3 issued.`, 'debug');

        return {
            category: 'Strategic Business',
            question,
            isAuditable: false,
            strategyContext: groundedContext,
            idScore: turnCount * 33,
            lensUsed: '',
            idBreakdown: {
                specificity: turnCount >= 1 ? 33 : 0,
                completeness: turnCount >= 2 ? 33 : 0,
                moat: 0,
            },
        };
    }
}
