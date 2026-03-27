// ZenAI HR Assistant — Google Gemini API (gemini-2.0-flash)
const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

function getKey(): string {
  return (import.meta as any).env?.VITE_GEMINI_KEY || '';
}

async function callGemini(contents: any[], systemText: string, maxTokens = 300): Promise<string> {
  const key = getKey();
  if (!key) throw new Error('VITE_GEMINI_KEY not configured');
  const body: any = {
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens }
  };
  if (systemText) body.system_instruction = { parts: [{ text: systemText }] };
  const resp = await fetch(GEMINI_API + '?key=' + key, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error('Gemini ' + resp.status + ': ' + err.substring(0, 150));
  }
  const json = await resp.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
}

export async function getHRInsights(data: any): Promise<string> {
  try {
    return await callGemini(
      [{ role: 'user', parts: [{ text: 'Analyze this HR data: ' + JSON.stringify(data).substring(0, 3000) }] }],
      'You are ZenAI, an HR analytics expert for DIMS HRMS factory management system. Give exactly 2 key trends and 2 actionable recommendations using bullet points. Be concise and specific with numbers from the data. Under 100 words total.',
      300
    );
  } catch (err: any) {
    console.error('ZenAI insights error:', err.message);
    return '\u26a0\ufe0f AI insights unavailable: ' + err.message.substring(0, 100);
  }
}

export function createHRChat(context: any) {
  const history: Array<{role: string; parts: Array<{text: string}>}> = [];
  const sysText = 'You are ZenAI, expert HR assistant for DIMS HRMS (factory HR management). You have access to live HR data: ' + JSON.stringify(context).substring(0, 8000) + '. Answer questions about employees, attendance, payroll, overtime, leaves, loans. Use actual data numbers. Be concise and professional. Format with markdown when helpful.';

  return {
    sendMessage: async ({ message }: { message: string }) => {
      history.push({ role: 'user', parts: [{ text: message }] });
      try {
        const reply = await callGemini(history, sysText, 700);
        history.push({ role: 'model', parts: [{ text: reply }] });
        return { text: reply };
      } catch (err: any) {
        history.pop(); // remove failed user message
        throw err;
      }
    },
    clearHistory: () => { history.length = 0; }
  };
}
