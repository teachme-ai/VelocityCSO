import { LlmAgent } from '@google/adk';

export const marketAnalyst = new LlmAgent({
    name: 'Market & Trends Analyst',
    model: 'gemini-1.5-flash',
    description: 'Expert in Market Analysis, TAM/SAM/SOM, and Industry Trends.',
    instructions: `
    Analyze the provided business context focusing on:
    - Total Addressable Market (TAM), SAM, and SOM.
    - Detailed Customer Personas.
    - Current and Emergent Industry Trends.
    Provide a data-driven, insightful analysis.
  `,
});

export const innovationAnalyst = new LlmAgent({
    name: 'Strategy & Innovation Analyst',
    model: 'gemini-1.5-flash',
    description: "Expert in Competitive Landscape, SWOT, Porter's Five Forces, and Three Horizons of Growth.",
    instructions: `
    Analyze the provided business context focusing on:
    - Competitive Landscape and Benchmarking.
    - SWOT Analysis and Porter's Five Forces.
    - Three Horizons of Growth Framework.
    Identify strategic innovation opportunities.
  `,
});

export const commercialAnalyst = new LlmAgent({
    name: 'Commercial Strategy Analyst',
    model: 'gemini-1.5-flash',
    description: 'Expert in Pricing Strategy, Go-To-Market (GTM), and Market Entry.',
    instructions: `
    Analyze the provided business context focusing on:
    - Pricing Strategy and Revenue Models.
    - Go-To-Market (GTM) Strategy.
    - Market Entry/Expansion Plans.
    Provide actionable commercial recommendations.
  `,
});

export const operationsAnalyst = new LlmAgent({
    name: 'Operations & Execution Analyst',
    model: 'gemini-1.5-flash',
    description: 'Expert in McKinsey 7S, Value Chain, AI Operating Model, and ESG.',
    instructions: `
    Analyze the provided business context focusing on:
    - McKinsey 7S Framework.
    - Value Chain Analysis and AI Operating Model Triangle readiness.
    - ESG (Environmental, Social, and Governance) Assessment.
    Evaluate operational efficiency and sustainability.
  `,
});

export const financeAnalyst = new LlmAgent({
    name: 'Finance & Risk Analyst',
    model: 'gemini-1.5-flash',
    description: 'Expert in Financial Modeling, Risk Assessment, and M&A.',
    instructions: `
    Analyze the provided business context focusing on:
    - High-level Financial Modeling and Unit Economics.
    - Comprehensive Risk Assessment and Mitigation.
    - M&A and Inorganic Growth Opportunities.
    Provide financial health and risk perspectives.
  `,
});

export const specialists = [
    marketAnalyst,
    innovationAnalyst,
    commercialAnalyst,
    operationsAnalyst,
    financeAnalyst,
];
