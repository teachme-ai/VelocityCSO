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
  description: 'Expert in McKinsey 7S, Value Chain, AI Operating Model, and ESG.',
  instruction: `
    Analyze the provided business context focusing on:
    - McKinsey 7S Framework.
    - Value Chain Analysis and AI Operating Model Triangle readiness.
    - ESG (Environmental, Social, and Governance) Assessment.
    
    ${asymmetricPlayRule}

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
