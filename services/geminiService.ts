// ZenAI HR Assistant — Anthropic Claude API
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

export async function getHRInsights(data: any): Promise<string> {
  try {
    const resp = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        system: 'You are ZenAI, an HR analytics assistant for DIMS HRMS. Give brief, data-driven insights in 2-3 bullet points under 100 words.',
        messages: [{ role: 'user', content: 'Analyze this HR data and give 2 key trends + 2 recommendations under 100 words: ' + JSON.stringify(data).substring(0, 3000) }]
      })
    });
    if (!resp.ok) throw new Error('API ' + resp.status);
    const json = await resp.json();
    return json.content?.[0]?.text || 'No insights available.';
  } catch (err: any) {
    console.error('ZenAI error:', err);
    return '\u26a0\ufe0f AI insights temporarily unavailable.';
  }
}

export function createHRChat(context: any) {
  const history: Array<{role: string; content: string}> = [];
  const sys = `You are ZenAI, expert HR assistant for DIMS HRMS (factory HR system).
Live HR data: ${JSON.stringify(context).substring(0, 8000)}
- Answer questions about employees, attendance, payroll, OT, leaves, loans, expenses
- Use actual data to answer — never make up numbers  
- Be concise, professional, data-driven
- Format tables/lists with markdown
- Keep responses under 250 words unless detailed analysis requested`;

  return {
    sendMessage: async ({ message }: { message: string }) => {
      history.push({ role: 'user', content: message });
      const resp = await fetch(ANTHROPIC_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 600,
          system: sys,
          messages: history.map(h => ({ role: h.role as 'user'|'assistant', content: h.content }))
        })
      });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error('ZenAI error ' + resp.status + ': ' + errText.substring(0, 100));
      }
      const json = await resp.json();
      const reply = json.content?.[0]?.text || "I couldn't generate a response.";
      history.push({ role: 'assistant', content: reply });
      return { text: reply };
    },
    clearHistory: () => { history.length = 0; }
  };
}
