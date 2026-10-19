// Probe provider key validity WITHOUT printing any secret.
// Prints HTTP status + provider error messages only.
import fs from 'fs';

const envText = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const geminiKey = env.GEMINI_API_KEY || '';
const geminiModel = env.GEMINI_MODEL || 'gemini-2.5-pro';
const openaiKey = (env.OPENAI_API_KEY || '').trim();
const hfToken = (env.HF_TOKEN || '').trim();
const hfModel = env.HF_MODEL || '';

console.log('--- Gemini probe ---');
console.log('key prefix:', geminiKey.slice(0, 3), 'length:', geminiKey.length);
if (geminiKey) {
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with the single word OK.' }] }], generationConfig: { maxOutputTokens: 8 } }),
      signal: AbortSignal.timeout(30000),
    });
    console.log('status:', r.status);
    const b = await r.json().catch(() => null);
    if (!r.ok) console.log('error:', b?.error?.message || 'non-JSON');
    else console.log('reply:', b?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()?.slice(0, 40));
  } catch (e) { console.log('fetch failed:', e.message); }
}

console.log('--- OpenAI probe ---');
console.log('key length:', openaiKey.length);
if (openaiKey) {
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Reply with the single word OK.' }], max_tokens: 8 }),
      signal: AbortSignal.timeout(30000),
    });
    console.log('status:', r.status);
    const b = await r.json().catch(() => null);
    if (!r.ok) console.log('error:', b?.error?.message || 'non-JSON');
    else console.log('reply:', b?.choices?.[0]?.message?.content?.trim()?.slice(0, 40));
  } catch (e) { console.log('fetch failed:', e.message); }
}

console.log('--- HF probe ---');
console.log('token length:', hfToken.length, 'model:', hfModel);
if (hfToken) {
  try {
    const r = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${hfToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: hfModel, messages: [{ role: 'user', content: 'Reply with the single word OK.' }], max_tokens: 8 }),
      signal: AbortSignal.timeout(40000),
    });
    console.log('status:', r.status);
    const b = await r.json().catch(() => null);
    if (!r.ok) console.log('error:', b?.error || b?.message || 'non-JSON');
    else console.log('reply:', b?.choices?.[0]?.message?.content?.trim()?.slice(0, 40));
  } catch (e) { console.log('fetch failed:', e.message); }
}
