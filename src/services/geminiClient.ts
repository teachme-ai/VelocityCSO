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

// Transient error codes that warrant a retry (quota, overload, timeout)
const RETRYABLE_CODES = new Set([429, 500, 503, 504]);
const PRO_MAX_RETRIES = 3;
const PRO_BACKOFF_MS = [2000, 5000, 10000]; // 2s, 5s, 10s

function isRetryable(e: any): boolean {
    const status = e?.status ?? e?.httpStatus ?? e?.code;
    if (RETRYABLE_CODES.has(status)) return true;
    const msg = String(e?.message || e || '');
    return /quota|overload|rate.?limit|503|429|timeout|unavailable/i.test(msg);
}

async function callGeminiOnce(
    model: string,
    systemInstruction: string,
    userPrompt: string,
    maxOutputTokens?: number,
): Promise<{ text: string; inputTokens: number; outputTokens: number; totalTokens: number }> {
    const client = genAI.getGenerativeModel({
        model,
        systemInstruction,
        generationConfig: maxOutputTokens ? { maxOutputTokens } : undefined,
    });
    const result = await client.generateContent(userPrompt);
    const response = result.response;
    const text = response.text();
    if (!text) throw new Error('Empty response text from Gemini');
    const usage = response.usageMetadata;
    const inputTokens = usage?.promptTokenCount ?? Math.ceil(userPrompt.length / 4);
    const outputTokens = usage?.candidatesTokenCount ?? Math.ceil(text.length / 4);
    const totalTokens = usage?.totalTokenCount ?? (inputTokens + outputTokens);
    log({
        severity: 'DEBUG',
        message: `[TOKEN] ${model} — in:${inputTokens} out:${outputTokens} total:${totalTokens}${usage ? ' (actual)' : ' (estimated)'}`,
        model, input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: totalTokens,
        token_source: usage ? 'api_actual' : 'char_estimate',
    });
    return { text, inputTokens, outputTokens, totalTokens };
}

/**
 * Call a Gemini model directly with a system instruction + user prompt.
 * Pro models are retried up to 3 times with exponential backoff before
 * throwing — callers decide whether to fall back to Flash.
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
    const isPro = model.includes('pro');
    const maxRetries = isPro ? PRO_MAX_RETRIES : 1;

    let lastError: any;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const { text, inputTokens, outputTokens, totalTokens } = await callGeminiOnce(model, systemInstruction, userPrompt, maxOutputTokens);
            if (attempt > 0) {
                log({ severity: 'INFO', message: `[RETRY] ${model} succeeded on attempt ${attempt + 1}`, model, attempt });
            }
            if (returnUsage) return { text, inputTokens, outputTokens, totalTokens };
            return text;
        } catch (e: any) {
            lastError = e;
            const retryable = isRetryable(e);
            const hasMoreAttempts = attempt < maxRetries - 1;

            log({
                severity: retryable && hasMoreAttempts ? 'WARNING' : 'ERROR',
                message: retryable && hasMoreAttempts
                    ? `[RETRY] ${model} attempt ${attempt + 1}/${maxRetries} failed — retrying in ${PRO_BACKOFF_MS[attempt]}ms`
                    : `Gemini Direct Call Failed [${model}]`,
                error: e.message || String(e),
                model_requested: model,
                attempt: attempt + 1,
                retryable,
                api_key_status: apiKey ? `present (${apiKey.slice(0, 4)}...${apiKey.slice(-4)})` : 'missing',
            });

            if (!retryable || !hasMoreAttempts) break;
            await new Promise(r => setTimeout(r, PRO_BACKOFF_MS[attempt]));
        }
    }
    throw lastError;
}

