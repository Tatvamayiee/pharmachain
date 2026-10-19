// ---------------------------------------------------------------------------
// AI chat service (server-side only). Reuses the same provider configuration
// as the prescription analyzer (huggingface via HF_TOKEN, or OpenAI if selected).
// Provider-agnostic: one OpenAI-compatible chat/completions wire format.
//
// Tokens/keys NEVER leave this module (no logs, no responses).
// ---------------------------------------------------------------------------

const { HF_TOKEN, HF_MODEL, AI_PROVIDER, AI_BASE_URL, AI_API_KEY, OPENAI_API_KEY } = require('../config/env.cjs');
const hfResolver = require('../services/huggingfacePrescriptionAnalyzer.cjs');

const DEFAULT_HF_ROUTER_URL = 'https://router.huggingface.co/v1/chat/completions';
const DEFAULT_OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const TIMEOUT_MS = 60_000; // 60 seconds for chat

// Hard limits on client-supplied history (defense against oversized payloads).
const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 4_000;

// The assistant knows nothing about this app unless we tell it. This system
// prompt grounds every answer in PharmaChain's actual features and enforces
// the medical-safety rules. Keys never appear here — it's static text.
const SYSTEM_PROMPT = [
  'You are the PharmaChain AI Assistant, embedded in the PharmaChain web application — a pharmacy supply-chain and prescription-verification platform. Always assume questions are about PharmaChain unless the user clearly means something else; if a question is genuinely unrelated to the app, answer briefly and steer back to PharmaChain topics.',
  '',
  'What PharmaChain does:',
  '- Prescription Scanner (dealer/hospital): upload a prescription image → AI analysis (vision LLM) → parallel PaddleOCR + AI comparison → field-by-field comparison with "Needs Verification" flags → mandatory pharmacist review checklist → confirmation (SHA-256 hash) → optional blockchain anchoring on Polygon Amoy.',
  '- Prescription History: past scans with status (uploaded, analyzed, confirmed), reopen any record to review, confirm or anchor it.',
  '- Dashboards per role: admin, manufacturer, distributor, dealer, hospital, customer — stock, shipments, batches, recalls, expiry alerts.',
  '- Shipment tracking with QR codes and blockchain-backed verification (verify/track pages).',
  '',
  'How to use the app (typical flow):',
  '1. Log in (demo dealer: dealer@pharmachain.com / dealer123).',
  '2. Sidebar → Prescriptions → Prescription Scanner.',
  '3. Upload/clear photo of a prescription → Analyze → review extracted medicines, edit if needed.',
  '4. Optionally run the parallel OCR+AI comparison.',
  '5. Complete the pharmacist review checklist → Confirm (computes the hash) → Register on blockchain (Polygon Amoy testnet).',
  '',
  'Rules you must always follow:',
  '- You assist with navigation, features and workflow questions only.',
  '- NEVER diagnose conditions, prescribe medicines, recommend doses or suggest medication changes. If asked, explain that only a qualified pharmacist/clinician can do that and suggest they use the Prescription Scanner + pharmacist review flow.',
  '- Never invent app features that are not listed above; if unsure whether something exists, say so.',
  '- Never ask for or repeat real passwords, API keys or tokens (the public demo account credentials above are fine to share).',
  '- Keep answers concise and practical, using numbered steps for how-to questions.',
  '- Reply in PLAIN TEXT only: no markdown symbols (#, *, **, ---, tables or backticks). Use short paragraphs, "1." numbered steps and "- " dashes instead.',
].join('\n');

function resolveProvider() {
  return hfResolver._internal.resolveProvider();
}

function isConfigured() {
  return resolveProvider() !== null;
}

/**
 * Send a chat message with conversation history to the configured provider.
 * @param {string} userMessage the new user message
 * @param {Array<{role:'user'|'assistant', content:string}>} [history]
 *   prior turns (oldest first, EXCLUDING the new message). Capped/sanitized.
 * @param {string} [page] the app route the user is currently viewing
 *   (e.g. '/dealer/prescriptions/scan'). Injected as context so answers can
 *   reference the page the user is on. Sanitized; empty/missing = no context.
 * Returns the raw assistant reply (string).
 */
async function sendMessage(userMessage, history, page) {
  const provider = resolveProvider();
  if (!provider) {
    const e = new Error('AI chat is not configured on the server');
    e.status = 501;
    throw e;
  }

  const safeHistory = Array.isArray(history)
    ? history
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-MAX_HISTORY_MESSAGES)
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }))
    : [];

  // Page awareness: optional, sanitized route path. A separate system message
  // right before the user turn keeps SYSTEM_PROMPT static while telling the
  // model where in the app the user is.
  const safePage = typeof page === 'string'
    ? page.replace(/[^a-zA-Z0-9/_-]/g, '').slice(0, 200)
    : '';
  const pageContext = safePage
    ? [{ role: 'system', content: `The user is currently viewing the PharmaChain page: ${safePage}. When relevant, tailor answers to that page and its features.` }]
    : [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    const body = {
      model: provider.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...safeHistory,
        ...pageContext,
        { role: 'user', content: String(userMessage).slice(0, MAX_MESSAGE_CHARS) },
      ],
      max_tokens: 1024,
      temperature: 0.7,
    };
    res = await fetch(provider.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    const isTimeout = err.name === 'AbortError' || err.code === 'ETIMEDOUT';
    const e = new Error(isTimeout
      ? `${provider.label} chat timed out. Please retry.`
      : `${provider.label} service is unreachable. Please retry.`);
    e.status = 502;
    throw e;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let errBody = null;
    try { errBody = await res.json(); } catch { }
    const providerMsg = errBody && errBody.error && (errBody.error.message || errBody.error.code)
      ? (errBody.error.message || errBody.error.code)
      : (errBody && errBody.message ? errBody.message : `HTTP ${res.status}`);
    const e = new Error(`${provider.label} error: ${providerMsg}`);
    e.status = res.status === 401 || res.status === 403 ? 501 : 502;
    throw e;
  }

  let body;
  try {
    body = await res.json();
  } catch {
    const e = new Error(`${provider.label} returned a non-JSON response.`);
    e.status = 502;
    throw e;
  }

  const content = body && Array.isArray(body.choices) && body.choices[0]
    && body.choices[0].message ? body.choices[0].message.content : null;
  return content || '';
}

module.exports = {
  sendMessage,
  isConfigured,
  resolveProvider,
};