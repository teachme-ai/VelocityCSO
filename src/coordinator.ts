import { LlmAgent, InMemoryRunner, isFinalResponse, stringifyContent } from '@google/adk';
import { randomUUID } from 'crypto';
import { specialists } from './specialists.js';

export class ChiefStrategyAgent {
    private agent: LlmAgent;

    constructor() {
        this.agent = new LlmAgent({
            name: 'chief_strategy_agent',
            model: 'gemini-1.5-pro',
            description: 'Enterprise-grade Chief Strategy Officer (CSO) responsible for synthesizing business analysis.',
            instruction: `
        You are a McKinsey-level Chief Strategy Officer. 
        Your goal is to receive a business description, delegate analysis to your specialized team, and synthesize their outputs into a comprehensive, highly professional markdown report.
        
        The report must cover 15 strategic dimensions across the following areas:
        1. Market & Trends
        2. Strategy & Innovation
        3. Commercial Strategy
        4. Operations & Execution
        5. Finance & Risk
        
        Tone: Highly professional, strategic, and actionable.
        Output Format: A single, well-structured Markdown report with an Executive Summary.
      `,
            subAgents: specialists,
        });
    }

    async analyze(businessContext: string): Promise<string> {
        console.log("Starting analysis for:", businessContext);

        const runner = new InMemoryRunner({
            agent: this.agent,
            appName: 'velocity_cso',
        });

        const sessionId = randomUUID();
        const userId = 'api_user';

        // The InMemoryRunner expects the session to exist in its session service
        // before runAsync is called in some configurations, or we must pass it explicitly.
        await runner.sessionService.createSession({
            appName: 'velocity_cso',
            userId: userId,
            sessionId: sessionId
        });

        const eventStream = runner.runAsync({
            userId: userId,
            sessionId: sessionId,
            newMessage: { role: 'user', parts: [{ text: businessContext }] }
        });

        let finalReport = "";

        for await (const event of eventStream) {
            console.log(`[Event Received] Session: ${sessionId}, Author: ${event.author}`);
            console.log(`[Event Payload] ${JSON.stringify(event, null, 2)}`);

            // We capture content from the agent directly instead of relying solely on isFinalResponse
            if (event.author === this.agent.name || isFinalResponse(event)) {
                const parts = event.content?.parts || [];
                const text = parts.map(p => p.text).filter(Boolean).join('\n');
                if (text) {
                    finalReport += text;
                }
            }
        }

        console.log("Analysis complete.");
        return finalReport || "Strategic analysis failed. No final response generated.";
    }
}
