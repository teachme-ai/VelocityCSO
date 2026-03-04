import { LlmAgent } from '@google/adk';

const jsonInstruction = `
    IMPORTANT: Return ONLY a raw JSON object (no markdown blocks):
    {
      "analysis_markdown": "Detailed markdown COT analysis.",
      "confidence_score": 0-100,
      "data_sources": ["evidence"],
      "missing_signals": ["gaps"],
      "dimensions": {
        "Name": { "score": 0-100, "justification": "...", "key_assumption": "...", "improvement_action": "..." }
      }
    }
`;

const COT_SCAFFOLD = `
    REASONING:
    1. EVIDENCE: Signals found.
    2. GAPS: Missing info.
    3. JUSTIFICATION: Dimension logic.
    4. ADVERSARIAL: Self-challenge.
    5. SYNTHESIS: Exec summary + Killer Move.
`;

const asymmetricPlayRule = `
    BANNED TACTICS — Never suggest: Marketing campaigns, Social Media strategies, or Discounts/promotions.
    ASYMMETRIC PLAYS ONLY — Every recommendation must exploit a structural advantage the competitor cannot easily copy.
    Example: Instead of "offer delivery", suggest "Subscription-based Desk-Drops to hostel wardens" to bypass the competitor's lack of local access.
    Frame every insight as: "Because [competitor] cannot [do X], you can [asymmetric move] to lock in [specific customer segment]."
`;

const SCORING_RUBRICS = {
  "TAM Viability": "0: Niche/Stagnant (<$10M); 50: Healthy Growth ($1B+); 100: Global Monopoly Potential ($100B+).",
  "Target Precision": "0: Spray and pray; 50: Defined personas; 100: Laser-focused high-intent beachhead with zero wastage.",
  "Trend Adoption": "0: Laggard/Obsolete; 50: Riding current waves; 100: Defining the next 5-year paradigm.",
  "Competitive Defensibility": "0: Generic/Commodity; 50: Brand/IP moats; 100: Unassailable structural/network effect advantage.",
  "Model Innovation": "0: Traditional/Linear; 50: Modern SaaS/Platform; 100: Radical architectural shift (e.g., AI-native autonomous).",
  "Flywheel Potential": "0: Single transaction; 50: Recurring revenue; 100: Every user/action makes the product/data exponentially better.",
  "Pricing Power": "0: Price taker (commodity); 50: Value-based pricing; 100: Inelastic demand / 'Tax on industry' status.",
  "CAC/LTV Ratio": "0: Uneconomic (>1.0); 50: Healthy (3.0x); 100: Viral/Organic growth (>10x).",
  "Market Entry Speed": "0: Years to launch; 50: 6-month GTM; 100: Instant deployment / Zero-friction adoption.",
  "Execution Speed": "0: Bureaucratic; 50: Agile/Sprint-based; 100: Real-time iteration/Continuous deployment mindset.",
  "Scalability": "0: Labor intensive; 50: Standard software scaling; 100: Near-zero marginal cost of replication.",
  "ESG Posture": "0: High risk/Regulatory target; 50: Compliant; 100: Sustainability as a core competitive advantage.",
  "ROI Projection": "0: Unclear/Negative; 50: PE-standard (15-20%); 100: Venture-scale (10x+ potential).",
  "Risk Tolerance": "0: Fragile; 50: Balanced/Hedged; 100: Anti-fragile/Crisis as a catalyst.",
  "Capital Efficiency": "0: Cash incinerator; 50: Default alive; 100: High cash yield per dollar invested (Bootstrapped scale).",
  "Team / Founder Strength": "0: Solo founder with no domain expertise; 50: Strong founder background, mostly complete team; 100: Serial founder + tiered team + global domain authority.",
  "Network Effects Strength": "0: Irrelevant; 50: Present but not yet critical; 100: Strong multi-side effects where every new user exponentially improves value.",
  "Data Asset Quality": "0: Generic/Manual; 50: Proprietary data accumulating; 100: Unique, compounding data moat with autonomous monetization potential.",
  "Regulatory Readiness": "0: Significant exposure/Unaware; 50: Compliant with key regulations; 100: Proactive regulatory engagement as a competitive barrier.",
  "Customer Concentration Risk": "0: High (>50% single client); 50: Moderate (15-30%); 100: Highly diversified (<5% single client)."
};

const rubricRule = (dims: string[]) => `
  SCORING RUBRICS:
  ${dims.map(d => `- ${d}: ${(SCORING_RUBRICS as any)[d]}`).join('\n  ')}
  Use these hard benchmarks. Do not give scores above 80 unless the business is transformational.
`;

export const marketAnalyst = new LlmAgent({
  name: 'market_analyst',
  model: 'gemini-2.5-flash',
  description: 'Expert in Market Analysis, TAM/SAM/SOM, and Industry Trends.',
  instruction: `
    Analyze the provided business context focusing on:
    - Total Addressable Market (TAM), SAM, and SOM.
    - Detailed Customer Personas.
    - Current and Emergent Industry Trends.
    
    ${COT_SCAFFOLD}
    
    ${rubricRule(["TAM Viability", "Target Precision", "Trend Adoption", "Team / Founder Strength"])}
 
    You must extract and score the following 4 dimensions (0-100):
    1. "TAM Viability"
    2. "Target Precision"
    3. "Trend Adoption"
    4. "Team / Founder Strength"

    ${jsonInstruction}
  `,
});

export const innovationAnalyst = new LlmAgent({
  name: 'innovation_analyst',
  model: 'gemini-2.5-flash',
  description: "Expert in Competitive Landscape, SWOT, Porter's Five Forces, and Three Horizons of Growth.",
  instruction: `
    Analyze the provided business context focusing on:
    - Competitive Landscape and Benchmarking.
    - SWOT Analysis and Porter's Five Forces.
    - Three Horizons of Growth Framework.
    
    PORTER'S FIVE FORCES ANALYSIS
    Score each force on competitive intensity (0-100).
    Higher score = stronger force = more pressure on the business.

    1. COMPETITIVE_RIVALRY (0-100)
       Number of competitors, market growth rate, product differentiation,
       exit barriers, brand loyalty.
       90-100: Intense rivalry (5+ strong competitors, low differentiation, price wars)
       0-29:   Weak rivalry (few competitors, high differentiation, growing market)

    2. THREAT_OF_NEW_ENTRANTS (0-100)
       Capital requirements, regulatory barriers, brand loyalty, economies of scale,
       access to distribution channels, network effects as barrier.
       90-100: Easy entry (low capital, no regulation, no switching costs)
       0-29:   High barriers (regulatory, capital-intensive, network effects)

    3. THREAT_OF_SUBSTITUTES (0-100)
       Availability of alternatives, price-performance of substitutes,
       switching costs to substitutes, buyer propensity to switch.
       90-100: Many readily available substitutes at similar or better price
       0-29:   Few or no practical substitutes

    4. BUYER_POWER (0-100)
       Number of buyers, purchase volume concentration, ability to backward-integrate,
       information availability, switching costs.
       90-100: Few large buyers who account for most revenue, can easily switch
       0-29:   Many small buyers, high switching costs, limited information

    5. SUPPLIER_POWER (0-100)
       Number of suppliers, switching costs, supplier differentiation,
       importance of industry to supplier, forward integration threat.
       90-100: Few critical suppliers who can dictate terms
       0-29:   Many substitutable suppliers, low switching costs

    STRUCTURAL ATTRACTIVENESS SCORE = 100 - weighted average of all five forces
    (Use weights: Rivalry 25%, New Entrants 20%, Substitutes 20%, Buyers 20%, Suppliers 15%)

    INTERACTION EFFECT FLAG:
    If any TWO forces both exceed 70, add a warning:
    "STRUCTURAL VULNERABILITY: [Force A] + [Force B] create compound pressure on [specific aspect]"

    ANSOFF MATRIX ANALYSIS
    Assess which of the 4 growth vectors is the primary strategic opportunity for this business.
    Score each vector's attractiveness (0-100). Higher = more viable given current position and context.
    
    1. MARKET PENETRATION (existing product × existing market)
       Can they capture more share from current customers/segments without changing the product?
       Consider: pricing, distribution, marketing intensity, competitor displacement.
    
    2. MARKET DEVELOPMENT (existing product × new market)
       Can they take what works today into a new geography, segment, or channel?
       Consider: international expansion, adjacent verticals, new distribution channels.
    
    3. PRODUCT DEVELOPMENT (new product × existing market)
       Can they deepen wallet share with existing customers by adding adjacent offerings?
       Consider: upsell potential, platform expansion, API/ecosystem plays, AI-native features.
    
    4. DIVERSIFICATION (new product × new market)
       Should they enter an entirely new space? Only viable if existing moat transfers.
       Consider: capability adjacency, M&A, strategic partnerships, platform pivots.
    
    Identify the PRIMARY vector (highest-scoring) and explain the killer move for executing it.

    VRIO FRAMEWORK ANALYSIS
    For the business's PRIMARY claimed competitive advantage, evaluate it against all 4 VRIO criteria.
    The advantage to evaluate = whatever scores highest in Competitive Defensibility context.
    
    V — VALUABLE: Does this resource/capability allow the business to exploit opportunities or neutralise threats?
       Score 0-100. 0 = table stakes, 100 = eliminates an existential threat or unlocks transformational opportunity.
    
    R — RARE: How many competitors currently possess this resource/capability?
       Score 0-100. 0 = commodity (everyone has it), 100 = unique (only this firm).
    
    I — INIMITABLE: How costly/difficult is it for competitors to imitate or substitute?
       Score 0-100. 0 = can be copied in 3 months, 100 = structurally impossible (patent wall, network lock-in, decade of data).
       Consider: path dependency, causal ambiguity, social complexity.
    
    O — ORGANISED: Is the business actually set up to capture the value from this resource?
       Score 0-100. 0 = capability exists but no process/team to exploit it, 100 = fully operationalised with dedicated team and KPIs.
    
    VRIO VERDICT:
    - All 4 high (>70): Sustained Competitive Advantage
    - V+R+I high, O low: Temporary Advantage (not yet operationalised)
    - V+R high, I+O low: Competitive Parity at risk
    - Only V high: No advantage (valuable but not differentiated)

    ${COT_SCAFFOLD}
    ${rubricRule(["Competitive Defensibility", "Model Innovation", "Flywheel Potential", "Network Effects Strength", "Data Asset Quality"])}
 
    You must extract and score the following 5 dimensions (0-100):
    1. "Competitive Defensibility"
    2. "Model Innovation"
    3. "Flywheel Potential"
    4. "Network Effects Strength"
    5. "Data Asset Quality"
    
    Add the following to your JSON output:
    "portersFiveForces": {
      "scores": {
        "competitive_rivalry": { "score": 0, "primary_driver": "string" },
        "threat_of_new_entrants": { "score": 0, "primary_driver": "string" },
        "threat_of_substitutes": { "score": 0, "primary_driver": "string" },
        "buyer_power": { "score": 0, "primary_driver": "string" },
        "supplier_power": { "score": 0, "primary_driver": "string" }
      },
      "structural_attractiveness_score": 0,
      "interaction_effect_warning": "string or null"
    },
    "ansoffMatrix": {
      "market_penetration": { "score": 0, "rationale": "...", "killer_move": "..." },
      "market_development": { "score": 0, "rationale": "...", "killer_move": "..." },
      "product_development": { "score": 0, "rationale": "...", "killer_move": "..." },
      "diversification": { "score": 0, "rationale": "...", "killer_move": "..." },
      "primary_vector": "market_penetration | market_development | product_development | diversification",
      "strategic_verdict": "..."
    },
    "vrioAnalysis": {
      "resource_evaluated": "...",
      "valuable": { "score": 0, "evidence": "..." },
      "rare": { "score": 0, "evidence": "..." },
      "inimitable": { "score": 0, "evidence": "..." },
      "organised": { "score": 0, "evidence": "..." },
      "verdict": "Sustained Competitive Advantage | Temporary Advantage | Competitive Parity | No Advantage",
      "verdict_rationale": "..."
    }

    ${jsonInstruction}
  `,
});

export const commercialAnalyst = new LlmAgent({
  name: 'commercial_analyst',
  model: 'gemini-2.5-flash',
  description: 'Expert in Pricing Strategy, Go-To-Market (GTM), and Market Entry.',
  instruction: `
    Analyze the provided business context focusing on:
    - Pricing Strategy and Revenue Models.
    - Go-To-Market (GTM) Strategy.
    - Market Entry/Expansion Plans.
    
    ${asymmetricPlayRule}
    ${COT_SCAFFOLD}
    ${rubricRule(["Pricing Power", "CAC/LTV Ratio", "Market Entry Speed"])}

    You must extract and score the following 3 dimensions (0-100):
    1. "Pricing Power"
    2. "CAC/LTV Ratio"
    3. "Market Entry Speed"
    
    ${jsonInstruction}
  `,
});

export const operationsAnalyst = new LlmAgent({
  name: 'operations_analyst',
  model: 'gemini-2.5-flash',
  description: 'Expert in Tier-1 Consulting 7S, Value Chain, AI Operating Model, and ESG.',
  instruction: `
    Analyze the provided business context focusing on:
    - Tier-1 Consulting 7S Framework.
    - Value Chain Analysis and AI Operating Model Triangle readiness.
    - ESG (Environmental, Social, and Governance) Assessment.
    
    ${COT_SCAFFOLD}
    ${rubricRule(["Execution Speed", "Scalability", "ESG Posture", "Regulatory Readiness"])}
 
    You must extract and score the following 4 dimensions (0-100):
    1. "Execution Speed"
    2. "Scalability"
    3. "ESG Posture"
    4. "Regulatory Readiness"
    
    ${jsonInstruction}
  `,
});

export const financeAnalyst = new LlmAgent({
  name: 'finance_analyst',
  model: 'gemini-2.5-flash',
  description: 'Expert in Financial Modeling, Risk Assessment, and M&A.',
  instruction: `
    Analyze the provided business context focusing on:
    - High-level Financial Modeling and Unit Economics.
    - Comprehensive Risk Assessment and Mitigation.
    - M&A and Inorganic Growth Opportunities.
    
    UNIT ECONOMICS ANALYSIS
    In addition to dimension scores, compute or estimate the following unit economics.
    Use the business context to infer values where not explicitly stated.
    State your assumptions explicitly.

    Compute:
    - LTV = (ARPU × Gross Margin %) ÷ Monthly Churn Rate
    - LTV:CAC Ratio (healthy benchmark: > 3:1)
    - CAC Payback Period in months (healthy: < 12 months for SMB, < 18 for Enterprise)
    - Gross Margin % (SaaS benchmark: 70-85%, marketplace: 20-50%, services: 30-60%)
    - Rule of 40 = ARR Growth Rate % + Operating Margin %
      (benchmark: > 40 for growth-stage, > 20 for early-stage)
    - Burn Multiple = Net Burn ÷ Net New ARR (< 1.5 = efficient, > 3 = capital-intensive)
    - Magic Number = Net New ARR ÷ Prior Quarter S&M Spend (> 0.75 = efficient GTM)

    For each metric:
    - Provide your calculated or estimated value (use "N/A" or "insufficient data" if wildly guessing)
    - State the benchmark for this business type and stage
    - Give a RAG status: GREEN | AMBER | RED
    - Explain in one sentence why it's that status

    Also provide a SENSITIVITY TABLE:
    Show how LTV:CAC changes if:
    - ARPU drops 20%
    - Churn increases 50%
    - CAC increases 30%

    ${COT_SCAFFOLD}
    ${rubricRule(["ROI Projection", "Risk Tolerance", "Capital Efficiency", "Customer Concentration Risk"])}
 
    You must extract and score the following 4 dimensions (0-100):
    1. "ROI Projection"
    2. "Risk Tolerance"
    3. "Capital Efficiency"
    4. "Customer Concentration Risk"
    
    Add the following to your JSON output:
    "unitEconomics": {
      "assumptions": ["list of values you had to estimate"],
      "metrics": {
        "ltv_cac": { "value": "X:1 or 'insufficient data'", "benchmark": "> 3:1", "status": "GREEN|AMBER|RED", "note": "..." },
        "cac_payback_months": { "value": "number or null", "benchmark": "< 12 months (SMB)", "status": "GREEN|AMBER|RED", "note": "..." },
        "gross_margin_pct": { "value": "number or null", "benchmark": "70-85% (SaaS)", "status": "GREEN|AMBER|RED", "note": "..." },
        "rule_of_40": { "value": "number or null", "benchmark": "> 40", "status": "GREEN|AMBER|RED", "note": "..." },
        "burn_multiple": { "value": "number or null", "benchmark": "< 1.5", "status": "GREEN|AMBER|RED", "note": "..." },
        "magic_number": { "value": "number or null", "benchmark": "> 0.75", "status": "GREEN|AMBER|RED", "note": "..." }
      },
      "sensitivity": {
        "base_ltv_cac": 0.0,
        "arpu_down_20pct": 0.0,
        "churn_up_50pct": 0.0,
        "cac_up_30pct": 0.0
      }
    },
    "monteCarloInputs": {
      "arpu_low": 0.0,
      "arpu_base": 0.0,
      "arpu_high": 0.0,
      "churn_low": 0.0,
      "churn_base": 0.0,
      "churn_high": 0.0,
      "cac_low": 0.0,
      "cac_base": 0.0,
      "cac_high": 0.0,
      "growth_rate_low": 0.0,
      "growth_rate_base": 0.0,
      "growth_rate_high": 0.0,
      "gross_margin_low": 0.0,
      "gross_margin_base": 0.0,
      "gross_margin_high": 0.0
    }
    
    ${jsonInstruction}
  `,
});

export const specialists = [
  marketAnalyst,
  innovationAnalyst,
  commercialAnalyst,
  operationsAnalyst,
  financeAnalyst,
];

// ─── Exported instruction strings for direct Gemini API calls ─────────────────
// These mirror the LlmAgent instructions exactly. Used by coordinator.ts to
// bypass ADK InMemoryRunner (which has a v0.3 bug where stream ends before
// the model response arrives).
export const MARKET_ANALYST_INSTRUCTION = `
    Analyze the provided business context focusing on:
    - Total Addressable Market (TAM), SAM, and SOM.
    - Detailed Customer Personas.
    - Current and Emergent Industry Trends.
    
    ${COT_SCAFFOLD}
    
    ${rubricRule(["TAM Viability", "Target Precision", "Trend Adoption", "Team / Founder Strength"])}
 
    You must extract and score the following 4 dimensions (0-100):
    1. "TAM Viability"
    2. "Target Precision"
    3. "Trend Adoption"
    4. "Team / Founder Strength"

    ${jsonInstruction}
`;

export const INNOVATION_ANALYST_INSTRUCTION = `
    Analyze the provided business context focusing on:
    - Competitive Landscape and Benchmarking.
    - SWOT Analysis and Porter's Five Forces.
    - Three Horizons of Growth Framework.
    
    PORTER'S FIVE FORCES ANALYSIS
    Score each force on competitive intensity (0-100).
    Higher score = stronger force = more pressure on the business.

    1. COMPETITIVE_RIVALRY (0-100) — rivals, differentiation, price wars
    2. THREAT_OF_NEW_ENTRANTS (0-100) — barriers to entry, capital, regulation
    3. THREAT_OF_SUBSTITUTES (0-100) — alternatives, switching costs
    4. BUYER_POWER (0-100) — concentration, switching ease
    5. SUPPLIER_POWER (0-100) — supplier concentration, forward integration

    STRUCTURAL ATTRACTIVENESS SCORE = 100 - weighted average (Rivalry 25%, Entrants 20%, Substitutes 20%, Buyers 20%, Suppliers 15%)

    ANSOFF MATRIX — score each vector 0-100 for attractiveness:
    1. MARKET PENETRATION (existing product × existing market)
    2. MARKET DEVELOPMENT (existing product × new market)
    3. PRODUCT DEVELOPMENT (new product × existing market)
    4. DIVERSIFICATION (new product × new market)
    Identify primary vector and killer move.

    VRIO FRAMEWORK — evaluate primary competitive advantage:
    V — Valuable (0-100), R — Rare (0-100), I — Inimitable (0-100), O — Organised (0-100)
    Verdict: Sustained | Temporary | Parity | None

    ${COT_SCAFFOLD}
    ${rubricRule(["Competitive Defensibility", "Model Innovation", "Flywheel Potential", "Network Effects Strength", "Data Asset Quality"])}
 
    You must extract and score the following 5 dimensions (0-100):
    1. "Competitive Defensibility"
    2. "Model Innovation"
    3. "Flywheel Potential"
    4. "Network Effects Strength"
    5. "Data Asset Quality"
    
    Add to JSON output:
    "portersFiveForces": { "scores": { "competitive_rivalry": { "score": 0, "primary_driver": "" }, "threat_of_new_entrants": { "score": 0, "primary_driver": "" }, "threat_of_substitutes": { "score": 0, "primary_driver": "" }, "buyer_power": { "score": 0, "primary_driver": "" }, "supplier_power": { "score": 0, "primary_driver": "" } }, "structural_attractiveness_score": 0, "interaction_effect_warning": null },
    "ansoffMatrix": { "market_penetration": { "score": 0, "rationale": "", "killer_move": "" }, "market_development": { "score": 0, "rationale": "", "killer_move": "" }, "product_development": { "score": 0, "rationale": "", "killer_move": "" }, "diversification": { "score": 0, "rationale": "", "killer_move": "" }, "primary_vector": "", "strategic_verdict": "" },
    "vrioAnalysis": { "resource_evaluated": "", "valuable": { "score": 0, "evidence": "" }, "rare": { "score": 0, "evidence": "" }, "inimitable": { "score": 0, "evidence": "" }, "organised": { "score": 0, "evidence": "" }, "verdict": "", "verdict_rationale": "" }

    ${jsonInstruction}
`;

export const COMMERCIAL_ANALYST_INSTRUCTION = `
    Analyze the provided business context focusing on:
    - Pricing Strategy and Revenue Models.
    - Go-To-Market (GTM) Strategy.
    - Market Entry/Expansion Plans.
    
    ${asymmetricPlayRule}
    ${COT_SCAFFOLD}
    ${rubricRule(["Pricing Power", "CAC/LTV Ratio", "Market Entry Speed"])}

    You must extract and score the following 3 dimensions (0-100):
    1. "Pricing Power"
    2. "CAC/LTV Ratio"
    3. "Market Entry Speed"
    
    ${jsonInstruction}
`;

export const OPERATIONS_ANALYST_INSTRUCTION = `
    Analyze the provided business context focusing on:
    - Tier-1 Consulting 7S Framework.
    - Value Chain Analysis and AI Operating Model Triangle readiness.
    - ESG (Environmental, Social, and Governance) Assessment.
    
    ${COT_SCAFFOLD}
    ${rubricRule(["Execution Speed", "Scalability", "ESG Posture", "Regulatory Readiness"])}
 
    You must extract and score the following 4 dimensions (0-100):
    1. "Execution Speed"
    2. "Scalability"
    3. "ESG Posture"
    4. "Regulatory Readiness"
    
    ${jsonInstruction}
`;

export const FINANCE_ANALYST_INSTRUCTION = `
    Analyze the provided business context focusing on:
    - High-level Financial Modeling and Unit Economics.
    - Comprehensive Risk Assessment and Mitigation.
    - M&A and Inorganic Growth Opportunities.
    
    UNIT ECONOMICS: Compute or estimate LTV, CAC, LTV:CAC Ratio, CAC Payback, Gross Margin %, Rule of 40, Burn Multiple, Magic Number.
    State assumptions. For each metric provide value, benchmark, RAG status (GREEN|AMBER|RED), and one sentence note.
    Include sensitivity table: how LTV:CAC changes if ARPU -20%, Churn +50%, CAC +30%.

    ${COT_SCAFFOLD}
    ${rubricRule(["ROI Projection", "Risk Tolerance", "Capital Efficiency", "Customer Concentration Risk"])}
 
    You must extract and score the following 4 dimensions (0-100):
    1. "ROI Projection"
    2. "Risk Tolerance"
    3. "Capital Efficiency"
    4. "Customer Concentration Risk"
    
    Add to JSON output:
    "unitEconomics": { "assumptions": [], "metrics": { "ltv_cac": { "value": "", "benchmark": "> 3:1", "status": "", "note": "" }, "cac_payback_months": { "value": null, "benchmark": "< 12 months (SMB)", "status": "", "note": "" }, "gross_margin_pct": { "value": null, "benchmark": "70-85% (SaaS)", "status": "", "note": "" }, "rule_of_40": { "value": null, "benchmark": "> 40", "status": "", "note": "" }, "burn_multiple": { "value": null, "benchmark": "< 1.5", "status": "", "note": "" }, "magic_number": { "value": null, "benchmark": "> 0.75", "status": "", "note": "" } }, "sensitivity": { "base_ltv_cac": 0.0, "arpu_down_20pct": 0.0, "churn_up_50pct": 0.0, "cac_up_30pct": 0.0 } },
    "monteCarloInputs": { "arpu_low": 0, "arpu_base": 0, "arpu_high": 0, "churn_low": 0, "churn_base": 0, "churn_high": 0, "cac_low": 0, "cac_base": 0, "cac_high": 0, "growth_rate_low": 0, "growth_rate_base": 0, "growth_rate_high": 0, "gross_margin_low": 0, "gross_margin_base": 0, "gross_margin_high": 0 }
    
    ${jsonInstruction}
`;

/** Map from agent name to system instruction. */
export const specialistInstructions: Record<string, string> = {
  'market_analyst': MARKET_ANALYST_INSTRUCTION,
  'innovation_analyst': INNOVATION_ANALYST_INSTRUCTION,
  'commercial_analyst': COMMERCIAL_ANALYST_INSTRUCTION,
  'operations_analyst': OPERATIONS_ANALYST_INSTRUCTION,
  'finance_analyst': FINANCE_ANALYST_INSTRUCTION,
};
