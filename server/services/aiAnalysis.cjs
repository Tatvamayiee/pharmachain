// AI prescription-analysis service.
//
// Provider contract: an external AI API (LLM/vision or a dedicated medical
// NLP service) that accepts a prescription's patient context + extracted
// text and returns structured medicine data. Two provider shapes are
// supported, selected by PHARMACHAIN_AI_PROVIDER in .env:
//
//   none               -> analyze() returns { configured: false }; the route
//                         answers 501 so the UI stays honest (prototype mode).
//   openai-compatible  -> POST {AI_BASE_URL} with Bearer key; OpenAI-style
//                         chat/completions body; expects a JSON object string.
//   custom             -> POST {AI_BASE_URL} with Bearer key; PharmaChain
//                         request/response body (documented below).
//
// PharmaChain `custom` request body:
//   { patientReference, patientAge, patientGender, allergies,
//     existingConditions, currentMedicines, prescriptionDate, prescriberName,
//     department, extractedText }
// PharmaChain `custom` response (any subset; missing fields are defaulted):
//   { extractedText?, medicines?: [{ name, matchedName?, strength?, dosage?,
//       frequency?, duration?, route?, quantity?, confidence?, matchStatus? }],
//     interactionAlerts?, dosageAlerts?, confidence? }
//
// The server NEVER invents a successful result: with no provider configured
// the endpoint reports 501, and any provider error surfaces as 502 with the
// provider's error name (no keys, no URLs, no secrets in logs or responses).
const http = require('http');
const https = require('https');
const { URL } = require('url');
const { AI_PROVIDER, AI_BASE_URL, AI_API_KEY, AI_MODEL } = require('../config/env.cjs');

const ANALYSIS_TIMEOUT_MS = 30_000;

function isConfigured() {
  return AI_PROVIDER !== 'none' && !!AI_BASE_URL;
}

function postJson(targetUrl, headers, payload) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(targetUrl);
    } catch {
      reject(new Error('AI_BASE_URL is not a valid URL'));
      return;
    }
    const transport = u.protocol === 'https:' ? https : http;
    const body = JSON.stringify(payload);
    const req = transport.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers },
        timeout: ANALYSIS_TIMEOUT_MS,
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let parsed = null;
          try { parsed = JSON.parse(raw); } catch { /* non-JSON body */ }
          resolve({ status: res.statusCode, data: parsed });
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('AI provider timed out')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function normalizeMedicine(m) {
  const src = m && typeof m === 'object' ? m : {};
  const name = String(src.name || src.extractedName || '').trim();
  const confidence = Number.isFinite(Number(src.confidence)) ? Number(src.confidence) : 0.5;
  return {
    name,
    matchedName: String(src.matchedName || src.matched || name).trim(),
    strength: String(src.strength || '').trim(),
    dosage: String(src.dosage || '').trim(),
    frequency: String(src.frequency || '').trim(),
    duration: String(src.duration || '').trim(),
    route: String(src.route || '').trim(),
    quantity: src.quantity !== undefined ? Number(src.quantity) || 0 : 0,
    confidence,
    matchStatus: ['matched', 'possible_match', 'not_found', 'needs_review'].includes(src.matchStatus)
      ? src.matchStatus
      : (confidence >= 0.75 ? 'matched' : confidence >= 0.4 ? 'possible_match' : 'needs_review'),
    ocrConfidence: confidence,
  };
}

function normalizeAlert(a, severityFallback) {
  const src = a && typeof a === 'object' ? a : {};
  const severity = ['critical', 'high', 'moderate', 'informational'].includes(src.severity)
    ? src.severity : severityFallback;
  return {
    id: String(src.id || `ai-${Math.random().toString(36).slice(2, 9)}`),
    severity,
    medicines: Array.isArray(src.medicines) ? src.medicines.map(String) : [],
    reason: String(src.reason || src.message || '').trim(),
    concern: String(src.concern || src.risk || '').trim(),
    action: String(src.action || src.recommendedAction || '').trim(),
    source: String(src.source || 'AI analysis'),
    status: 'unreviewed',
  };
}

/** Core extraction prompt shared by both provider shapes. */
function buildPrompt(ctx) {
  return [
    'You are a pharmacy prescription-analysis assistant. Extract structured data from the prescription text below.',
    'Return STRICT JSON only (no markdown, no prose) with this exact shape:',
    '{"extractedText": string, "medicines": [{"name": string, "strength": string, "dosage": string, "frequency": string, "duration": string, "route": string, "quantity": number, "confidence": number}], "interactionAlerts": [{"severity": "critical|high|moderate|informational", "medicines": string[], "reason": string, "concern": string, "action": string}], "dosageAlerts": [{"severity": "critical|high|moderate|informational", "medicines": string[], "reason": string, "concern": string, "action": string}], "confidence": number}',
    'confidence is 0..1. Use "" for unknown strings and [] for unknown lists. Never invent medicines that are not in the text.',
    '',
    `Patient age: ${ctx.patientAge ?? 'unknown'}`,
    `Allergies: ${ctx.allergies || 'none recorded'}`,
    `Existing conditions: ${ctx.existingConditions || 'none recorded'}`,
    `Current medicines: ${ctx.currentMedicines || 'none recorded'}`,
    '',
    'Prescription text:',
    ctx.extractedText || '(no extracted text supplied — respond with empty medicines)',
  ].join('\n');
}

/** Pull the first JSON object out of an LLM reply (handles ```json fences). */
function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeResult(raw, ctx) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const medicines = Array.isArray(src.medicines) ? src.medicines.map(normalizeMedicine) : [];
  const interactionAlerts = Array.isArray(src.interactionAlerts)
    ? src.interactionAlerts.map((a) => normalizeAlert(a, 'moderate'))
    : [];
  const dosageAlerts = Array.isArray(src.dosageAlerts)
    ? src.dosageAlerts.map((a) => normalizeAlert(a, 'moderate'))
    : [];
  return {
    extractedText: String(src.extractedText || ctx.extractedText || ''),
    medicines,
    interactionAlerts,
    dosageAlerts,
    confidence: Number.isFinite(Number(src.confidence)) ? Number(src.confidence)
      : (medicines.length ? medicines.reduce((s, m) => s + m.confidence, 0) / medicines.length : 0),
    analysisProvider: AI_PROVIDER === 'custom' ? 'custom-ai' : AI_PROVIDER,
    requiresHumanReview: true,
  };
}

async function analyze(ctx) {
  if (!isConfigured()) {
    return { configured: false };
  }

  let response;
  if (AI_PROVIDER === 'openai-compatible') {
    const payload = {
      model: AI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a prescription-analysis assistant. Reply with strict JSON only.' },
        { role: 'user', content: buildPrompt(ctx) },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    };
    response = await postJson(AI_BASE_URL, { Authorization: `Bearer ${AI_API_KEY}` }, payload);
    if (response.status >= 400) {
      const err = new Error(`AI provider returned HTTP ${response.status}`);
      err.status = 502;
      throw err;
    }
    const choice = response.data && Array.isArray(response.data.choices)
      ? response.data.choices[0] : null;
    const content = choice && choice.message && choice.message.content;
    const parsed = extractJson(typeof content === 'string' ? content : JSON.stringify(response.data));
    if (!parsed) {
      const err = new Error('AI provider returned an unparsable response');
      err.status = 502;
      throw err;
    }
    return { configured: true, result: normalizeResult(parsed, ctx) };
  }

  // custom provider
  response = await postJson(AI_BASE_URL, { Authorization: `Bearer ${AI_API_KEY}` }, ctx);
  if (response.status >= 400) {
    const err = new Error(`AI provider returned HTTP ${response.status}`);
    err.status = 502;
    throw err;
  }
  return { configured: true, result: normalizeResult(response.data, ctx) };
}

module.exports = { analyze, isConfigured };
