import { describe, it, expect, vi } from 'vitest';
import { marketAnalyst } from './specialists.js';

describe('Specialist Rubrics (Task 1.3)', () => {
    it('marketAnalyst instruction should contain SCORING RUBRICS', () => {
        const instruction = (marketAnalyst as any).instruction;
        expect(instruction).toContain('SCORING RUBRICS:');
        expect(instruction).toContain('TAM Viability:');
        expect(instruction).toContain('Target Precision:');
        expect(instruction).toContain('Trend Adoption:');
    });

    it('each rubric benchmark follows the defined scale', () => {
        const instruction = (marketAnalyst as any).instruction;
        expect(instruction).toContain('0: Niche/Stagnant');
        expect(instruction).toContain('50: Healthy Growth');
        expect(instruction).toContain('100: Global Monopoly Potential');
    });
});
