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
    lensUsed: string;
    idBreakdown: { specificity: number; completeness: number; moat: number };
}

const LENSES = ['CUSTOMER/MARKET', 'COMPETITOR/MOAT', 'OPERATIONS/SUPPLY'] as const;
type Lens = typeof LENSES[number];

const LENS_PROMPTS: Record<Lens, string> = {
    'CUSTOMER/MARKET': 'Focus on WHO the customer is — demographics, location, daily behaviour, unmet need.',
    'COMPETITOR/MOAT': 'Focus on WHY competitors cannot copy this — structural advantages, exclusive access, switching costs.',
    'OPERATIONS/SUPPLY': 'Focus on the SECRET SAUCE — supply chain, unique process, proprietary relationships.',
};

// Keyword signals for each scoring dimension — checked before hitting the LLM
const LOCATION_KEYWORDS = /\b(US|UK|EU|Canada|Australia|India|New York|London|California|Texas|Chicago|nationwide|global|region|city|state|country)\b/i;
const COMPETITOR_KEYWORDS = /\b(competitor|vs\.?|against|rival|alternative|instead of|compared to|[A-Z][a-z]+\s+(Inc|Corp|Ltd|LLC|SaaS|AI|Tech)|Asana|Monday|Salesforce|HubSpot|Shopify|Blue Yonder|Crisp|SAP|Oracle|AWS|Google|Microsoft|Amazon)\b/;
const MOAT_KEYWORDS = /\b(exclusive|patent|proprietary|partnership|contract|license|unique|only|can't replicate|cannot copy|switching cost|lock.?in|data advantage|network effect|retention|NPS|referral|distributor|supplier agreement)\b/i;

function scoreContextDeterministically(context: string): { score: number; coveredLenses: string[] } {
    const coveredLenses: string[] = [];
    let score = 0;
    if (LOCATION_KEYWORDS.test(context)) { score += 30; coveredLenses.push('CUSTOMER/MARKET'); }
    if (COMPETITOR_KEYWORDS.test(context)) { score += 30; coveredLenses.push('COMPETITOR/MOAT'); }
    if (MOAT_KEYWORDS.test(context)) { score += 40; coveredLenses.push('OPERATIONS/SUPPLY'); }
    return { score, coveredLenses };
}

function buildInstruction(usedLenses: string[], askedQuestions: string[]): string {
    const nextLens = (LENSES.find(l => !usedLenses.includes(l)) || 'CUSTOMER/MARKET') as Lens;
    const blacklist = askedQuestions.length > 0
        ? `\nQUESTION BLACKLIST — strictly forbidden from repeating:\n${askedQuestions.map(q => `- "${q}"`).join('\n')}\n`
        : '';
    return `
You are a Strategic Interrogator and Information Density Scorer.

ACTIVE LENS: ${nextLens} — ${LENS_PROMPTS[nextLens]}
LENSES ALREADY COVERED (skip these): ${usedLenses.join(', ') || 'none'}
${blacklist}
STEP 1 — CATEGORIZE the business.

STEP 2 — SCORE the FULL GROUNDED CONTEXT (max 100):
  +30 points: Specific Location OR Demographic present
  +30 points: Named Competitor OR Constraint present
  +40 points: Unfair Advantage or unique resource present

STEP 3 — DECIDE:
  If score >= 70: is_auditable = true. Summarize ALL facts into strategy_context.
  If score < 70: ONE question targeting the ACTIVE LENS. Plain language. Not in blacklist.
  Fallback if stuck: "What is the most manual or painful part of your daily operation?"

OUTPUT: Raw JSON only.
{
  "category": "Retail",
  "id_score": 60,
  "lens_used": "${nextLens}",
  "question": "...",
  "is_auditable": false,
  "strategy_context": "..."
}
`;
}

export class InterrogatorAgent {

    async evaluateInformationDensity(
        groundedContext: string,
        turnCount: number,
        sessionId: string,
        usedLenses: string[] = [],
    ): Promise<InterrogatorResult> {

        if (turnCount >= 3) {
            log({ severity: 'INFO', message: 'Interrogator: Turn limit reached. Forcing READY_FOR_AUDIT.', agent_id: 'interrogator_agent', session_id: sessionId });
            return { category: 'Unknown', question: '', isAuditable: true, strategyContext: groundedContext, idScore: 70, lensUsed: '', idBreakdown: { specificity: 70, completeness: 70, moat: 70 } };
        }

        // Fast-path: deterministic pre-score — skip LLM if context is already rich
        const preScore = scoreContextDeterministically(groundedContext);
        if (preScore.score >= 70) {
            log({ severity: 'INFO', message: 'Interrogator: Pre-score passed. Skipping LLM.', agent_id: 'interrogator_agent', session_id: sessionId, id_score: preScore.score });
            return { category: 'B2B SaaS', question: '', isAuditable: true, strategyContext: groundedContext, idScore: preScore.score, lensUsed: '', idBreakdown: { specificity: preScore.score, completeness: preScore.score, moat: preScore.score } };
        }

        // Merge deterministically covered lenses with session-tracked ones
        const effectiveUsedLenses = [...new Set([...usedLenses, ...preScore.coveredLenses])];

        // 🚨 STATE LOCK: If all lenses are covered, or (2/3 lenses covered AND pre-score is decent), force audit
        if (effectiveUsedLenses.length >= 3 || (effectiveUsedLenses.length === 2 && preScore.score >= 50)) {
            log({ severity: 'INFO', message: 'Interrogator: State Lock triggered (Density reached). Forcing READY_FOR_AUDIT.', agent_id: 'interrogator_agent', session_id: sessionId, score: preScore.score, lenses: effectiveUsedLenses });
            return { category: 'Strategic Business', question: '', isAuditable: true, strategyContext: groundedContext, idScore: Math.max(70, preScore.score), lensUsed: '', idBreakdown: { specificity: 70, completeness: 70, moat: 70 } };
        }

        // Load asked questions from Firestore for blacklist
        let askedQuestions: string[] = [];
        try {
            const snap = await admin.firestore()
                .collection('discovery_sessions').doc(sessionId)
                .collection('asked_questions').get();
            askedQuestions = snap.docs.map(d => d.data().question as string).filter(Boolean);
        } catch { /* first call */ }

        const agent = new LlmAgent({
            name: 'interrogator_agent',
            model: 'gemini-2.0-flash-exp',
            description: 'Strategic Filter with Information Density scoring.',
            instruction: buildInstruction(effectiveUsedLenses, askedQuestions),
        });

        const runner = new InMemoryRunner({ agent, appName: 'velocity_interrogator' });
        const runnerSessionId = randomUUID();
        await runner.sessionService.createSession({ appName: 'velocity_interrogator', userId: 'interrogator_user', sessionId: runnerSessionId });

        const eventStream = runner.runAsync({
            userId: 'interrogator_user',
            sessionId: runnerSessionId,
            newMessage: { role: 'user', parts: [{ text: `FULL GROUNDED CONTEXT:\n${groundedContext}` }] }
        });

        let rawOutput = '';
        for await (const event of eventStream) {
            if (event.author === agent.name || isFinalResponse(event)) {
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
                const lensUsed: string = p.lens_used || '';

                // If only one lens was left and we got a decent score, or LLM says auditable
                const isAuditable = p.is_auditable === true || idScore >= 70 || (effectiveUsedLenses.length === 2 && idScore >= 50);

                if (!isAuditable && p.question) {
                    try {
                        await admin.firestore()
                            .collection('discovery_sessions').doc(sessionId)
                            .collection('asked_questions').add({
                                question: p.question,
                                lens: lensUsed,
                                timestamp: admin.firestore.FieldValue.serverTimestamp()
                            });
                    } catch { /* non-critical */ }
                }

                const cost = estimateCost('gemini-2.0-flash', groundedContext.length, rawOutput.length);
                log({ severity: 'INFO', message: 'ID score calculated', agent_id: 'interrogator_agent', session_id: sessionId, id_score: idScore, lens: lensUsed, cost_usd: cost.usd });

                return {
                    category: p.category || 'Unknown',
                    question: p.question || '',
                    isAuditable,
                    strategyContext: p.strategy_context || groundedContext,
                    idScore,
                    lensUsed,
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
            lensUsed: '',
            idBreakdown: { specificity: 20, completeness: 15, moat: 10 }
        };
    }
}
