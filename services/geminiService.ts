// ZenAI HR Assistant — Google Gemini API (gemini-1.5-flash)
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function getKey(): string {
  return (import.meta as any).env?.VITE_GEMINI_KEY || '';
}

export async function getHRInsights(data: any): Promise<string> {
  const key = getKey();
  if (!key) return '⚠️ ZenAI: API key not configured. Add VITE_GEMINI_KEY to Vercel environment variables.';
  try {
    const resp = await fetch(GEMINI_API_BASE + '/gemini-1.5-flash:generateContent?key=' + key, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: 'You are ZenAI, an HR analytics expert for DIMS HRMS (factory HR management system). Analyze this HR data and give exactly 2 key trends and 2 actionable recommendations. Use bullet points. Be concise, specific with numbers. Under 100 words total.\n\nData: ' + JSON.stringify(data).substring(0, 3000)
          }]
        }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 300 }
      })
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.error('ZenAI insights error:', resp.status, err.substring(0, 100));
      return '⚠️ AI insights unavailable. Error: ' + resp.status;
    }
    const json = await resp.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text || 'No insights available.';
  } catch (err: any) {
    console.error('ZenAI error:', err);
    return '⚠️ AI insights temporarily unavailable.';
  }
}

export function createHRChat(context: any) {
  // Gemini uses a different chat format — we maintain history manually
  const history: Array<{role: string; parts: Array<{text: string}>}> = [];

  const systemContext = 'You are ZenAI, an expert HR assistant embedded in DIMS HRMS (factory HR management system). You have access to this live HR data: ' + JSON.stringify(context).substring(0, 8000) + '. Answer questions about employees, attendance, payroll, overtime, leaves, loans, expenses. Use actual numbers from the data. Be concise, professional, data-driven. Format with markdown when helpful. Under 200 words unless detailed analysis needed.';

  return {
    sendMessage: async ({ message }: { message: string }) => {
      const key = getKey();
      if (!key) throw new Error('ZenAI: API key not configured. Add VITE_GEMINI_KEY to Vercel environment variables.');

      // Add user message to history
      history.push({ role: 'user', parts: [{ text: message }] });

      const resp = await fetch(GEMINI_API_BASE + '/gemini-1.5-flash:generateContent?key=' + key, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemContext }] },
          contents: history,
          generationConfig: { temperature: 0.7, maxOutputTokens: 700 }
        })
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error('ZenAI chat error:', resp.status, errText.substring(0, 200));
        throw new Error('ZenAI API error ' + resp.status + '. Please try again.');
      }

      const json = await resp.json();
      const reply = json.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response. Please try again.";

      // Add model response to history
      history.push({ role: 'model', parts: [{ text: reply }] });
      return { text: reply };
    },
    clearHistory: () => { history.length = 0; }
  };
}
