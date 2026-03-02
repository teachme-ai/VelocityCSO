import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 1 Cleanliness and Circular Dependencies (Task 1.5/1.6)', () => {
    it('coordinator.ts should not import from index.js', () => {
        const content = fs.readFileSync(path.resolve('src/coordinator.ts'), 'utf8');
        expect(content).not.toContain("from './index.js'");
        expect(content).toContain("from './services/sseService.js'");
    });

    it('interrogator.ts should not import from index.js', () => {
        const content = fs.readFileSync(path.resolve('src/agents/interrogator.ts'), 'utf8');
        expect(content).not.toContain("from '../index.js'");
        expect(content).toContain("from '../services/sseService.js'");
    });

    it('index.ts should not contain SSE logic', () => {
        const content = fs.readFileSync(path.resolve('src/index.ts'), 'utf8');
        expect(content).not.toContain('const activeConnections = new Map');
        expect(content).not.toContain('function sseWrite');
    });

    it('unused frontend directories should be gone', () => {
        expect(fs.existsSync('frontend_broken')).toBe(false);
        expect(fs.existsSync('web-ui')).toBe(false);
    });
});
