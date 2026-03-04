import { GoogleGenerativeAI } from '@google/generative-ai';
import { log } from './logger.js';

// ADK sets GOOGLE_API_KEY as the primary credential
const apiKey =
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    '';

if (!apiKey) {
    log({ severity: 'WARNING', message: 'No Gemini API key found in GOOGLE_API_KEY, GOOGLE_GENAI_API_KEY, or GEMINI_API_KEY environment variables.' });
}

const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Call a Gemini model directly with a system instruction + user prompt.
 * Returns the raw text response.
 */
export async function callGemini(
    model: string,
    systemInstruction: string,
    userPrompt: string,
    maxOutputTokens?: number
): Promise<string> {
    try {
        const client = genAI.getGenerativeModel({
            model,
            systemInstruction,
            generationConfig: maxOutputTokens ? { maxOutputTokens } : undefined,
        });

        const result = await client.generateContent(userPrompt);
        const response = result.response;
        const text = response.text();

        if (!text) {
            throw new Error('Empty response text from Gemini');
        }

        return text;
    } catch (e: any) {
        const keyStatus = apiKey ? `present (${apiKey.slice(0, 4)}...${apiKey.slice(-4)})` : 'missing';
        log({
            severity: 'ERROR',
            message: `Gemini Direct Call Failed [${model}]`,
            error: e.message || String(e),
            api_key_status: keyStatus,
            model_requested: model
        });
        throw e; // Re-throw to allow coordinator to handle/log
    }
}

