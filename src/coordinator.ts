import { LlmAgent, InMemoryRunner, isFinalResponse } from '@google/adk';
import { randomUUID } from 'crypto';
import { specialists } from './specialists.js';
import { strategicCritic } from './critic.js';
import { DiscoveryResult } from './agents/discovery.js';
import { log, estimateCost } from './services/logger.js';
import { SCENARIOS, ScenarioId, StressResult, MitigationCard } from './scenarios.js';
import { loadAuditMemory } from './services/memory.js';

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

    /**
     * Runs a fast stress-test recalculation on an existing completed report.
     * Discovery is bypassed — uses cached Firestore grounded context.
     * Uses gemini-2.5-flash for speed and minimal cost.
     */
    async triggerStressTest(reportId: string, scenarioId: ScenarioId, sessionId: string): Promise<StressResult> {
        const scenario = SCENARIOS[scenarioId];

        log({ severity: 'INFO', message: `Stress test triggered: ${scenario.label}`, agent_id: 'stress_test_agent', phase: 'stress_test', session_id: sessionId, scenario: scenarioId });

        // Load cached grounded context from Firestore
        const memory = await loadAuditMemory(reportId);
        if (!memory) throw new Error(`Report ${reportId} not found in Firestore. Run a full audit first.`);

        const DIM_NAMES = [
            'TAM Viability', 'Target Precision', 'Trend Adoption',
            'Competitive Defensibility', 'Model Innovation', 'Flywheel Potential',
            'Pricing Power', 'CAC/LTV Ratio', 'Market Entry Speed',
            'Execution Speed', 'Scalability', 'ESG Posture',
            'ROI Projection', 'Risk Tolerance', 'Capital Efficiency'
        ];

        const stressPrompt = `
You are a rapid stress-test recalculation engine. You have been given:

1. BUSINESS GROUNDED CONTEXT (from 24-month discovery sweep):
${memory.groundedContext || memory.businessContext}

2. ORIGINAL DIMENSION SCORES (baseline):
${JSON.stringify(memory.dimensionScores, null, 2)}

3. SYNTHETIC CRISIS SCENARIO TO SIMULATE:
${scenario.prompt}

YOUR TASK:
- Recalculate scores for ALL 15 dimensions under this specific crisis.
- For any dimension scoring below 40, generate 3 concrete mitigation steps and a CSO-level "Crisis Play" recommendation.
- Return ONLY a valid raw JSON object. No preamble, no markdown, no explanation.

Required JSON structure:
{
  "stressed_scores": {
    "TAM Viability": 62,
    "Target Precision": 58,
    ...all 15 dimensions...
  },
  "mitigation_cards": [
    {
      "dimension": "CAC/LTV Ratio",
      "stressed_score": 32,
      "mitigation_steps": ["Step 1...", "Step 2...", "Step 3..."],
      "cso_crisis_play": "Immediate: activate a land-and-expand motion — reduce initial ACVs by 40% to lower acquisition friction while protecting LTV via expansion revenue triggers..."
    }
  ]
}

Dimensions to score: ${DIM_NAMES.join(', ')}
Only include a dimension in mitigation_cards if its stressed score is below 40.
        `.trim();

        // Run as a lightweight single-agent call (no sub-agents, no Discovery)
        const stressAgent = new LlmAgent({
            name: 'stress_test_agent',
            model: 'gemini-2.5-flash',
            description: 'Rapid stress-test recalculation specialist.',
            instruction: 'You are a McKinsey-level stress-test analyst. Respond ONLY with a raw JSON object as instructed.',
        });

        const runner = new InMemoryRunner({ agent: stressAgent, appName: 'velocity_stress' });
        const runnerSessionId = randomUUID();
        await runner.sessionService.createSession({ appName: 'velocity_stress', userId: 'stress_user', sessionId: runnerSessionId });

        const eventStream = runner.runAsync({
            userId: 'stress_user',
            sessionId: runnerSessionId,
            newMessage: { role: 'user', parts: [{ text: stressPrompt }] }
        });

        let rawOutput = '';
        for await (const event of eventStream) {
            if (event.author === stressAgent.name || isFinalResponse(event)) {
                const parts = event.content?.parts || [];
                const text = parts.map((p: { text?: string }) => p.text).filter(Boolean).join('\n');
                if (text) rawOutput += text;
            }
        }

        // Robust JSON extraction
        const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
        let stressedScores: Record<string, number> = {};
        let rawMitigationCards: MitigationCard[] = [];

        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                stressedScores = parsed.stressed_scores || {};
                rawMitigationCards = (parsed.mitigation_cards || []).map((c: any) => ({
                    dimension: c.dimension,
                    stressedScore: c.stressed_score,
                    riskDelta: (memory.dimensionScores[c.dimension] || 50) - c.stressed_score,
                    mitigationSteps: c.mitigation_steps || [],
                    csoCrisisPlay: c.cso_crisis_play || '',
                }));
            } catch (e) {
                log({ severity: 'WARNING', message: 'Stress test JSON parse failed', session_id: sessionId, error: String(e) });
            }
        }

        // Compute risk deltas
        const riskDeltas: Record<string, number> = {};
        for (const dim of DIM_NAMES) {
            const original = memory.dimensionScores[dim] ?? 50;
            const stressed = stressedScores[dim] ?? original;
            riskDeltas[dim] = stressed - original; // negative = worse
        }

        const cost = estimateCost('gemini-2.5-flash', stressPrompt.length, rawOutput.length);
        log({ severity: 'INFO', message: 'Stress test complete', agent_id: 'stress_test_agent', phase: 'stress_test', session_id: sessionId, cost_usd: cost.usd, scenario: scenarioId });

        return {
            scenarioId,
            scenarioLabel: scenario.label,
            originalScores: memory.dimensionScores,
            stressedScores,
            riskDeltas,
            mitigationCards: rawMitigationCards,
        };
    }
}
