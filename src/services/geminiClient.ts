/**
 * Direct Gemini API client — bypasses ADK which has a known bug in v0.3
 * where InMemoryRunner completes the async stream before model response arrives.
 * Uses @google/generative-ai directly.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

// ADK sets GOOGLE_GENAI_API_KEY (or GEMINI_API_KEY) in its env bootstrap
const apiKey =
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    '';

const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Call a Gemini model directly with a system instruction + user prompt.
 * Returns the raw text response.
 */
export async function callGemini(
    model: string,
    systemInstruction: string,
    userPrompt: string
): Promise<string> {
    const client = genAI.getGenerativeModel({
        model,
        systemInstruction,
    });

    const result = await client.generateContent(userPrompt);
    return result.response.text();
}
