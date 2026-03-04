// src/services/documentParser.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parsePDF, parseTextFile } from './documentParser.js';

// Mock pdf-parse
vi.mock('pdf-parse', () => {
    return {
        PDFParse: vi.fn().mockImplementation(() => ({
            getText: vi.fn().mockResolvedValue({ text: 'Extracted PDF text content' }),
            getInfo: vi.fn().mockResolvedValue({ total: 5, info: { Title: 'Test PDF' } }),
            destroy: vi.fn().mockResolvedValue(undefined),
        })),
    };
});

describe('documentParser', () => {
    describe('parsePDF', () => {
        it('should successfully parse a PDF buffer', async () => {
            const buffer = Buffer.from('fake-pdf-data');
            const result = await parsePDF(buffer, 'test.pdf');

            expect(result.type).toBe('pdf');
            expect(result.filename).toBe('test.pdf');
            expect(result.text).toBe('Extracted PDF text content');
            expect(result.page_count).toBe(5);
            expect(result.metadata?.title).toBe('Test PDF');
        });

        it('should handle missing PDF info gracefully', async () => {
            const { PDFParse } = await import('pdf-parse');
            (PDFParse as any).mockImplementationOnce(() => ({
                getText: vi.fn().mockResolvedValue({ text: 'text only' }),
                getInfo: vi.fn().mockResolvedValue({ total: 1, info: {} }),
                destroy: vi.fn().mockResolvedValue(undefined),
            }));

            const buffer = Buffer.from('fake-pdf-data');
            const result = await parsePDF(buffer, 'test.pdf');

            expect(result.metadata?.title).toBe('');
            expect(result.page_count).toBe(1);
        });
    });

    describe('parseTextFile', () => {
        it('should successfully parse a text buffer', () => {
            const buffer = Buffer.from('Plain text content');
            const result = parseTextFile(buffer, 'test.txt');

            expect(result.type).toBe('text');
            expect(result.text).toBe('Plain text content');
            expect(result.filename).toBe('test.txt');
        });

        it('should truncate long text content', () => {
            const longText = 'x'.repeat(7000);
            const buffer = Buffer.from(longText);
            const result = parseTextFile(buffer, 'long.txt');

            expect(result.text.length).toBe(6000);
        });
    });
});
