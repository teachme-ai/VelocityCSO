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

STEP 2 — SCORE the "Fact Pool" using this formula:
  ID = (0.4 × S) + (0.35 × C) + (0.25 × M)
  
  S = Specificity (0-100): Does the input contain proper nouns, numbers, named competitors, locations?
    - "Students at Mysore University" = 80. "People nearby" = 15.
  C = Completeness (0-100): How many of the 15 strategic dimensions have enough data?
    - Each dimension covered = +6.67 points
  M = Moat Potential (0-100): Does it identify a unique resource, friction point, or defensible advantage?
    - Named unique asset or friction = 70+. Generic description = 20.

STEP 3 — DECIDE:
  If ID < 70: Generate ONE "Deepening" question targeting the weakest dimension. Use industry language only.
    - Retail: "footfall catchment", "branded vs local margins", "shrinkage rate"
    - SaaS: "monthly churn", "expansion revenue", "sales cycle"
    - Services: "utilization rate", "referral ratio", "repeat booking rate"
  If ID >= 70: Set is_auditable = true. Summarize all facts into strategy_context.

OUTPUT: Raw JSON only, no markdown.
{
  "category": "Retail",
  "id_score": 45,
  "specificity": 60,
  "completeness": 35,
  "moat": 40,
  "question": "How many students pass your store daily, and what's your average basket size vs the branded competitor?",
  "is_auditable": false,
  "strategy_context": "Compact summary of all known facts for specialist agents"
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
        // Load existing fact pool from Firestore
        let factPool = '';
        try {
            const snap = await admin.firestore()
                .collection('discovery_sessions')
                .doc(sessionId)
                .collection('responses')
                .orderBy('timestamp')
                .get();
            factPool = snap.docs.map(d => d.data().user_input).join('\n');
        } catch { /* first call — no history yet */ }

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
                const idScore = Math.round((0.4 * (p.specificity || 0)) + (0.35 * (p.completeness || 0)) + (0.25 * (p.moat || 0)));

                // Persist to Firestore
                await admin.firestore()
                    .collection('discovery_sessions')
                    .doc(sessionId)
                    .collection('responses')
                    .add({
                        user_input: userInput,
                        id_score: idScore,
                        is_auditable: p.is_auditable,
                        timestamp: admin.firestore.FieldValue.serverTimestamp()
                    });

                const cost = estimateCost('gemini-2.0-flash', fullContext.length, rawOutput.length);
                log({
                    severity: 'INFO',
                    message: 'ID score calculated',
                    agent_id: 'interrogator_agent',
                    session_id: sessionId,
                    id_score: idScore,
                    is_auditable: p.is_auditable,
                    cost_usd: cost.usd
                });

                return {
                    category: p.category || 'Unknown',
                    question: p.question || '',
                    isAuditable: p.is_auditable === true || idScore >= 70,
                    strategyContext: p.strategy_context || userInput,
                    idScore,
                    idBreakdown: {
                        specificity: p.specificity || 0,
                        completeness: p.completeness || 0,
                        moat: p.moat || 0
                    }
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
