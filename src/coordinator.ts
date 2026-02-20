import { LlmAgent } from '@google/adk';
import { specialists } from './specialists.js';

export class ChiefStrategyAgent {
    private agent: LlmAgent;

    constructor() {
        this.agent = new LlmAgent({
            name: 'Chief Strategy Agent',
            model: 'gemini-1.5-pro',
            description: 'Enterprise-grade Chief Strategy Officer (CSO) responsible for synthesizing business analysis.',
            instructions: `
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
            sub_agents: specialists,
        });
    }

    async analyze(businessContext: string): Promise<string> {
        const response = await this.agent.run(`
      Please provide a comprehensive strategic analysis for the following business context:
      "${businessContext}"
      
      Delegate the specific sections to your specialist team and then synthesize their findings into a final McKinsey-style report.
    `);

        return response.text;
    }
}
