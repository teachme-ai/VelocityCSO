// src/services/documentParser.ts
import { PDFParse } from 'pdf-parse';

export interface ParsedDocument {
    type: 'pdf' | 'text';
    filename: string;
    text: string;           // extracted text, max 6000 chars
    page_count?: number;
    metadata?: Record<string, string>;
}

export async function parsePDF(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    const parser = new PDFParse({ data: buffer });

    try {
        const textResult = await parser.getText({ first: 10 }); // limit to first 10 pages
        const infoResult = await parser.getInfo();

        return {
            type: 'pdf',
            filename,
            text: (textResult.text || '').slice(0, 6000),
            page_count: infoResult.total,
            metadata: {
                title: (infoResult.info as any)?.Title ?? '',
                author: (infoResult.info as any)?.Author ?? '',
                created: (infoResult.info as any)?.CreationDate ?? '',
            },
        };
    } finally {
        await parser.destroy();
    }
}

export function parseTextFile(buffer: Buffer, filename: string): ParsedDocument {
    return {
        type: 'text',
        filename,
        text: buffer.toString('utf-8').slice(0, 6000),
    };
}
