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
  model: 'gemini-2.0-flash',
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
  model: 'gemini-2.0-flash',
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
    }

    ${jsonInstruction}
  `,
});

export const commercialAnalyst = new LlmAgent({
  name: 'commercial_analyst',
  model: 'gemini-2.0-flash',
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
  model: 'gemini-2.0-flash',
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
