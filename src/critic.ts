import { LlmAgent } from '@google/adk';

export const strategicCritic = new LlmAgent({
    name: 'strategic_critic',
    model: 'gemini-2.5-pro',
    description: 'Expert reviewer of strategic analyses. Identifies contradictions, logic gaps, and low confidence areas.',
    instruction: `
        Analyze the combined outputs from the specialist agents.
        1. Identify any contradictions between domains (e.g., Marketing predicts aggressive growth, Finance warns of cash constraints).
        2. Check the confidence_score of each specialist.
        3. Provide a strict critique. If the analysis is solid and consistent, say "APPROVED".
        4. If there are contradictions or a score is too low without good reasoning, say "REWRITE_REQUIRED" and explain exactly which specialist needs to be re-queried and why.
    `
});
