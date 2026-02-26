import { LlmAgent, InMemoryRunner, isFinalResponse } from '@google/adk';
import { randomUUID } from 'crypto';
import { log, estimateCost } from '../services/logger.js';
import admin from 'firebase-admin';

export interface InterrogatorResult {
    category: string;
    questions: string[];
    isComplete: boolean;
    strategyContext: string;
    signalStrength: number;
}

export class InterrogatorAgent {
    private agent: LlmAgent;

    constructor() {
        this.agent = new LlmAgent({
            name: 'interrogator_agent',
            model: 'gemini-2.0-flash-exp',
            description: 'Strategic Filter that adapts questions based on business context.',
            instruction: `
You are a Strategic Interrogator. Your job is to extract business intelligence through adaptive questioning.

RULES:
1. Categorize the business (Retail, SaaS, Manufacturing, Services, etc.)
2. Identify 3-5 "Strategic Leaks" to investigate based on category
3. NEVER use academic jargon - reword into industry-specific language
4. Ask ONE question at a time, adapting based on previous answers

EXAMPLES:
- Retail: Ask about "footfall catchment", "branded vs local margins", "peak hour staffing"
- SaaS: Ask about "monthly churn rate", "sales cycle length", "freemium conversion"
- Manufacturing: Ask about "capacity utilization", "supplier lead times", "defect rates"

OUTPUT FORMAT (JSON only):
{
  "category": "Retail",
  "current_question": "What's your typical daily customer count during peak vs off-peak hours?",
  "strategic_leaks": ["Proximity", "Pricing Power", "Operational Friction"],
  "is_complete": false,
  "signal_strength": 35,
  "strategy_context": "Small supermarket near educational institutions competing with branded chain"
}

Set is_complete to true only when you have enough data for all 15 dimensions.
signal_strength: 0-100 based on information density.
`
        });
    }

    async interrogate(
        userInput: string,
        sessionId: string,
        conversationHistory: string[] = []
    ): Promise<InterrogatorResult> {
        const runner = new InMemoryRunner({
            agent: this.agent,
            appName: 'velocity_interrogator',
        });

        const runnerSessionId = randomUUID();
        await runner.sessionService.createSession({
            appName: 'velocity_interrogator',
            userId: 'interrogator_user',
            sessionId: runnerSessionId
        });

        const context = conversationHistory.length > 0
            ? `CONVERSATION HISTORY:\n${conversationHistory.join('\n\n')}\n\nNEW USER INPUT:\n${userInput}`
            : `INITIAL USER INPUT:\n${userInput}`;

        const eventStream = runner.runAsync({
            userId: 'interrogator_user',
            sessionId: runnerSessionId,
            newMessage: { role: 'user', parts: [{ text: context }] }
        });

        log({ severity: 'INFO', message: 'Interrogator started', agent_id: 'interrogator_agent', session_id: sessionId });

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
                const parsed = JSON.parse(jsonMatch[0]);
                
                // Store in Firestore
                await admin.firestore()
                    .collection('discovery_sessions')
                    .doc(sessionId)
                    .collection('responses')
                    .add({
                        user_input: userInput,
                        agent_response: parsed,
                        timestamp: admin.firestore.FieldValue.serverTimestamp()
                    });

                const cost = estimateCost('gemini-2.0-flash', context.length, rawOutput.length);
                log({
                    severity: 'INFO',
                    message: 'Interrogator complete',
                    agent_id: 'interrogator_agent',
                    session_id: sessionId,
                    signal_strength: parsed.signal_strength,
                    is_complete: parsed.is_complete,
                    cost_usd: cost.usd
                });

                return {
                    category: parsed.category || 'Unknown',
                    questions: parsed.current_question ? [parsed.current_question] : [],
                    isComplete: parsed.is_complete === true,
                    strategyContext: parsed.strategy_context || userInput,
                    signalStrength: parsed.signal_strength || 0
                };
            } catch (parseErr) {
                log({ severity: 'WARNING', message: 'Interrogator JSON parse failed', agent_id: 'interrogator_agent', session_id: sessionId });
            }
        }

        return {
            category: 'Unknown',
            questions: ['Can you tell me more about your business model and target customers?'],
            isComplete: false,
            strategyContext: userInput,
            signalStrength: 20
        };
    }
}
