import { describe, it, expect } from 'vitest';
import { DiscoveryAgent } from './discovery.js';

describe('Discovery Agent (Task 1.1)', () => {
    it('should have google_search tool configured', () => {
        const agent = new DiscoveryAgent();
        const tools = (agent as any).agent.tools;
        expect(tools).toBeDefined();
        const hasSearch = tools.some((t: any) => t.name === 'google_search');
        expect(hasSearch).toBe(true);
    });

    it('instruction should include PESTLE and Market Grounding directives', () => {
        const agent = new DiscoveryAgent();
        const instr = (agent as any).agent.instruction.toUpperCase();
        expect(instr).toContain('PESTLE');
        expect(instr).toContain('MARKET GROUNDING');
        expect(instr).toContain('FINDINGS');
    });
});
