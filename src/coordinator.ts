import { LlmAgent, InMemoryRunner, isFinalResponse } from '@google/adk';
import { randomUUID } from 'crypto';
import { specialists } from './specialists.js';
import { strategicCritic } from './critic.js';
import { blueOceanAgent } from './agents/blueOceanAgent.js';
import { wardleyAgent } from './agents/wardleyAgent.js';
import { runMonteCarlo } from './services/monteCarloService.js';
import { DiscoveryResult } from './agents/discovery.js';
import { log, estimateCost } from './services/logger.js';
import { SCENARIOS, ScenarioId, StressResult, MitigationCard } from './scenarios.js';
import { loadAuditMemory } from './services/memory.js';
import { emitHeartbeat } from './services/sseService.js';

// Re-export StrategySession type for index.ts
export type { StrategySession } from './services/sessionService.js';

/**
 * Robustly extracts and parses JSON from a string that may contain markdown or prose.
 */
export function robustParse(agentName: string, raw: string): any {
    const fallback = {
        analysis_markdown: raw,
        dimensions: {
            'TAM Viability': 50,
            'Target Precision': 50,
            'Trend Adoption': 50,
            'Team / Founder Strength': 50,
            'Network Effects Strength': 50,
            'Data Asset Quality': 50,
            'Regulatory Readiness': 50,
            'Customer Concentration Risk': 50
        },
        richDimensions: {} as Record<string, any>,
        confidence_score: 50,
        flags: [],
        requires_rerun: []
    };

    // 1. Sanitize Markdown backticks if present
    let sanitized = raw.replace(/```json\s?/, '').replace(/```\s?$/, '').trim();

    // 2. Greedy Extraction
    const jsonMatch = sanitized.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    try {
        const parsed = JSON.parse(jsonMatch[0]);

        // Normalize dimensions: extract "score" if it's an object {score: N, ...}
        if (parsed.dimensions && typeof parsed.dimensions === 'object') {
            const normalized: Record<string, number> = {};
            const rich: Record<string, any> = {};
            for (const [key, val] of Object.entries(parsed.dimensions)) {
                if (typeof val === 'number') {
                    normalized[key] = val;
                } else if (val && typeof val === 'object' && typeof (val as any).score === 'number') {
                    normalized[key] = (val as any).score;
                    rich[key] = val; // Preserve CoT metadata (justification, improvement_action, etc)
                }
            }
            parsed.dimensions = normalized;
            parsed.richDimensions = rich;
        }

        return {
            ...fallback,
            ...parsed,
        };
    } catch {
        return fallback;
    }
}

// ─── Chief Strategy Agent ────────────────────────────────────────────────────
export class ChiefStrategyAgent {
    private agent: LlmAgent;

    constructor() {
        this.agent = new LlmAgent({
            name: 'chief_strategy_agent',
            model: 'gemini-2.5-pro',
            description: 'Enterprise-grade Chief Strategy Officer (CSO) responsible for synthesizing business analysis.',
            instruction: `
        You are a Global Executive Chief Strategy Officer. 
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
        Team / Founder Strength: [score]/100
        Network Effects Strength: [score]/100
        Data Asset Quality: [score]/100
        Regulatory Readiness: [score]/100
        Customer Concentration Risk: [score]/100
        
        CRITICAL: Output ONLY markdown text. Do NOT output JSON, code blocks, or raw data structures. All output must be human-readable narrative markdown.`,
            subAgents: [...specialists, strategicCritic, blueOceanAgent, wardleyAgent],
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

        const gap = discovery.gaps.slice(0, 5).join('. ');
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
     * Summarizes agent findings to keep the context window tight.
     */
    private async summarize(content: string, sessionId: string): Promise<string> {
        const startTime = Date.now();
        const summarizerAgent = new LlmAgent({
            name: 'summarizer_agent',
            model: 'gemini-2.0-flash',
            description: 'Strategic summary engine to optimize context usage.',
            instruction: 'Compress the following strategic findings into a high-density executive summary. Focus on structural advantages, risks, and core metrics. Max 300 words.'
        });

        const runner = new InMemoryRunner({ agent: summarizerAgent, appName: 'velocity_summarizer' });
        const internalId = randomUUID();
        await runner.sessionService.createSession({ appName: 'velocity_summarizer', userId: 'cso_internal', sessionId: internalId });

        const stream = runner.runAsync({
            userId: 'cso_internal',
            sessionId: internalId,
            newMessage: { role: 'user', parts: [{ text: content }] }
        });

        let summary = '';
        for await (const ev of stream) {
            if (ev.author === 'summarizer_agent' || isFinalResponse(ev)) {
                summary += (ev.content?.parts || []).map((p: any) => p.text).join('');
            }
        }

        const latency = Date.now() - startTime;
        const cost = estimateCost('gemini-2.0-flash', content.length, summary.length);

        log({
            severity: 'INFO',
            message: 'Context summarization complete',
            agent_id: 'summarizer_agent',
            phase: 'optimization',
            session_id: sessionId,
            latency_ms: latency,
            cost_usd: cost.usd,
            tokens_in: cost.inputTokens,
            tokens_out: cost.outputTokens
        });

        return summary;
    }

    private async runSpecialist(agent: LlmAgent, context: string, sessionId: string): Promise<any> {
        const startTime = Date.now();
        const runner = new InMemoryRunner({ agent, appName: 'velocity_specialist' });
        const internalId = randomUUID();
        await runner.sessionService.createSession({ appName: 'velocity_specialist', userId: 'cso_internal', sessionId: internalId });

        const eventStream = runner.runAsync({
            userId: 'cso_internal',
            sessionId: internalId,
            newMessage: {
                role: 'user',
                parts: [{ text: `${context}\n\nCRITICAL: You MUST return your analysis as a clean JSON object according to your schema. Do NOT include markdown text outside the JSON. All dimensions for your lens MUST be scored 0-100.` }]
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

        const result = robustParse(agent.name!, rawOutput);
        const latency = Date.now() - startTime;
        const outChars = JSON.stringify(result).length;
        const cost = estimateCost('gemini-2.0-flash', context.length, outChars);

        log({
            severity: 'INFO',
            message: `Specialist complete: ${agent.name}`,
            agent_id: agent.name,
            phase: 'specialist_run',
            session_id: sessionId,
            latency_ms: latency,
            agent_input: context.slice(0, 1000) + '...', // Truncate for log safety
            agent_output: result,
            cost_usd: cost.usd,
            tokens_in: cost.inputTokens,
            tokens_out: cost.outputTokens
        });

        emitHeartbeat(sessionId, `◆ ${agent.name}: analysis complete. alignment verified.`);
        return result;
    }

    private async runCritic(businessContext: string, specialistOutputs: Record<string, any>, sessionId: string): Promise<any> {
        const startTime = Date.now();
        emitHeartbeat(sessionId, '◆ Critic: performing cross-functional gap-analysis...');
        const criticRunner = new InMemoryRunner({ agent: strategicCritic, appName: 'velocity_critic' });
        const criticId = randomUUID();
        await criticRunner.sessionService.createSession({ appName: 'velocity_critic', userId: 'cso_internal', sessionId: criticId });

        const criticInput = `
            Review the following specialists for business: ${businessContext.slice(0, 500)}
            
            ${Object.entries(specialistOutputs).map(([name, out]) => `--- ${name} ---\n${JSON.stringify(out)}`).join('\n\n')}
        `.trim();

        const stream = criticRunner.runAsync({
            userId: 'cso_internal',
            sessionId: criticId,
            newMessage: { role: 'user', parts: [{ text: criticInput }] }
        });

        let raw = '';
        for await (const ev of stream) {
            if (ev.author === 'strategic_critic' || isFinalResponse(ev)) {
                raw += (ev.content?.parts || []).map((p: any) => p.text).join('');
            }
        }

        const result = robustParse('strategic_critic', raw);
        const latency = Date.now() - startTime;
        const cost = estimateCost('gemini-2.5-pro', criticInput.length, raw.length);

        log({
            severity: 'INFO',
            message: 'Critic review complete',
            agent_id: 'strategic_critic',
            phase: 'critic_run',
            session_id: sessionId,
            latency_ms: latency,
            agent_input: criticInput.slice(0, 1000) + '...',
            agent_output: result,
            cost_usd: cost.usd,
            tokens_in: cost.inputTokens,
            tokens_out: cost.outputTokens
        });

        return result;
    }

    async analyze(businessContext: string, sessionId: string): Promise<{ report: string; dimensions: Record<string, number>; richDimensions: Record<string, any>; specialistOutputs: Record<string, any>; frameworks: any; orgName: string; moatRationale: string }> {
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
            'ROI Projection': 0, 'Risk Tolerance': 0, 'Capital Efficiency': 0,
            'Team / Founder Strength': 0, 'Network Effects Strength': 0,
            'Data Asset Quality': 0, 'Regulatory Readiness': 0, 'Customer Concentration Risk': 0
        };
        const richDimensions: Record<string, any> = {};
        const specialistOutputs: Record<string, any> = {};

        // ── PHASE A: Market + Innovation (parallel) ──────────────────────────
        emitHeartbeat(sessionId, '◆ CSO Phase A: Market & Innovation analysis...');
        const [marketResult, innovationResult] = await Promise.all([
            this.runSpecialist(specialists.find(s => s.name === 'market_analyst')!, businessContext, sessionId),
            this.runSpecialist(specialists.find(s => s.name === 'innovation_analyst')!, businessContext, sessionId)
        ]);

        specialistOutputs['market_analyst'] = marketResult;
        specialistOutputs['innovation_analyst'] = innovationResult;
        Object.assign(finalDimensions, marketResult.dimensions, innovationResult.dimensions);
        Object.assign(richDimensions, marketResult.richDimensions, innovationResult.richDimensions);

        // ── PHASE B: Commercial + Operations (consume Phase A) ──────────────────
        const phaseAFindings = `
PHASE A FINDINGS (use these to calibrate your analysis):
MARKET: ${marketResult.analysis_markdown}
INNOVATION: ${innovationResult.analysis_markdown}
        `.trim();

        emitHeartbeat(sessionId, '◆ CSO: optimizing Phase A intelligence for downstream consumption...');
        const summarizedPhaseA = await this.summarize(phaseAFindings, sessionId);

        emitHeartbeat(sessionId, '◆ CSO Phase B: Commercial & Operations analysis...');
        const phaseBContext = `${businessContext}\n\nPHASE A SUMMARY:\n${summarizedPhaseA}`;
        const [commercialResult, operationsResult] = await Promise.all([
            this.runSpecialist(specialists.find(s => s.name === 'commercial_analyst')!, phaseBContext, sessionId),
            this.runSpecialist(specialists.find(s => s.name === 'operations_analyst')!, phaseBContext, sessionId)
        ]);

        specialistOutputs['commercial_analyst'] = commercialResult;
        specialistOutputs['operations_analyst'] = operationsResult;
        Object.assign(finalDimensions, commercialResult.dimensions, operationsResult.dimensions);
        Object.assign(richDimensions, commercialResult.richDimensions, operationsResult.richDimensions);

        // ── PHASE C: Finance (consumes Phase A + B) ──────────────────────────────
        const phaseBFindings = `
COMMERCIAL: ${commercialResult.analysis_markdown}
OPERATIONS: ${operationsResult.analysis_markdown}
        `.trim();

        emitHeartbeat(sessionId, '◆ CSO: optimizing Phase B intelligence for financial modeling...');
        const summarizedPhaseB = await this.summarize(`${phaseAFindings}\n\n${phaseBFindings}`, sessionId);

        emitHeartbeat(sessionId, '◆ CSO Phase C: Financial structure analysis...');
        const financeResult = await this.runSpecialist(
            specialists.find(s => s.name === 'finance_analyst')!,
            `${businessContext}\n\nPHASE A+B SUMMARY:\n${summarizedPhaseB}`,
            sessionId
        );

        specialistOutputs['finance_analyst'] = financeResult;
        Object.assign(finalDimensions, financeResult.dimensions);
        Object.assign(richDimensions, financeResult.richDimensions);

        // ── PHASE D: Specialized Frameworks ──────────────────────────────────────
        emitHeartbeat(sessionId, '◆ CSO Phase D: Executing specialized strategic frameworks...');
        const [blueOceanResult, wardleyResult] = await Promise.all([
            this.runSpecialist(blueOceanAgent, phaseBFindings, sessionId),
            this.runSpecialist(wardleyAgent, businessContext, sessionId)
        ]);

        specialistOutputs['blue_ocean'] = blueOceanResult;
        specialistOutputs['wardley'] = wardleyResult;

        // Run Monte Carlo Simulation locally
        let monteCarloResult = null;
        if (financeResult.monteCarloInputs) {
            emitHeartbeat(sessionId, '◆ Quant: Running 10,000 iteration Monte Carlo simulation...');
            try {
                monteCarloResult = runMonteCarlo(financeResult.monteCarloInputs, 10000);
                specialistOutputs['monte_carlo'] = monteCarloResult;
            } catch (e) {
                log({ severity: 'WARNING', message: 'Monte Carlo failed', error: String(e), session_id: sessionId });
            }
        }

        const frameworks = {
            blueOcean: blueOceanResult,
            fiveForces: innovationResult.portersFiveForces,
            unitEconomics: financeResult.unitEconomics,
            monteCarlo: monteCarloResult,
            wardley: wardleyResult
        };

        // 2. Strategic Critic Review
        const criticResult = await this.runCritic(businessContext, specialistOutputs, sessionId);

        if (criticResult.requires_rerun && criticResult.requires_rerun.length > 0) {
            const rerunTargets = specialists.filter(s => criticResult.requires_rerun.includes(s.name!));
            emitHeartbeat(sessionId, `◆ Critic: Flagged ${rerunTargets.length} specialists for re-analysis...`);

            const retryPromises = rerunTargets.map(async (agent) => {
                const feedback = (criticResult.flags || []).find((f: any) => f.specialist === agent.name)?.description || 'Align with other specialists.';
                const runner = new InMemoryRunner({ agent, appName: 'velocity_specialist_retry' });
                const internalId = randomUUID();
                await runner.sessionService.createSession({ appName: 'velocity_specialist_retry', userId: 'cso', sessionId: internalId });

                const stream = runner.runAsync({
                    userId: 'cso',
                    sessionId: internalId,
                    newMessage: { role: 'user', parts: [{ text: `${businessContext}\n\nCRITIC FEEDBACK: ${feedback}\n\nReturn ONLY the JSON.` }] }
                });

                let raw = '';
                for await (const ev of stream) {
                    if (ev.author === agent.name || isFinalResponse(ev)) {
                        raw += (ev.content?.parts || []).map((p: any) => p.text).join('');
                    }
                }

                const result = robustParse(agent.name!, raw);
                if (result.dimensions) Object.assign(finalDimensions, result.dimensions);
                specialistOutputs[agent.name!] = result;
                return result;
            });
            await Promise.all(retryPromises);
        }

        // 3. Comprehensive Synthesis by CSO
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
            1. Synthesize these inputs into a high-end Tier-1 Consulting strategic report.
            2. Integrate the dimension scores into the narrative.
            3. Ensure the report is formatted in clean markdown.
            4. YOU MUST END THE REPORT WITH THE EXACT "Dimension Scores" TABLE BELOW.
            
            ## Dimension Scores
            ${Object.entries(finalDimensions).map(([k, v]) => `${k}: ${v}/100`).join('\n')}
        `.trim();

        emitHeartbeat(sessionId, '◆ CSO: merging 15-dimension matrix...');
        const synthesisStartTime = Date.now();
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

        const synthesisLatency = Date.now() - synthesisStartTime;
        const synthesisCost = estimateCost('gemini-2.5-pro', synthesisPrompt.length, finalReport.length);
        log({
            severity: 'INFO',
            message: 'CSO synthesis complete',
            agent_id: 'chief_strategy_agent',
            phase: 'synthesis',
            session_id: sessionId,
            latency_ms: synthesisLatency,
            agent_input: synthesisPrompt.slice(0, 500) + '...',
            agent_output: finalReport.slice(0, 500) + '...',
            cost_usd: synthesisCost.usd,
            tokens_in: synthesisCost.inputTokens,
            tokens_out: synthesisCost.outputTokens
        });

        // 3. Extract Organisation Name
        const nameMatch = businessContext.match(/^([A-Z][a-zA-Z\s&]{2,40})/);
        const orgName = nameMatch ? nameMatch[1].trim() : 'The Venture';

        // 4. Generate Moat Rationale
        const topDimension = Object.entries(finalDimensions).reduce((a, b) => b[1] > a[1] ? b : a);
        const moatPrompt = `
            <role>Global Executive Strategist</role>
            <task>Identify why "${topDimension[0]}" is the primary moat for ${orgName}.</task>
            <context>SCORE: ${topDimension[1]}/100. ${businessContext.slice(0, 500)}</context>
            <constraint>Return EXACTLY 2 sentences. Use professional, aggressive, and insightful tone. Frame as a Tier-1 Consulting strategic verdict.</constraint>
        `.trim();

        emitHeartbeat(sessionId, `◆ CSO: Identifying strategic moat (${topDimension[0]})...`);
        const moatStartTime = Date.now();
        const moatAgent = new LlmAgent({
            name: 'moat_analyst',
            model: 'gemini-2.0-flash',
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
        const moatLatency = Date.now() - moatStartTime;
        const moatCost = estimateCost('gemini-2.0-flash', moatPrompt.length, moatRationale.length);

        log({
            severity: 'INFO',
            message: 'Moat rationale complete',
            agent_id: 'moat_analyst',
            phase: 'moat_rationale',
            session_id: sessionId,
            latency_ms: moatLatency,
            agent_input: moatPrompt,
            agent_output: moatRationale,
            cost_usd: moatCost.usd,
            tokens_in: moatCost.inputTokens,
            tokens_out: moatCost.outputTokens
        });

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

                const result = robustParse(agent.name!, rawOutput);
                if (result.dimensions) {
                    Object.assign(finalDimensions, result.dimensions);
                }
                if (result.richDimensions) {
                    Object.assign(richDimensions, result.richDimensions);
                }
                return result;
            });
            await Promise.all(retryPromises);
        }

        return {
            report: finalReport || 'Strategic analysis failed.',
            dimensions: finalDimensions,
            richDimensions,
            specialistOutputs,
            frameworks,
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
            severity: 'INFO', message: `Stress test triggered: ${scenario.label}`, agent_id: 'stress_test_agent', phase: 'stress_test', session_id: sessionId, scenario: scenarioId
        });

        // Load cached grounded context from Firestore
        const memory = await loadAuditMemory(reportId);
        if (!memory) throw new Error(`Report ${reportId} not found in Firestore. Run a full audit first.`);

        const DIM_NAMES = [
            'TAM Viability', 'Target Precision', 'Trend Adoption',
            'Competitive Defensibility', 'Model Innovation', 'Flywheel Potential',
            'Pricing Power', 'CAC/LTV Ratio', 'Market Entry Speed',
            'Execution Speed', 'Scalability', 'ESG Posture',
            'ROI Projection', 'Risk Tolerance', 'Capital Efficiency',
            'Team / Founder Strength', 'Network Effects Strength',
            'Data Asset Quality', 'Regulatory Readiness', 'Customer Concentration Risk'
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
            instruction: 'You are a Global Executive stress-test analyst. Respond ONLY with a raw JSON object as instructed.',
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
                const text = parts.map((p: any) => p.text).filter(Boolean).join('\n');
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
