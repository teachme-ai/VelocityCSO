import { LlmAgent } from '@google/adk';

const jsonInstruction = `
    IMPORTANT: You must output your response EXACTLY as a JSON object matching this structure. Do not wrap it in markdown blocks (\`\`\`json), just the raw JSON:
    {
      "analysis_markdown": "Your detailed markdown formatted analysis.",
      "confidence_score": <number 0-100>,
      "data_sources": ["Array of evidence or benchmarks used"],
      "dimensions": {
        "<Dimension 1 Name>": <number 0-100>,
        "<Dimension 2 Name>": <number 0-100>,
        "<Dimension 3 Name>": <number 0-100>
      }
    }
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
  "Capital Efficiency": "0: Cash incinerator; 50: Default alive; 100: High cash yield per dollar invested (Bootstrapped scale)."
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
    
    ${asymmetricPlayRule}
    ${rubricRule(["TAM Viability", "Target Precision", "Trend Adoption"])}

    You must extract and score the following 3 dimensions (0-100):
    1. "TAM Viability"
    2. "Target Precision"
    3. "Trend Adoption"

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
    
    ${asymmetricPlayRule}
    ${rubricRule(["Competitive Defensibility", "Model Innovation", "Flywheel Potential"])}

    You must extract and score the following 3 dimensions (0-100):
    1. "Competitive Defensibility"
    2. "Model Innovation"
    3. "Flywheel Potential"
    
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
    
    ${asymmetricPlayRule}
    ${rubricRule(["Execution Speed", "Scalability", "ESG Posture"])}

    You must extract and score the following 3 dimensions (0-100):
    1. "Execution Speed"
    2. "Scalability"
    3. "ESG Posture"
    
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
    
    ${asymmetricPlayRule}
    ${rubricRule(["ROI Projection", "Risk Tolerance", "Capital Efficiency"])}

    You must extract and score the following 3 dimensions (0-100):
    1. "ROI Projection"
    2. "Risk Tolerance"
    3. "Capital Efficiency"
    
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
