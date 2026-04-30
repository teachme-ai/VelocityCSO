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
 * Returns the raw text response AND real token usage from the API.
 */
export async function callGemini(
    model: string,
    systemInstruction: string,
    userPrompt: string,
    maxOutputTokens?: number
): Promise<string>;
export async function callGemini(
    model: string,
    systemInstruction: string,
    userPrompt: string,
    maxOutputTokens: number | undefined,
    returnUsage: true
): Promise<{ text: string; inputTokens: number; outputTokens: number; totalTokens: number }>;
export async function callGemini(
    model: string,
    systemInstruction: string,
    userPrompt: string,
    maxOutputTokens?: number,
    returnUsage?: boolean
): Promise<any> {
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

        const usage = response.usageMetadata;
        const inputTokens = usage?.promptTokenCount ?? Math.ceil(userPrompt.length / 4);
        const outputTokens = usage?.candidatesTokenCount ?? Math.ceil(text.length / 4);
        const totalTokens = usage?.totalTokenCount ?? (inputTokens + outputTokens);

        log({
            severity: 'DEBUG',
            message: `[TOKEN] ${model} — in:${inputTokens} out:${outputTokens} total:${totalTokens}${usage ? ' (actual)' : ' (estimated)'}`,
            model,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            total_tokens: totalTokens,
            token_source: usage ? 'api_actual' : 'char_estimate',
        });

        if (returnUsage) return { text, inputTokens, outputTokens, totalTokens };
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
        throw e;
    }
}

