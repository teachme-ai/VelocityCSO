import { log } from '../services/logger.js';
import { callGemini } from '../services/geminiClient.js';
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

// FIX 2.3: Fallback questions if LLM call fails
const FALLBACK_QUESTIONS: Record<number, string> = {
    0: "Who are your top 2–3 direct competitors, and what do customers typically choose them over you for? Also, how much leverage do your key suppliers or buyers have over your pricing?",
    1: "Is your primary growth focus on selling more to existing customers, entering new geographies or customer segments, launching new products, or diversifying into a new market entirely?",
    2: "What is the single capability, asset, or relationship that would take a well-funded competitor at least 2 years to replicate — and what makes it so hard to copy?",
};

const ADAPTIVE_SYSTEM = `You are a strategy analyst conducting a structured business intake interview.
Your job is to identify the single most important missing piece of information that would improve the quality of a 20-dimension strategic audit.
Ask ONE focused, specific question. Keep it under 60 words. Do not ask about something already clearly answered in the context.`;

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
            log({ severity: 'INFO', message: '[FIX 2.3] Interrogator: 3 turns complete — proceeding to audit', agent_id: 'interrogator_agent', session_id: sessionId });
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

        // FIX 2.3: Generate adaptive question based on what's missing in the context
        const question = await this.generateAdaptiveQuestion(groundedContext, turnCount, sessionId);

        log({
            severity: 'INFO',
            message: `[FIX 2.3] Interrogator: adaptive question generated (turn ${turnCount + 1}/3)`,
            agent_id: 'interrogator_agent',
            session_id: sessionId,
            turn: turnCount + 1,
            question: question.slice(0, 200),
        });
        emitHeartbeat(sessionId, `[DEBUG] Adaptive question ${turnCount + 1}/3 generated.`, 'debug');

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

    private async generateAdaptiveQuestion(context: string, turnCount: number, sessionId: string): Promise<string> {
        // Focus areas per turn to ensure coverage across Porter/Ansoff/VRIO
        const focusHints = [
            'Focus on: competitive landscape, direct competitors, buyer/supplier leverage, pricing dynamics.',
            'Focus on: growth strategy direction (penetration vs development vs new product vs diversification), primary growth vector.',
            'Focus on: the single hardest-to-replicate competitive advantage, what makes it inimitable, honest counter-pressures.',
        ];

        const prompt = `Business context provided so far:
"${context.slice(0, 1500)}"

Turn ${turnCount + 1} of 3. ${focusHints[turnCount]}

Rules:
- Do NOT ask about something already clearly answered above
- Ask ONE specific question only
- Under 60 words
- Be direct and concrete, not generic

Question:`;

        try {
            const raw = await callGemini('gemini-2.5-flash', ADAPTIVE_SYSTEM, prompt, 256);
            const question = raw.trim().replace(/^(Question:|Q:|Answer:)/i, '').trim();
            if (question.length > 20) return question;
        } catch (e) {
            log({ severity: 'WARNING', message: '[FIX 2.3] Adaptive question generation failed — using fallback', session_id: sessionId, error: String(e) });
        }

        return FALLBACK_QUESTIONS[turnCount];
    }
}
