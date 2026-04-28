// ZenAI HR Assistant — Google Gemini API (gemini-2.5-flash)
const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

function getKey(): string {
  return (import.meta as any).env?.VITE_GEMINI_KEY || '';
}

const LEGAL_PRIMER = `
You are also an Indian labour-law and HR-compliance expert. When answering legal/threshold/policy questions, cite the specific Act and section where applicable, e.g.
  - The 4 new Labour Codes: Code on Wages 2019, Industrial Relations Code 2020, OSH Code 2020, Code on Social Security 2020
  - Factories Act 1948
  - Payment of Wages Act 1936
  - Minimum Wages Act 1948
  - Payment of Bonus Act 1965
  - Payment of Gratuity Act 1972
  - EPF & MP Act 1952 (current wage ceiling: ₹15,000/month)
  - ESI Act 1948 (current wage ceiling: ₹21,000/month, ₹25,000/month for persons with disabilities)
  - Industrial Disputes Act 1947
  - Maternity Benefit Act 1961 (26 weeks paid leave for first 2 children)
  - Equal Remuneration Act 1976
  - Contract Labour (R&A) Act 1970
  - Shops & Commercial Establishments Acts (state-specific)

When threshold values or notification dates are involved, prefer the latest official source. If unsure, say so explicitly and recommend verifying with the Ministry of Labour & Employment or the relevant state department. Never invent gazette numbers or case citations.
`.trim();

async function callGemini(contents: any[], systemText: string, maxTokens = 300, useSearch = false): Promise<string> {
  const key = getKey();
  if (!key) throw new Error('VITE_GEMINI_KEY not configured');
  const body: any = {
    contents,
    generationConfig: { temperature: 0.6, maxOutputTokens: maxTokens }
  };
  if (systemText) body.system_instruction = { parts: [{ text: systemText }] };
  if (useSearch) body.tools = [{ google_search: {} }];
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
  const candidate = json.candidates?.[0];
  let text = candidate?.content?.parts?.[0]?.text || 'No response.';
  const grounding = candidate?.groundingMetadata;
  if (grounding && grounding.groundingChunks) {
    const sources = grounding.groundingChunks
      .map((c: any) => c.web?.uri)
      .filter(Boolean)
      .slice(0, 3);
    if (sources.length > 0) {
      text += '\n\n*Sources: ' + sources.join(', ') + '*';
    }
  }
  return text;
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
    return '⚠️ AI insights unavailable: ' + err.message.substring(0, 100);
  }
}

function looksLikeLegalQuery(text: string): boolean {
  const t = text.toLowerCase();
  return /\b(esic?|epf|pf\b|provident\s*fund|gratuity|bonus\s*act|labour\s*code|labor\s*code|labour\s*law|labor\s*law|minimum\s*wage|payment\s*of\s*wages|factories\s*act|maternity|notice\s*period|threshold|ceiling|statutory|gazette|professional\s*tax|tds|section\s*\d|act\s*19|act\s*20|compliance|legal|notification|rule\s*\d)\b/.test(t);
}

export function createHRChat(context: any) {
  const history: Array<{role: string; parts: Array<{text: string}>}> = [];
  const empCount   = Array.isArray(context?.employees) ? context.employees.length : 0;
  const attCount   = context?.attendanceSummary || 0;
  const payTotal   = context?.payrollTotal || 0;
  const month      = context?.selectedMonth || '';
  const year       = context?.selectedYear || '';

  const baseSysText =
    'You are ZenAI, HR assistant for DIMS HRMS.\n' +
    'LIVE DATA: ' +
    `Employees: ${empCount}, ` +
    `Attendance records: ${attCount}, ` +
    `Payroll total: ₹${payTotal}, ` +
    `Month: ${month} ${year}.\n` +
    'Full context: ' + JSON.stringify(context).substring(0, 6000) + '\n\n' +
    'STRICT REPLY RULES (follow every time):\n' +
    '1. Max 50 words. Crux only — no intros, no self-descriptions.\n' +
    '2. Never say "I am ZenAI" or introduce yourself — just answer.\n' +
    '3. State numbers first, then one-line reason.\n' +
    '4. Max 3 bullet points. No paragraphs.\n' +
    '5. Use actual numbers from LIVE DATA above.\n\n' +
    LEGAL_PRIMER;

  return {
    sendMessage: async ({ message }: { message: string }) => {
      history.push({ role: 'user', parts: [{ text: message }] });
      try {
        const reply = await callGemini(history, baseSysText, 200, looksLikeLegalQuery(message));
        history.push({ role: 'model', parts: [{ text: reply }] });
        return { text: reply };
      } catch (err: any) {
        history.pop();
        throw err;
      }
    },
    clearHistory: () => { history.length = 0; }
  };
}
