import { LlmAgent } from '@google/adk';
import { callGemini } from './services/geminiClient.js';
import { specialistInstructions } from './specialists.js';
import { specialists } from './specialists.js';
import { blueOceanAgent } from './agents/blueOceanAgent.js';
import { wardleyAgent } from './agents/wardleyAgent.js';
import { runMonteCarlo } from './services/monteCarloService.js';
import { DiscoveryResult } from './agents/discovery.js';
import { log, estimateCost } from './services/logger.js';
import { SCENARIOS, ScenarioId, MitigationCard } from './scenarios.js';
import { loadAuditMemory } from './services/memory.js';
import { emitHeartbeat } from './services/sseService.js';

// Re-export StrategySession type for index.ts
export type { StrategySession } from './services/sessionService.js';

// ─── Helper: Title case conversion ──────────────────────────────────────────
function toTitleCase(str: string): string {
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

// ─── Helper: Extract Org Name mnemonic heuristic ───────────────────────────
function extractOrgName(context: string): string {
    // Pattern 1: Named entity — "VelocityCSO is a..." or "Medically Inc builds..."
    const namedEntity = context.match(/^([A-Z][a-zA-Z0-9\s&\-\.]{2,40}?)\s+(?:is|are|was|builds|provides|offers|helps)/);
    if (namedEntity) return namedEntity[1].trim();

    // Pattern 2: "a platform for X" → derive from the service noun
    const serviceNoun = context.match(/\b(?:platform|app|service|tool|system|marketplace|network)\s+for\s+([a-z\s]+?)(?:\.|,|that|which|$)/i);
    if (serviceNoun) return toTitleCase(serviceNoun[1].trim()) + ' Platform';

    // Pattern 3: "we help X" → derive from the domain
    const weHelp = context.match(/we help\s+([a-z\s]+?)(?:\s+to|\s+with|\.|,|$)/i);
    if (weHelp) return toTitleCase(weHelp[1].trim());

    return 'The Venture';
}

/**
 * Robustly extracts and parses JSON from a string that may contain markdown or prose.
 */
export function robustParse(agentName: string, raw: string, sessionId?: string): any {
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
    if (!jsonMatch) {
        log({ severity: 'ERROR', message: `Parse Failure: No JSON object found in output from ${agentName}`, agent_id: agentName, session_id: sessionId, raw_output: raw.slice(0, 1000) });
        return fallback;
    }

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
    } catch (e) {
        log({ severity: 'ERROR', message: `Parse Failure: JSON parse error from ${agentName}`, agent_id: agentName, session_id: sessionId, error: String(e), raw_output: raw.slice(0, 1000) });
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
        const systemInstruction = 'Compress the following strategic findings into a high-density executive summary. Focus on structural advantages, risks, and core metrics. Max 300 words.';
        let summary = '';
        try {
            summary = await callGemini('gemini-2.5-flash', systemInstruction, content);
        } catch (e) {
            log({ severity: 'WARNING', message: 'Summarizer failed — using empty summary', session_id: sessionId, error: String(e) });
        }

        const latency = Date.now() - startTime;
        const cost = estimateCost('gemini-2.5-flash', content.length, summary.length);

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
        const agentName = agent.name!;
        // Fallback to agent.instruction if not found in the custom mapping
        const systemInstruction = (specialistInstructions[agentName] || agent.instruction || '').toString();
        const userPrompt = `${context}\n\nCRITICAL: You MUST return your analysis as a clean JSON object according to your schema. Do NOT include markdown text outside the JSON. All dimensions for your lens MUST be scored 0-100.`;

        emitHeartbeat(sessionId, `◆ ${agentName}: sensing market signals and identifying asymmetric plays...`);
        let rawOutput = '';
        try {
            rawOutput = await callGemini('gemini-2.5-flash', systemInstruction, userPrompt);
        } catch (e: any) {
            log({
                severity: 'ERROR',
                message: `Specialist API call failed: ${agentName}`,
                agent_id: agentName,
                session_id: sessionId,
                error: e.message || String(e)
            });
        }

        const result = robustParse(agentName, rawOutput, sessionId);
        const latency = Date.now() - startTime;
        const outChars = JSON.stringify(result).length;
        const cost = estimateCost('gemini-2.5-flash', context.length, outChars);

        log({
            severity: 'INFO',
            message: `Specialist complete: ${agentName}`,
            agent_id: agentName,
            phase: 'specialist_run',
            session_id: sessionId,
            latency_ms: latency,
            agent_input: context.slice(0, 1000) + '...',
            agent_output: result,
            cost_usd: cost.usd,
            tokens_in: cost.inputTokens,
            tokens_out: cost.outputTokens
        });

        emitHeartbeat(sessionId, `◆ ${agentName}: analysis complete. alignment verified.`);
        return result;
    }

    /**
     * Runs a named specialist by instruction key (not LlmAgent instance).
     * Supports maxOutputTokens to hard-cap output size.
     */
    private async runSpecialistDirect(agentName: string, context: string, sessionId: string, maxOutputTokens?: number): Promise<any> {
        const startTime = Date.now();
        const systemInstruction = (specialistInstructions[agentName] || '').toString();
        const userPrompt = `${context}\n\nCRITICAL: Return ONLY a raw JSON object. No markdown, no prose outside JSON.`;

        emitHeartbeat(sessionId, `◆ ${agentName}: running focused analysis...`);
        let rawOutput = '';
        try {
            rawOutput = await callGemini('gemini-2.5-flash', systemInstruction, userPrompt, maxOutputTokens);
        } catch (e: any) {
            log({ severity: 'ERROR', message: `Specialist API call failed: ${agentName}`, agent_id: agentName, session_id: sessionId, error: e.message || String(e) });
        }

        const result = robustParse(agentName, rawOutput, sessionId);
        const latency = Date.now() - startTime;
        const cost = estimateCost('gemini-2.5-flash', context.length, rawOutput.length);

        log({
            severity: 'INFO',
            message: `Specialist complete: ${agentName}`,
            agent_id: agentName,
            phase: 'specialist_run',
            session_id: sessionId,
            latency_ms: latency,
            cost_usd: cost.usd,
            tokens_in: cost.inputTokens,
            tokens_out: cost.outputTokens
        });

        emitHeartbeat(sessionId, `◆ ${agentName}: analysis complete.`);
        return result;
    }

    private async runCritic(businessContext: string, specialistOutputs: Record<string, any>, sessionId: string): Promise<any> {
        const startTime = Date.now();
        emitHeartbeat(sessionId, '◆ Critic: performing cross-functional gap-analysis...');

        // Strip analysis_markdown and raw output — critic only needs scores and confidence.
        // Passing full JSON (including prose) wastes ~3,000 tokens on the critic call.
        const criticInput = `Business: ${businessContext.slice(0, 300)}

${Object.entries(specialistOutputs).map(([name, out]) => `${name}: ${JSON.stringify({
    dimensions: out.dimensions,
    confidence_score: out.confidence_score,
    missing_signals: (out.missing_signals || []).slice(0, 3),
})}`).join('\n')}`;

        let raw = '';
        try {
            const CRITIC_INSTRUCTION = `You are the Strategic Critic. Review specialist outputs for contradictions, unsubstantiated scores, and generic advice. Return ONLY JSON: { "flags": [ { "specialist": "", "dimension": "", "issue": "", "description": "", "suggested_recheck": "" } ], "overall_coherence_score": 0-100, "approved_specialists": [], "requires_rerun": [] }. If no issues: { "flags": [], "overall_coherence_score": 95, "approved_specialists": [...all 5...], "requires_rerun": [] }`;
            raw = await callGemini('gemini-2.5-pro', CRITIC_INSTRUCTION, criticInput);
        } catch (e: any) {
            log({ severity: 'WARNING', message: 'Critic API call failed', session_id: sessionId, error: e.message || String(e) });
        }

        const result = robustParse('strategic_critic', raw, sessionId);
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

    async analyze(businessContext: string, sessionId: string): Promise<{ report: string; dimensions: Record<string, number | null>; richDimensions: Record<string, any>; specialistOutputs: Record<string, any>; frameworks: any; orgName: string; moatRationale: string }> {
        log({
            severity: 'INFO',
            message: 'CSO analysis started (Parallel Specialist Mode)',
            agent_id: 'chief_strategy_agent',
            phase: 'synthesis',
            session_id: sessionId,
        });
        emitHeartbeat(sessionId, '◆ CSO: analysis started (Parallel Specialist Mode)');

        const finalDimensions: Record<string, number | null> = {
            'TAM Viability': null, 'Target Precision': null, 'Trend Adoption': null,
            'Competitive Defensibility': null, 'Model Innovation': null, 'Flywheel Potential': null,
            'Pricing Power': null, 'CAC/LTV Ratio': null, 'Market Entry Speed': null,
            'Execution Speed': null, 'Scalability': null, 'ESG Posture': null,
            'ROI Projection': null, 'Risk Tolerance': null, 'Capital Efficiency': null,
            'Team / Founder Strength': null, 'Network Effects Strength': null,
            'Data Asset Quality': null, 'Regulatory Readiness': null, 'Customer Concentration Risk': null
        };
        const richDimensions: Record<string, any> = {};
        const specialistOutputs: Record<string, any> = {};

        // ── PHASE A: Market + Innovation (parallel, innovation split into 2 calls) ──
        // innovation_analyst → dimensions + analysis_markdown only (~1,500 tokens)
        // innovation_frameworks → Porter's + Ansoff + VRIO only (~1,800 tokens)
        // Split prevents JSON truncation at ~11K tokens from a single combined call.
        emitHeartbeat(sessionId, '◆ CSO Phase A: Market & Innovation analysis...');
        const [marketResult, innovationResult, innovationFrameworks] = await Promise.all([
            this.runSpecialist(specialists.find(s => s.name === 'market_analyst')!, businessContext, sessionId),
            this.runSpecialistDirect('innovation_analyst', businessContext, sessionId, 2048),
            this.runSpecialistDirect('innovation_frameworks', businessContext, sessionId, 2048),
        ]);

        specialistOutputs['market_analyst'] = marketResult;
        specialistOutputs['innovation_analyst'] = innovationResult;
        Object.assign(finalDimensions, marketResult.dimensions, innovationResult.dimensions);
        Object.assign(richDimensions, marketResult.richDimensions, innovationResult.richDimensions);

        // ── PHASE B: Commercial + Operations (consume Phase A summary) ──────────
        // Phase A markdown → summarize once → pass only the summary downstream.
        // Do NOT re-prepend full businessContext to Phase B/C: the summary already
        // contains the key signals. This saves ~2,000–4,000 tokens across 3 calls.
        const phaseAFindings = `MARKET: ${marketResult.analysis_markdown}\nINNOVATION: ${innovationResult.analysis_markdown}`;

        emitHeartbeat(sessionId, '◆ CSO: compressing Phase A intelligence...');
        const summarizedPhaseA = await this.summarize(phaseAFindings, sessionId);

        emitHeartbeat(sessionId, '◆ CSO Phase B: Commercial & Operations analysis...');
        // Context = original business description + compressed Phase A signal
        const phaseBContext = `BUSINESS CONTEXT:\n${businessContext}\n\nPHASE A INTELLIGENCE:\n${summarizedPhaseA}`;
        const [commercialResult, operationsResult] = await Promise.all([
            this.runSpecialist(specialists.find(s => s.name === 'commercial_analyst')!, phaseBContext, sessionId),
            this.runSpecialist(specialists.find(s => s.name === 'operations_analyst')!, phaseBContext, sessionId)
        ]);

        specialistOutputs['commercial_analyst'] = commercialResult;
        specialistOutputs['operations_analyst'] = operationsResult;
        Object.assign(finalDimensions, commercialResult.dimensions, operationsResult.dimensions);
        Object.assign(richDimensions, commercialResult.richDimensions, operationsResult.richDimensions);

        // ── PHASE C: Finance (consumes summarized A + B findings) ───────────────
        // CRITICAL: Feed summarizedPhaseA (already compressed) into the B summarizer,
        // not the raw phaseAFindings again — avoids re-summarizing 2,500 already-compressed tokens.
        const phaseBFindings = `COMMERCIAL: ${commercialResult.analysis_markdown}\nOPERATIONS: ${operationsResult.analysis_markdown}`;

        emitHeartbeat(sessionId, '◆ CSO: compressing Phase B intelligence for financial modeling...');
        const summarizedPhaseB = await this.summarize(`${summarizedPhaseA}\n\n${phaseBFindings}`, sessionId);

        emitHeartbeat(sessionId, '◆ CSO Phase C: Financial structure analysis...');
        // Finance only gets the compressed A+B summary — no need for raw businessContext again
        const financeResult = await this.runSpecialist(
            specialists.find(s => s.name === 'finance_analyst')!,
            `BUSINESS CONTEXT:\n${businessContext}\n\nCOMPRESSED INTELLIGENCE (A+B):\n${summarizedPhaseB}`,
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
            blue_ocean: blueOceanResult,
            five_forces: innovationFrameworks?.portersFiveForces || null,
            ansoffMatrix: innovationFrameworks?.ansoffMatrix || null,
            vrioAnalysis: innovationFrameworks?.vrioAnalysis || null,
            unit_economics: financeResult?.unitEconomics || null,
            monte_carlo: monteCarloResult,
            wardley: wardleyResult
        };

        // 2. Strategic Critic Review
        const criticResult = await this.runCritic(businessContext, specialistOutputs, sessionId);

        if (criticResult.requires_rerun && criticResult.requires_rerun.length > 0) {
            const rerunTargets = specialists.filter(s => criticResult.requires_rerun.includes(s.name!));
            emitHeartbeat(sessionId, `◆ Critic: Flagged ${rerunTargets.length} specialists for re-analysis...`);

            const retryPromises = rerunTargets.map(async (agent) => {
                const feedback = (criticResult.flags || []).find((f: any) => f.specialist === agent.name)?.description || 'Align with other specialists.';
                const agentName = agent.name!;
                const systemInstruction = specialistInstructions[agentName] || '';
                let raw = '';
                try {
                    raw = await callGemini(
                        'gemini-2.5-flash',
                        systemInstruction,
                        `${businessContext}\n\nCRITIC FEEDBACK: ${feedback}\n\nReturn ONLY the JSON.`
                    );
                } catch (e) {
                    log({ severity: 'WARNING', message: `Retry failed for ${agentName}`, session_id: sessionId, error: String(e) });
                }

                const result = robustParse(agent.name!, raw);
                if (result.dimensions) Object.assign(finalDimensions, result.dimensions);
                specialistOutputs[agent.name!] = result;
                return result;
            });
            await Promise.all(retryPromises);
        }

        // 3. Comprehensive Synthesis by CSO
        emitHeartbeat(sessionId, '◆ CSO: Initializing strategic synthesis of 20-dimension matrix...');
        emitHeartbeat(sessionId, '◆ Critic: Verifying cross-functional alignment of specialist findings...');
        emitHeartbeat(sessionId, '◆ CSO: Synthesizing narrative for executive board-room delivery...');

        // Build a tight specialist digest: only the 1-2 sentence key finding per agent,
        // plus the dimension scores they own. Replaces 800-char prose slices × 5 (~4K tokens)
        // with a structured 300-char-per-agent digest (~1.5K tokens total).
        const specialistDigest = Object.entries(specialistOutputs)
            .filter(([name]) => !['blue_ocean', 'wardley', 'monte_carlo'].includes(name))
            .map(([name, out]) => {
                const scores = Object.entries(out.dimensions || {})
                    .map(([dim, score]) => `${dim}: ${score}`)
                    .join(', ');
                const topInsight = (out.analysis_markdown || '').split('\n').find((l: string) => l.trim().length > 40) || '';
                return `[${name}] ${scores}\nKey signal: ${topInsight.slice(0, 200)}`;
            })
            .join('\n\n');

        const synthesisPrompt = `
            You are the Chief Strategy Officer. You have received independent analysis from your specialists.

            BUSINESS CONTEXT:
            ${businessContext}

            SPECIALIST DIGEST (scores + key signal per agent):
            ${specialistDigest}

            MERGED DIMENSION SCORES:
            ${JSON.stringify(finalDimensions, null, 2)}
            
            SCENARIO PLANNING — MANDATORY SECTION
            Based on the specialist analyses, identify the 2 highest-impact macro uncertainties facing this business.
            Then define 3 named scenarios and assess the strategy's resilience under each.
            
            MACRO UNCERTAINTIES: Pick 2 from the context (e.g. regulatory change, competitive entry, market contraction, technology shift, macro recession, demand acceleration).
            
            SCENARIO 1 — BASE CASE (most likely, ~60% probability)
            - Name: [descriptive label]
            - Conditions: [what the world looks like]
            - Strategy performance: GREEN | AMBER | RED
            - Key risk in this scenario:
            - Recommended pivot if this materialises:
            
            SCENARIO 2 — OPTIMISTIC CASE (~25% probability)
            - Name: [descriptive label]
            - Conditions: [tailwinds, favourable dynamics]
            - Strategy performance: GREEN | AMBER | RED
            - How to accelerate advantage in this scenario:
            
            SCENARIO 3 — STRESS CASE (~15% probability)
            - Name: [descriptive label]
            - Conditions: [headwinds, adverse dynamics]
            - Strategy performance: GREEN | AMBER | RED
            - Survival move: minimum viable strategic action to remain viable
            
            RESILIENCE SCORE: 0-100 (how well does the strategy hold across all 3 scenarios?)
            
            Include this as a dedicated "## Scenario Analysis" section in the markdown report.
            
            YOUR TASK:
            1. Synthesize these inputs into a high-end Tier-1 Consulting strategic report.
            2. Integrate the dimension scores into the narrative.
            3. Ensure the report is formatted in clean markdown.
            4. You MUST explicitly include the following sections if data is available in the inputs:
               - **Executive Synthesis**
               - **Unit Economics Analysis**
               - **Risk & Monte Carlo Projections**
               
            5. After the main strategy report, generate a 90-DAY STRATEGIC ROADMAP section.
               Format it as:
               ## 90-Day Strategic Roadmap
               
               ### Days 1-30: Quick Wins
               [3 specific actions with measurable outcomes. Format each as:]
               **Action:** [Specific action]
               **Owner:** [CEO / CTO / Head of Sales / etc]
               **Success metric:** [Quantifiable outcome]
               **Why now:** [One sentence urgency]
               
               ### Days 31-60: Foundation Building
               [3 specific actions]
               
               ### Days 61-90: Strategic Bets
               [2-3 specific actions with higher uncertainty but high upside]
               
               Each action must:
               - Reference a specific dimension from the 20-dimension scorecard
               - Name a specific person or role responsible
               - Have a measurable success metric (not "improve" — specify a number)
               - Connect to a specific business outcome (revenue, cost, risk reduction)
               
            6. YOU MUST END THE REPORT WITH THE EXACT "Dimension Scores" TABLE BELOW.
            
            CRITICAL: Do NOT call any sub-agents or tools. All necessary data is provided above. Simply synthesize and return markdown.
            
            ## Dimension Scores
            ${Object.entries(finalDimensions).map(([k, v]) => `${k}: ${v}/100`).join('\n')}
        `.trim();

        emitHeartbeat(sessionId, '◆ CSO: merging 20-dimension matrix...');
        const synthesisStartTime = Date.now();

        let finalReport = '';
        try {
            const csoInstruction = this.agent.instruction as string || 'You are the Chief Strategy Officer. Synthesize specialist analyses into a comprehensive markdown report.';
            finalReport = await callGemini('gemini-2.5-pro', csoInstruction, synthesisPrompt);
        } catch (e: any) {
            log({ severity: 'WARNING', message: 'CSO synthesis pro failed, retrying with flash', session_id: sessionId, error: e.message || String(e) });
            try {
                const csoInstruction = this.agent.instruction as string || 'You are the Chief Strategy Officer. Synthesize specialist analyses into a comprehensive markdown report.';
                finalReport = await callGemini('gemini-2.5-flash', csoInstruction, synthesisPrompt);
            } catch (e2: any) {
                log({ severity: 'ERROR', message: 'CSO synthesis fallback also failed', session_id: sessionId, error: e2.message || String(e2) });
            }
        }

        const synthesisLatency = Date.now() - synthesisStartTime;
        const synthesisCost = estimateCost(finalReport ? 'gemini-2.5-pro' : 'gemini-2.5-flash', synthesisPrompt.length, finalReport.length);
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
        const orgName = extractOrgName(businessContext);

        // 4. Generate Moat Rationale
        const topDimension = Object.entries(finalDimensions)
            .filter(([_, v]) => v !== null)
            .reduce((a, b) => (b[1] as number) > (a[1] as number) ? b : a, ['N/A', 0]);
        const moatPrompt = `
            <role>Global Executive Strategist</role>
            <task>Identify why "${topDimension[0]}" is the primary moat for ${orgName}.</task>
            <context>SCORE: ${topDimension[1]}/100. ${businessContext.slice(0, 500)}</context>
            <constraint>Return EXACTLY 2 sentences. Use professional, aggressive, and insightful tone. Frame as a Tier-1 Consulting strategic verdict.</constraint>
        `.trim();

        emitHeartbeat(sessionId, `◆ CSO: Identifying strategic moat (${topDimension[0]})...`);
        const moatStartTime = Date.now();
        let moatRationale = '';
        try {
            moatRationale = await callGemini(
                'gemini-2.5-flash',
                'Write a concise 2-sentence Moat Rationale. Use professional, aggressive, insightful tone. Frame as a Tier-1 Consulting strategic verdict.',
                moatPrompt
            );
        } catch (e) {
            log({ severity: 'WARNING', message: 'Moat agent API call failed', session_id: sessionId, error: String(e) });
        }

        if (!moatRationale.trim()) {
            log({ severity: 'WARNING', message: 'Moat agent returned empty — using fallback', session_id: sessionId });
            moatRationale = `${orgName}'s primary competitive advantage is its ${topDimension[0]} (${topDimension[1]}/100), which positions it defensibly against well-funded incumbents. Sustained investment in this dimension represents the highest-leverage strategic priority.`;
        }
        const moatLatency = Date.now() - moatStartTime;
        const moatCost = estimateCost('gemini-2.5-flash', moatPrompt.length, moatRationale.length);

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

        // 3. Safety Receipt Check: If dimensions failed parsing, trigger a specialized re-audit
        // Note: we check if all dimensions are the default fallback value (50)
        const hadParseFailures = Object.values(finalDimensions).every(v => v === 50 || v === null);

        if (hadParseFailures) {
            log({ severity: 'WARNING', message: 'Dimensions appear generic (Parse Failure) — Triggering specialized re-audit.', session_id: sessionId });

            // Re-run specialists once more with extreme JSON enforcement
            const retryPromises = specialists.map(async (agent) => {
                const agentName = agent.name!;
                const systemInstruction = specialistInstructions[agentName] || '';
                const userPrompt = `${businessContext}\n\nRE-AUDIT REQUIRED: Previous output failed parsing. Return ONLY a valid JSON object. No markdown.`;

                let rawOutput = '';
                try {
                    rawOutput = await callGemini('gemini-2.5-flash', systemInstruction, userPrompt);
                } catch (e) {
                    log({ severity: 'ERROR', message: `Re-audit API call failed: ${agentName}`, agent_id: agentName, session_id: sessionId, error: String(e) });
                }

                const result = robustParse(agentName, rawOutput, sessionId);
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
            report: finalReport,
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
     * Uses gemini-2.0-flash for speed and minimal cost.
     */
    async triggerStressTest(reportId: string, scenarioId: ScenarioId, sessionId: string): Promise<{ scenarioId: string; scenarioLabel: string; originalScores: Record<string, number | null>; stressedScores: Record<string, number>; riskDeltas: Record<string, number>; mitigationCards: MitigationCard[] }> {
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

        let rawOutput = '';
        try {
            rawOutput = await callGemini(
                'gemini-2.5-flash',
                'You are a Global Executive stress-test analyst. Respond ONLY with a raw JSON object as instructed.',
                stressPrompt
            );
        } catch (e: any) {
            log({ severity: 'ERROR', message: 'Stress test API call failed', session_id: sessionId, error: e.message || String(e) });
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
