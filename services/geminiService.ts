
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

/**
 * Utility to perform retries with exponential backoff for transient errors like 429.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Detailed check for 429 Resource Exhausted / Quota errors
      const isRateLimit = 
        error?.status === 429 || 
        error?.code === 429 ||
        error?.error?.code === 429 ||
        error?.message?.includes('429') || 
        error?.message?.includes('quota') ||
        error?.message?.includes('RESOURCE_EXHAUSTED');
      
      if (isRateLimit) {
        if (i < maxRetries - 1) {
          // Exponential backoff with jitter: 2s, 4s, 8s...
          const delay = Math.pow(2, i) * 2000 + Math.random() * 1000;
          console.warn(`Rate limit hit (429). Retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      throw error;
    }
  }
  throw lastError;
}

export async function getHRInsights(data: any) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Using gemini-3-flash-preview for efficiency.
    // Truncating data to ensure we don't accidentally send huge payloads causing other errors.
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: `Analyze this HR payroll/attendance summary. Identify 2 key trends (absenteeism/costs) and 2 quick actionable recommendations. Keep the total response under 100 words and strictly professional.
      Data: ${JSON.stringify(data).substring(0, 15000)}`, 
      config: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
      }
    }));

    return response.text || "No insights available at this time.";
  } catch (error: any) {
    // Check specifically for rate limits to show a friendly message
    const isRateLimit = 
        error?.status === 429 || 
        error?.code === 429 ||
        error?.error?.code === 429 ||
        error?.message?.includes('429') || 
        error?.message?.includes('quota') ||
        error?.message?.includes('RESOURCE_EXHAUSTED');

    if (isRateLimit) {
      return "⚠️ AI System Busy: High demand or quota limit reached. Please wait a moment and use the refresh button.";
    }
    
    console.error("Gemini Insight Generation Error:", error);
    return "Unable to generate insights. Please try again later.";
  }
}

export function createHRChat(context: any) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction: `You are ZenAI, a world-class HR Analytics Assistant for ZenHR.
      You have access to the current HR data: ${JSON.stringify(context).substring(0, 20000)}.
      
      Your goal is to help administrators manage their workforce, analyze payroll, and track expenses.
      - Be professional, concise, and data-driven.
      - Use markdown for formatting tables or lists.
      - If asked about specific employees, check the provided data.
      - If asked about financial trends, use the payroll and expense records.
      - If a question is outside the scope of HR or the provided data, politely redirect.
      - If the user experiences errors, suggest they wait a few seconds as the system might be busy.`,
      temperature: 0.7,
    },
  });
}
