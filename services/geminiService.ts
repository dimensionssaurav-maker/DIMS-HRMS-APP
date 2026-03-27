// ZenAI HR Assistant — Anthropic Claude API
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_KEY = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ANTHROPIC_KEY) || '';

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
    ...(ANTHROPIC_KEY ? { 'x-api-key': ANTHROPIC_KEY } : {}),
  };
}

export async function getHRInsights(data: any): Promise<string> {
  try {
    const resp = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 250,
        system: 'You are ZenAI, an HR analytics assistant for DIMS HRMS (factory management system). Analyze the provided HR data and give exactly 2 key trends and 2 actionable recommendations. Format with bullet points. Keep total response under 120 words. Be specific with numbers from the data.',
        messages: [{
          role: 'user',
          content: 'Analyze this DIMS HRMS data and provide insights: ' + JSON.stringify(data).substring(0, 4000)
        }]
      })
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.error('ZenAI insights error:', resp.status, err.substring(0, 200));
      if (resp.status === 401) return '🔑 ZenAI needs an API key. Add VITE_ANTHROPIC_KEY to Vercel environment variables.';
      throw new Error('API ' + resp.status);
    }
    const json = await resp.json();
    return json.content?.[0]?.text || 'No insights available.';
  } catch (err: any) {
    console.error('ZenAI error:', err);
    return '⚠️ AI insights unavailable. Check your API key configuration.';
  }
}

export function createHRChat(context: any) {
  const history: Array<{role: string; content: string}> = [];
  const systemPrompt = `You are ZenAI, an expert HR assistant embedded in DIMS HRMS — a factory HR management system.

You have access to this live HR data:
${JSON.stringify(context).substring(0, 10000)}

Your role:
- Answer any question about employees, attendance, payroll, overtime, leaves, loans, expenses
- Use the actual numbers from the data — never guess or make up figures
- When asked about specific employees or departments, reference the data
- Calculate totals, averages, comparisons on request
- Give actionable HR recommendations based on data patterns
- Format responses clearly using markdown when helpful
- Keep answers concise (under 200 words) unless detailed analysis is requested

You are helpful, professional, and data-driven.`;

  return {
    sendMessage: async ({ message }: { message: string }) => {
      history.push({ role: 'user', content: message });

      const resp = await fetch(ANTHROPIC_API, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 700,
          system: systemPrompt,
          messages: history.map(h => ({
            role: h.role as 'user' | 'assistant',
            content: h.content
          }))
        })
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error('ZenAI chat error:', resp.status, errText.substring(0, 200));
        if (resp.status === 401) {
          throw new Error('ZenAI needs an API key. Please add VITE_ANTHROPIC_KEY to your Vercel environment variables, then redeploy.');
        }
        throw new Error('ZenAI API error ' + resp.status);
      }

      const json = await resp.json();
      const reply = json.content?.[0]?.text || "I couldn't generate a response. Please try again.";
      history.push({ role: 'assistant', content: reply });
      return { text: reply };
    },

    clearHistory: () => { history.length = 0; }
  };
}
