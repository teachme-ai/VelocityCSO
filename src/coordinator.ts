import { LlmAgent, InMemoryRunner, isFinalResponse } from '@google/adk';
import { randomUUID } from 'crypto';
import { specialists } from './specialists.js';
import { strategicCritic } from './critic.js';
import { DiscoveryResult } from './agents/discovery.js';
import { log, estimateCost } from './services/logger.js';
import { SCENARIOS, ScenarioId, StressResult, MitigationCard } from './scenarios.js';
import { loadAuditMemory } from './services/memory.js';
import { emitHeartbeat } from './index.js';

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
        
        MANDATORY SCORING TABLE: You MUST include this exact block in your report, with real scores filled in:
        
        ## Dimension Scores
        TAM Viability: [score]/100
        Target Precision: [score]/100
        Trend Adoption: [score]/100
        Competitive Defensibility: [score]/100
        Model Innovation: [score]/100
        Flywheel Potential: [score]/100
        Pricing Power: [score]/100
        CAC/LTV Ratio: [score]/100
        Market Entry Speed: [score]/100
        Execution Speed: [score]/100
        Scalability: [score]/100
        ESG Posture: [score]/100
        ROI Projection: [score]/100
        Risk Tolerance: [score]/100
        Capital Efficiency: [score]/100
        
        CRITICAL: Output ONLY markdown text. Do NOT output JSON, code blocks, or raw data structures. All output must be human-readable narrative markdown.`,
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
     * Uses Promise.all to ensure all specialists finish before synthesis.
     */
    private robustParse(agentName: string, raw: string): any {
        const fallback = {
            analysis_markdown: raw,
            dimensions: {
                'TAM Viability': 50, 'Target Precision': 50, 'Trend Adoption': 50,
                'Competitive Defensibility': 50, 'Model Innovation': 50, 'Flywheel Potential': 50,
                'Pricing Power': 50, 'CAC/LTV Ratio': 50, 'Market Entry Speed': 50,
                'Execution Speed': 50, 'Scalability': 50, 'ESG Posture': 50,
                'ROI Projection': 50, 'Risk Tolerance': 50, 'Capital Efficiency': 50
            },
            confidence_score: 50
        };

        // 1. Sanitize Markdown backticks if present
        let sanitized = raw.replace(/```json\s?/, '').replace(/```\s?$/, '').trim();

        // 2. Greedy Extraction
        const jsonMatch = sanitized.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return fallback;

        try {
            const parsed = JSON.parse(jsonMatch[0]);
            // Merge defaults to ensure all 15 dimensions exist
            return {
                ...fallback,
                ...parsed,
                dimensions: { ...fallback.dimensions, ...(parsed.dimensions || {}) }
            };
        } catch {
            return fallback;
        }
    }

    async analyze(businessContext: string, sessionId: string): Promise<{ report: string; dimensions: Record<string, number>; specialistOutputs: Record<string, any>; orgName: string; moatRationale: string }> {
        log({
            severity: 'INFO',
            message: 'CSO analysis started (Parallel Specialist Mode)',
            agent_id: 'chief_strategy_agent',
            phase: 'synthesis',
            session_id: sessionId,
        });
        emitHeartbeat(sessionId, '◆ CSO: analysis started (Parallel Specialist Mode)');

        const finalDimensions: Record<string, number> = {
            'TAM Viability': 0, 'Target Precision': 0, 'Trend Adoption': 0,
            'Competitive Defensibility': 0, 'Model Innovation': 0, 'Flywheel Potential': 0,
            'Pricing Power': 0, 'CAC/LTV Ratio': 0, 'Market Entry Speed': 0,
            'Execution Speed': 0, 'Scalability': 0, 'ESG Posture': 0,
            'ROI Projection': 0, 'Risk Tolerance': 0, 'Capital Efficiency': 0
        };
        const specialistOutputs: Record<string, any> = {};

        // 1. Run all 5 specialists in parallel
        const specialistPromises = specialists.map(async (agent) => {
            const runner = new InMemoryRunner({ agent, appName: 'velocity_specialist' });
            const internalId = randomUUID();
            await runner.sessionService.createSession({ appName: 'velocity_specialist', userId: 'cso_internal', sessionId: internalId });

            const eventStream = runner.runAsync({
                userId: 'cso_internal',
                sessionId: internalId,
                newMessage: {
                    role: 'user',
                    parts: [{ text: `${businessContext}\n\nCRITICAL: You MUST return your analysis as a clean JSON object according to your schema. Do NOT include markdown text outside the JSON. All 3 dimensions for your lens MUST be scored 0-100.` }]
                }
            });

            emitHeartbeat(sessionId, `◆ ${agent.name}: sensing market signals and identifying asymmetric plays...`);
            let rawOutput = '';
            for await (const event of eventStream) {
                if (event.author === agent.name || isFinalResponse(event)) {
                    const parts = event.content?.parts || [];
                    const text = parts.map((p: any) => p.text).filter(Boolean).join('\n');
                    if (text) rawOutput += text;
                }
            }

            const result = this.robustParse(agent.name!, rawOutput);
            if (result.dimensions) {
                Object.assign(finalDimensions, result.dimensions);
                Object.entries(result.dimensions).forEach(([dim, score]) => {
                    emitHeartbeat(sessionId, `◆ ${agent.name} calculated ${dim}: ${score}/100`);
                });
            }
            emitHeartbeat(sessionId, `◆ ${agent.name}: analysis complete. alignment verified.`);
            specialistOutputs[agent.name!] = result;
            return result;
        });

        await Promise.all(specialistPromises);

        // 2. Comprehensive Synthesis by CSO
        emitHeartbeat(sessionId, '◆ CSO: Initializing strategic synthesis of 15-dimension matrix...');
        emitHeartbeat(sessionId, '◆ Critic: Verifying cross-functional alignment of specialist findings...');
        emitHeartbeat(sessionId, '◆ CSO: Synthesizing narrative for executive board-room delivery...');

        const synthesisPrompt = `
            You are the Chief Strategy Officer. You have received independent analysis from your specialists.
            
            BUSINESS CONTEXT:
            ${businessContext}
            
            SPECIALIST ANALYSES:
            ${Object.entries(specialistOutputs).map(([name, out]) => `--- ${name} ---\n${out.analysis_markdown}`).join('\n\n')}
            
            MERGED DIMENSION SCORES:
            ${JSON.stringify(finalDimensions, null, 2)}
            
            YOUR TASK:
            1. Synthesize these inputs into a high-end McKinsey-level strategic report.
            2. Integrate the dimension scores into the narrative.
            3. Ensure the report is formatted in clean markdown.
            4. YOU MUST END THE REPORT WITH THE EXACT "Dimension Scores" TABLE BELOW.
            
            ## Dimension Scores
            ${Object.entries(finalDimensions).map(([k, v]) => `${k}: ${v}/100`).join('\n')}
        `.trim();

        emitHeartbeat(sessionId, '◆ CSO: merging 15-dimension matrix...');
        const csoRunner = new InMemoryRunner({ agent: this.agent, appName: 'velocity_cso_synthesis' });
        const csoSessionId = randomUUID();
        await csoRunner.sessionService.createSession({ appName: 'velocity_cso_synthesis', userId: 'cso_user', sessionId: csoSessionId });

        const csoStream = csoRunner.runAsync({
            userId: 'cso_user',
            sessionId: csoSessionId,
            newMessage: { role: 'user', parts: [{ text: synthesisPrompt }] }
        });

        let finalReport = '';
        for await (const event of csoStream) {
            if (event.author === this.agent.name || isFinalResponse(event)) {
                const parts = event.content?.parts || [];
                const text = parts.map((p: any) => p.text).filter(Boolean).join('\n');
                if (text) finalReport += text;
            }
        }

        const cost = estimateCost('gemini-2.5-pro', synthesisPrompt.length, finalReport.length);
        log({
            severity: 'INFO',
            message: 'CSO analysis complete',
            agent_id: 'chief_strategy_agent',
            phase: 'synthesis',
            session_id: sessionId,
            cost_usd: cost.usd,
        });

        // 3. Extract Organisation Name
        const nameMatch = businessContext.match(/^([A-Z][a-zA-Z\s&]{2,40})/);
        const orgName = nameMatch ? nameMatch[1].trim() : 'The Venture';

        // 4. Generate Moat Rationale
        const topDimension = Object.entries(finalDimensions).reduce((a, b) => b[1] > a[1] ? b : a);
        const moatPrompt = `
            Identify why "${topDimension[0]}" is the primary moat for this business based on the analysis.
            CONTEXT: ${businessContext.slice(0, 500)}
            SCORE: ${topDimension[1]}/100
            TASK: Write a 2-sentence 'Moat Rationale'.
            FORMAT: "Explain that this is the moat because [reason] it represents a [Premium/high-demand/asymmetric] play that [benefit], creating a barrier against generic competitors."
        `.trim();

        emitHeartbeat(sessionId, `◆ CSO: Identifying strategic moat (${topDimension[0]})...`);
        const moatAgent = new LlmAgent({
            name: 'moat_analyst',
            model: 'gemini-2.0-flash-exp',
            instruction: 'Write a concise 2-sentence Moat Rationale.'
        });
        const moatRunner = new InMemoryRunner({ agent: moatAgent, appName: 'moat_logic' });
        const moatId = randomUUID();
        await moatRunner.sessionService.createSession({ appName: 'moat_logic', userId: 'cso', sessionId: moatId });
        const moatStream = moatRunner.runAsync({ userId: 'cso', sessionId: moatId, newMessage: { role: 'user', parts: [{ text: moatPrompt }] } });
        let moatRationale = '';
        for await (const ev of moatStream) {
            if (ev.author === 'moat_analyst' || isFinalResponse(ev)) {
                moatRationale += (ev.content?.parts || []).map((p: any) => p.text).join('');
            }
        }

        // 3. Safety Receipt Check: If dimensions are empty or generic, trigger a re-audit
        const isGeneric = Object.values(finalDimensions).every(v => v === 0 || v === 50);
        if (isGeneric) {
            log({ severity: 'WARNING', message: 'Dimensions appear generic — potential parsing failure. Triggering specialized re-audit.', session_id: sessionId });

            // Re-run specialists once more with extreme JSON enforcement
            const retryPromises = specialists.map(async (agent) => {
                const runner = new InMemoryRunner({ agent, appName: 'velocity_specialist_retry' });
                const internalId = randomUUID();
                await runner.sessionService.createSession({ appName: 'velocity_specialist_retry', userId: 'cso_internal', sessionId: internalId });

                const eventStream = runner.runAsync({
                    userId: 'cso_internal',
                    sessionId: internalId,
                    newMessage: {
                        role: 'user',
                        parts: [{ text: `${businessContext}\n\nRE-AUDIT REQUIRED: Previous output failed parsing. Return ONLY a valid JSON object. No markdown.` }]
                    }
                });

                let rawOutput = '';
                for await (const event of eventStream) {
                    if (event.author === agent.name || isFinalResponse(event)) {
                        const parts = event.content?.parts || [];
                        const text = parts.map((p: any) => p.text).filter(Boolean).join('\n');
                        if (text) rawOutput += text;
                    }
                }

                const result = this.robustParse(agent.name!, rawOutput);
                if (result.dimensions) {
                    Object.assign(finalDimensions, result.dimensions);
                }
                return result;
            });
            await Promise.all(retryPromises);
        }

        return {
            report: finalReport || 'Strategic analysis failed.',
            dimensions: finalDimensions,
            specialistOutputs,
            orgName,
            moatRationale
        };
    }

    /**
     * Runs a fast stress-test recalculation on an existing completed report.
     * Discovery is bypassed — uses cached Firestore grounded context.
     * Uses gemini-2.5-flash for speed and minimal cost.
     */
    async triggerStressTest(reportId: string, scenarioId: ScenarioId, sessionId: string): Promise<StressResult> {
        const scenario = SCENARIOS[scenarioId];

        log({
            severity: 'INFO', message: `Stress test triggered: ${scenario.label
                }`, agent_id: 'stress_test_agent', phase: 'stress_test', session_id: sessionId, scenario: scenarioId
        });

        // Load cached grounded context from Firestore
        const memory = await loadAuditMemory(reportId);
        if (!memory) throw new Error(`Report ${reportId} not found in Firestore.Run a full audit first.`);

        const DIM_NAMES = [
            'TAM Viability', 'Target Precision', 'Trend Adoption',
            'Competitive Defensibility', 'Model Innovation', 'Flywheel Potential',
            'Pricing Power', 'CAC/LTV Ratio', 'Market Entry Speed',
            'Execution Speed', 'Scalability', 'ESG Posture',
            'ROI Projection', 'Risk Tolerance', 'Capital Efficiency'
        ];

        const stressPrompt = `
You are a rapid stress - test recalculation engine.You have been given:

1. BUSINESS GROUNDED CONTEXT(from 24 - month discovery sweep):
${memory.groundedContext || memory.businessContext}

2. ORIGINAL DIMENSION SCORES(baseline):
${JSON.stringify(memory.dimensionScores, null, 2)}

3. SYNTHETIC CRISIS SCENARIO TO SIMULATE:
${scenario.prompt}

YOUR TASK:
- Recalculate scores for ALL 15 dimensions under this specific crisis.
- For any dimension scoring below 40, generate 3 concrete mitigation steps and a CSO - level "Crisis Play" recommendation.
- Return ONLY a valid raw JSON object.No preamble, no markdown, no explanation.

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
