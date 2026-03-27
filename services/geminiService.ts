// ZenAI HR Assistant — Google Gemini API
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

function getKey(): string {
  return (import.meta as any).env?.VITE_GEMINI_KEY || '';
}

async function callGemini(prompt: string, systemCtx: string, maxTokens = 300): Promise<string> {
  const key = getKey();
  if (!key) throw new Error('VITE_GEMINI_KEY not set');
  const resp = await fetch(GEMINI_BASE + '?key=' + key, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: systemCtx + '\n\n' + prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens }
    })
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error('Gemini API ' + resp.status + ': ' + err.substring(0, 150));
  }
  const json = await resp.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
}

export async function getHRInsights(data: any): Promise<string> {
  try {
    return await callGemini(
      'Analyze this HR data: ' + JSON.stringify(data).substring(0, 3000),
      'You are ZenAI, an HR analytics expert for DIMS HRMS. Give exactly 2 key trends and 2 actionable recommendations. Use bullet points. Be concise and specific with numbers. Under 100 words total.',
      300
    );
  } catch (err: any) {
    console.error('ZenAI insights error:', err.message);
    return '\u26a0\ufe0f ' + (err.message.includes('VITE_GEMINI_KEY') ? 'API key not configured.' : 'AI insights unavailable. ' + err.message.substring(0, 80));
  }
}

export function createHRChat(context: any) {
  const history: Array<{role: string; parts: Array<{text: string}>}> = [];
  const sysCtx = 'You are ZenAI, expert HR assistant for DIMS HRMS (factory HR system). Live data: ' + JSON.stringify(context).substring(0, 8000) + '. Answer HR questions using actual data. Be concise and professional.';

  return {
    sendMessage: async ({ message }: { message: string }) => {
      const key = getKey();
      if (!key) throw new Error('ZenAI: VITE_GEMINI_KEY not configured in Vercel.');
      history.push({ role: 'user', parts: [{ text: message }] });
      const resp = await fetch(GEMINI_BASE + '?key=' + key, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: sysCtx }] },
          contents: history,
          generationConfig: { temperature: 0.7, maxOutputTokens: 700 }
        })
      });
      if (!resp.ok) {
        const e = await resp.text();
        throw new Error('ZenAI error ' + resp.status + ': ' + e.substring(0, 100));
      }
      const json = await resp.json();
      const reply = json.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response.";
      history.push({ role: 'model', parts: [{ text: reply }] });
      return { text: reply };
    },
    clearHistory: () => { history.length = 0; }
  };
}
