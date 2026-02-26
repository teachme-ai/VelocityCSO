import { LlmAgent, InMemoryRunner, isFinalResponse } from '@google/adk';
import { randomUUID } from 'crypto';
import { log, estimateCost } from '../services/logger.js';
import admin from 'firebase-admin';

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

STEP 2 — SCORE using this strict heuristic (max 100):
  +30 points: Input contains a specific Location OR Demographic (e.g. "Mysore University", "Gen Z students", "near a hospital")
  +30 points: Input identifies a Competitor OR Constraint (e.g. "Big Bazaar", "high CAPEX", "limited parking")
  +40 points: Input identifies an Unfair Advantage (e.g. "relationship with hostel wardens", "exclusive supplier deal", "only halal store in area")

STEP 3 — DECIDE:
  If score < 70: Generate ONE "Deep Dive" question targeting the missing highest-value dimension. Use plain industry language only.
  If score >= 70: Set is_auditable = true. Summarize all facts into strategy_context.

OUTPUT: Raw JSON only, no markdown.
{
  "category": "Retail",
  "id_score": 30,
  "question": "Who are your top 2 competitors nearby, and what do you offer that they don't?",
  "is_auditable": false,
  "strategy_context": "Compact summary of all known facts"
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
        userInput: string,
        sessionId: string,
        conversationHistory: string[] = []
    ): Promise<InterrogatorResult> {
        // Load existing fact pool + count turns from Firestore
        let factPool = '';
        let turnCount = 0;
        try {
            const snap = await admin.firestore()
                .collection('discovery_sessions')
                .doc(sessionId)
                .collection('responses')
                .orderBy('timestamp')
                .get();
            turnCount = snap.size;
            factPool = snap.docs.map(d => d.data().user_input).join('\n');
        } catch { /* first call */ }

        // Turn limit: force audit after 3 turns regardless of score
        if (turnCount >= 3) {
            log({ severity: 'INFO', message: 'Interrogator: Sufficient context reached via turn limit. Initializing specialists.', agent_id: 'interrogator_agent', session_id: sessionId });
            const strategyContext = [factPool, userInput].filter(Boolean).join('\n');
            await admin.firestore().collection('discovery_sessions').doc(sessionId)
                .collection('responses').add({
                    user_input: userInput,
                    id_score: 70,
                    is_auditable: true,
                    forced: true,
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                });
            return {
                category: 'Unknown',
                question: '',
                isAuditable: true,
                strategyContext,
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

        const fullContext = [
            factPool && `EXISTING FACT POOL:\n${factPool}`,
            conversationHistory.length > 0 && `CONVERSATION:\n${conversationHistory.join('\n')}`,
            `NEW INPUT:\n${userInput}`
        ].filter(Boolean).join('\n\n');

        const eventStream = runner.runAsync({
            userId: 'interrogator_user',
            sessionId: runnerSessionId,
            newMessage: { role: 'user', parts: [{ text: fullContext }] }
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

                // Persist to Firestore
                await admin.firestore()
                    .collection('discovery_sessions')
                    .doc(sessionId)
                    .collection('responses')
                    .add({
                        user_input: userInput,
                        id_score: idScore,
                        is_auditable: isAuditable,
                        timestamp: admin.firestore.FieldValue.serverTimestamp()
                    });

                const cost = estimateCost('gemini-2.0-flash', fullContext.length, rawOutput.length);
                log({
                    severity: 'INFO',
                    message: 'ID score calculated',
                    agent_id: 'interrogator_agent',
                    session_id: sessionId,
                    id_score: idScore,
                    is_auditable: isAuditable,
                    cost_usd: cost.usd
                });

                return {
                    category: p.category || 'Unknown',
                    question: p.question || '',
                    isAuditable,
                    strategyContext: p.strategy_context || userInput,
                    idScore,
                    idBreakdown: { specificity: idScore, completeness: idScore, moat: idScore }
                };
            } catch (e) {
                log({ severity: 'WARNING', message: 'Interrogator JSON parse failed', session_id: sessionId });
            }
        }

        return {
            category: 'Unknown',
            question: 'Can you describe your main customer segment and what makes your offering different from competitors?',
            isAuditable: false,
            strategyContext: userInput,
            idScore: 20,
            idBreakdown: { specificity: 20, completeness: 15, moat: 10 }
        };
    }
}
