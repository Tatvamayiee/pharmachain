// ---------------------------------------------------------------------------
// Vision prescription analyzer (server-side only). Provider-agnostic: one
// OpenAI-compatible chat/completions wire format.
//
//   OpenRouter (free-tier vision model; no paid fallback) — preferred when selected
//   Cloudflare Workers AI (vision model)                    — preferred when configured
//   PHARMACHAIN_AI_* (OpenAI vision, e.g. gpt-4o-mini)   — used when set
//   HF_TOKEN (Hugging Face Inference Providers, vision-language model) — used otherwise
//   neither                                              — /analyze reports 501
//
// Hard rules implemented here:
//   - Tokens/keys NEVER leave this module (no logs, no responses).
//   - No fake results: an unreachable/failed provider throws with a safe
//     message; the route turns it into 502 and marks the record.
//   - The model is instructed to use null for unreadable fields and never to
//     invent medicines; the parser enforces shape and clamps confidence 0..1.
//   - Uncertainty becomes an extraction warning, never a clinical alert.
// ---------------------------------------------------------------------------

const {
  OPENAI_API_KEY, AI_PROVIDER, AI_BASE_URL, AI_API_KEY, AI_MODEL, HF_TOKEN, HF_MODEL,
  OPENROUTER_API_KEY, OPENROUTER_MODEL,
  CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_AI_MODEL,
} = require('../config/env.cjs');

const DEFAULT_HF_ROUTER_URL = 'https://router.huggingface.co/v1/chat/completions';
const DEFAULT_OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_OPENROUTER_MODEL = 'minimax/minimax-m3.1-flash:free';
const DEFAULT_CLOUDFLARE_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
const TIMEOUT_MS = 90_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const OPENROUTER_MAX_TOKENS = 4096;
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']);

/**
 * Resolve the active vision provider from env. An explicitly selected but
 * unconfigured provider fails closed rather than silently using another key.
 */
function resolveProvider() {
  const openaiKey = OPENAI_API_KEY || AI_API_KEY;
  const isExplicitOpenRouter = AI_PROVIDER === 'openrouter';
  const isExplicitCloudflare = AI_PROVIDER === 'cloudflare';
  const isExplicitHf = AI_PROVIDER === 'huggingface';
  const isExplicitOpenai = AI_PROVIDER === 'openai' || AI_PROVIDER === 'openai-compatible';

  if (isExplicitOpenRouter || (AI_PROVIDER !== 'none' && OPENROUTER_API_KEY)) {
    if (!OPENROUTER_API_KEY || !OPENROUTER_MODEL.endsWith(':free')) return null;
    return {
      id: 'openrouter',
      url: DEFAULT_OPENROUTER_URL,
      token: OPENROUTER_API_KEY,
      model: OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL,
      label: 'OpenRouter (free model)',
    };
  }
  if (isExplicitCloudflare || (
    AI_PROVIDER !== 'none' && CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_API_TOKEN
  )) {
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) return null;
    return {
      id: 'cloudflare',
      url: `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(CLOUDFLARE_ACCOUNT_ID)}/ai/v1/chat/completions`,
      token: CLOUDFLARE_API_TOKEN,
      model: CLOUDFLARE_AI_MODEL || DEFAULT_CLOUDFLARE_MODEL,
      label: 'Cloudflare Workers AI',
    };
  }
  if (isExplicitOpenRouter) return null;
  if (openaiKey && AI_PROVIDER !== 'none' && !isExplicitHf && !/platform\.openai\.com/i.test(AI_BASE_URL)) {
    return {
      id: 'openai',
      url: AI_BASE_URL || DEFAULT_OPENAI_URL,
      token: openaiKey,
      model: AI_MODEL || 'gpt-4o-mini',
      label: 'OpenAI vision',
    };
  }
  if (HF_TOKEN && AI_PROVIDER !== 'none') {
    return {
      id: 'huggingface',
      url: process.env.HF_TEST_STUB_URL || DEFAULT_HF_ROUTER_URL,
      token: HF_TOKEN,
      model: HF_MODEL || 'deepseek-ai/DeepSeek-V4.1-Flash-1017',
      label: 'Hugging Face',
    };
  }
  if (isExplicitCloudflare) return null;
  if (openaiKey && isExplicitOpenai) {
    return {
      id: 'openai',
      url: AI_BASE_URL || DEFAULT_OPENAI_URL,
      token: openaiKey,
      model: AI_MODEL || 'gpt-4o-mini',
      label: 'OpenAI vision',
    };
  }
  return null;
}

function isConfigured() {
  return resolveProvider() !== null;
}

function configurationError() {
  if (AI_PROVIDER === 'openrouter') {
    if (!OPENROUTER_API_KEY) {
      return 'OpenRouter is selected but not configured. Set OPENROUTER_API_KEY in the backend .env file.';
    }
    if (!OPENROUTER_MODEL.endsWith(':free')) {
      return 'OpenRouter is configured for free-only use. Set OPENROUTER_MODEL to a model ending in :free.';
    }
  }
  if (AI_PROVIDER === 'cloudflare') {
    const missing = [];
    if (!CLOUDFLARE_ACCOUNT_ID) missing.push('CLOUDFLARE_ACCOUNT_ID');
    if (!CLOUDFLARE_API_TOKEN) missing.push('CLOUDFLARE_API_TOKEN');
    if (missing.length) {
      return `Cloudflare Workers AI is selected but not configured. Set ${missing.join(' and ')} in the backend .env file.`;
    }
  }
  return 'AI analysis is not configured on the server.';
}

function providerMeta() {
  const p = resolveProvider();
  return p ? { provider: p.id, model: p.model, label: p.label } : null;
}

/**
 * Validates an uploaded prescription file. Throws Error with .status for the
 * route to map to 4xx responses.
 */
function validateImage(file) {
  if (!file || !file.buffer || file.buffer.length === 0) {
    const e = new Error('No prescription file was uploaded.'); e.status = 400; throw e;
  }
  if (!ALLOWED_MIME.has(file.mimetype)) {
    const e = new Error('Unsupported file type. Upload a PNG, JPG, or PDF prescription.'); e.status = 415; throw e;
  }
  if (file.buffer.length > MAX_IMAGE_BYTES) {
    const e = new Error('File too large. Maximum size is 10 MB.'); e.status = 413; throw e;
  }
  // Corrupted-image smoke test: PNG/JPEG magic bytes (PDFs are passed through).
  const b = file.buffer;
  const isPng = b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const isJpeg = b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const isPdf = b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
  if (!isPng && !isJpeg && !isPdf) {
    const e = new Error('The uploaded file does not look like a valid PNG, JPG or PDF (its bytes do not match those formats). Re-save the prescription as a PNG or JPG and try again.'); e.status = 422; throw e;
  }
  return { mimetype: file.mimetype, size: file.buffer.length };
}

const EXTRACTION_PROMPT = `You are a pharmacy prescription-analysis assistant. Read the attached prescription image and extract ONLY what is actually visible and legible.

Rules:
- Never invent a medicine, doctor, diagnosis, or test.
- Never guess unclear handwriting: use null for anything you cannot read confidently.
- Preserve the prescription's own wording for names, dosages, and instructions.
- Do not change dosage or frequency values.
- Do not invent a diagnosis. Copy it only if clearly written.
- Do not provide medical advice, side effects, uses, or interactions.
- confidence is a number between 0 and 1 for each medicine, and overall_confidence for the whole reading.
- If handwriting is unclear anywhere, list it in warnings.
- Return STRICT JSON only — no markdown, no code fences, no commentary.

Return exactly this JSON shape:
{
  "patient": { "name": null, "age": null, "gender": null },
  "doctor": { "name": null, "specialization": null, "registration_number": null },
  "prescription_date": null,
  "medicines": [
    { "name": null, "strength": null, "dosage": null, "frequency": null, "duration": null, "route": null, "instructions": null, "confidence": 0 }
  ],
  "diagnosis": [],
  "tests": [],
  "additional_instructions": [],
  "warnings": [],
  "overall_confidence": 0
}`;

/** Pull the first JSON object out of a model reply (tolerates fences/prose). */
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

function extractMessageText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((part) => part && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n');
  }
  if (content && typeof content === 'object') return JSON.stringify(content);
  return '';
}

function str(v) { return typeof v === 'string' && v.trim() ? v.trim() : null; }
function conf(v) {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n > 1 ? n / 100 : n)); // tolerate 0-100 scales
}

/** Validate + normalize the model JSON into the internal structure. */
function normalizeResult(raw) {
  if (!raw || typeof raw !== 'object') {
    const e = new Error('AI response was not valid JSON.'); e.status = 502; throw e;
  }
  const patient = raw.patient && typeof raw.patient === 'object' ? raw.patient : {};
  const doctor = raw.doctor && typeof raw.doctor === 'object' ? raw.doctor : {};
  const meds = Array.isArray(raw.medicines) ? raw.medicines : [];

  const medicines = meds
    .map((m) => {
      const src = m && typeof m === 'object' ? m : {};
      const name = str(src.name);
      return {
        name, // may be null — unreadable names stay null, never substituted
        strength: str(src.strength),
        dosage: str(src.dosage),
        frequency: str(src.frequency),
        duration: str(src.duration),
        route: str(src.route),
        instructions: str(src.instructions),
        confidence: conf(src.confidence),
      };
    })
    .filter((m) => m.name || m.strength || m.dosage || m.frequency); // drop empty rows

  const warnings = Array.isArray(raw.warnings) ? raw.warnings.map(String).filter(Boolean) : [];
  for (const m of medicines) {
    if (!m.name) warnings.push('Medicine name could not be confidently read.');
    else if (m.confidence < 0.6) warnings.push(`Low confidence reading for "${m.name}".`);
  }
  if (medicines.length === 0) warnings.push('No medicines could be confidently extracted from the image.');

  const meta = providerMeta();
  return {
    patient: {
      name: str(patient.name),
      age: typeof patient.age === 'number' ? patient.age : null,
      gender: str(patient.gender),
    },
    doctor: {
      name: str(doctor.name),
      specialization: str(doctor.specialization),
      registration_number: str(doctor.registration_number),
    },
    prescription_date: str(raw.prescription_date),
    medicines,
    diagnosis: Array.isArray(raw.diagnosis) ? raw.diagnosis.map(String).filter(Boolean) : [],
    tests: Array.isArray(raw.tests) ? raw.tests.map(String).filter(Boolean) : [],
    additional_instructions: Array.isArray(raw.additional_instructions)
      ? raw.additional_instructions.map(String).filter(Boolean) : [],
    warnings: [...new Set(warnings)],
    overall_confidence: conf(raw.overall_confidence ?? (medicines.length ? medicines.reduce((s, m) => s + m.confidence, 0) / medicines.length : 0)),
    _meta: {
      provider: meta ? meta.provider : 'unknown',
      model: meta ? meta.model : 'unknown',
      analyzed_at: new Date().toISOString(),
    },
  };
}

/**
 * Analyze a prescription image buffer via the resolved provider.
 * Resolves to the normalized structure; rejects with Error(.status) otherwise.
 */
async function analyzeImage(buffer, mimetype) {
  const provider = resolveProvider();
  if (!provider) {
    const e = new Error('AI analysis is not configured on the server.');
    e.status = 501;
    throw e;
  }

  // Safe development logging (Requirement 6) — never log tokens or patient PII
  console.log('[ANALYZER] Request reached backend for prescription analysis');
  console.log(`[ANALYZER] Image received: ${buffer.length} bytes (mimetype: ${mimetype})`);

  const mime = mimetype === 'image/jpg' ? 'image/jpeg' : mimetype;
  const dataUri = `data:${mime};base64,${buffer.toString('base64')}`;

  console.log(`[ANALYZER] ${provider.label} request started (model: ${provider.model})`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(provider.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model,
        ...(provider.id === 'openrouter' ? { provider: { allow_fallbacks: false } } : {}),
        ...(provider.id === 'openrouter' ? { response_format: { type: 'json_object' } } : {}),
        ...(provider.id === 'openrouter' ? { reasoning: { effort: 'low' } } : {}),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: EXTRACTION_PROMPT },
              { type: 'image_url', image_url: { url: dataUri } },
            ],
          },
        ],
        max_tokens: provider.id === 'openrouter' ? OPENROUTER_MAX_TOKENS : 1400,
        temperature: 0,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    const isTimeout = err.name === 'AbortError' || err.code === 'ETIMEDOUT';
    const e = new Error(isTimeout
      ? `${provider.label} analysis timed out. Please retry.`
      : `${provider.label} service is unreachable. Please retry.`);
    e.status = 502;
    console.error(`[ANALYZER] ${provider.label} fetch error:`, err.message);
    throw e;
  } finally {
    clearTimeout(timer);
  }

  console.log(`[ANALYZER] ${provider.label} request completed (HTTP ${res.status})`);

  if (!res.ok) {
    let errBody = null;
    try { errBody = await res.json(); } catch { /* non-JSON error body */ }
    const providerError = errBody && errBody.error;
    const providerMsg = typeof providerError === 'string'
      ? providerError
      : providerError && (providerError.message || providerError.code)
        ? (providerError.message || providerError.code)
        : (errBody && (errBody.message || errBody.detail) ? (errBody.message || errBody.detail) : `HTTP ${res.status}`);

    console.error(`[ANALYZER] ${provider.label} returned error status ${res.status}:`, providerMsg);

    if (res.status === 402) {
      const e = new Error(provider.id === 'huggingface'
        ? 'Hugging Face rejected this inference request with HTTP 402 (payment required). Add inference credits or enable billing for your Hugging Face account, and verify access to the model provider.'
        : provider.id === 'cloudflare'
          ? 'Cloudflare Workers AI rejected this request. Check the Workers AI free daily allocation and account billing settings.'
          : `${provider.label} rejected this inference request with HTTP 402 (payment required). Check the provider account billing.`);
      e.status = 402;
      throw e;
    }

    // Free-tier transient rate limits (429): one short backoff retry
    if (res.status === 429 && !/quota|credit|billing/i.test(providerMsg)) {
      console.log(`[ANALYZER] Retrying ${provider.label} after rate limit...`);
      await new Promise((r) => setTimeout(r, 2500));
      let retry;
      try {
        retry = await fetch(provider.url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${provider.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: provider.model,
            ...(provider.id === 'openrouter' ? { provider: { allow_fallbacks: false } } : {}),
            ...(provider.id === 'openrouter' ? { response_format: { type: 'json_object' } } : {}),
            ...(provider.id === 'openrouter' ? { reasoning: { effort: 'low' } } : {}),
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: EXTRACTION_PROMPT },
                  { type: 'image_url', image_url: { url: dataUri } },
                ],
              },
            ],
            max_tokens: provider.id === 'openrouter' ? OPENROUTER_MAX_TOKENS : 1400,
            temperature: 0,
          }),
          signal: controller.signal,
        });
      } catch { /* fall through */ }
      if (retry && retry.ok) {
        res = retry;
      } else {
        const e = new Error(`${provider.label} is rate-limited: ${providerMsg}`);
        e.status = 502;
        throw e;
      }
    } else {
      const e = new Error(`${provider.label} error: ${providerMsg}`);
      e.status = res.status === 401 || res.status === 403 ? 501 : 502;
      throw e;
    }
  }

  let body;
  try {
    body = await res.json();
  } catch {
    const e = new Error(`${provider.label} returned a non-JSON response.`);
    e.status = 502;
    throw e;
  }

  console.log('[ANALYZER] Response structure received from AI');

  const message = body && Array.isArray(body.choices) && body.choices[0]
    ? body.choices[0].message : null;
  const content = extractMessageText(message && message.content);
  const parsed = extractJson(content);
  if (!parsed) {
    console.error('[ANALYZER] AI response was not valid JSON:', JSON.stringify({
      provider: provider.id,
      contentLength: content.length,
      finishReason: body && body.choices && body.choices[0] && body.choices[0].finish_reason || null,
      reasoningTokens: body && body.usage && body.usage.completion_tokens_details
        ? body.usage.completion_tokens_details.reasoning_tokens || 0 : null,
      completionTokens: body && body.usage ? body.usage.completion_tokens || null : null,
      refusal: Boolean(message && message.refusal),
    }));
    const e = new Error('AI returned a response the scanner could not read as JSON. Please retry once; if it continues, use a clearer image or try again later.');
    e.status = 502;
    throw e;
  }

  const normalized = normalizeResult(parsed);
  console.log(`[ANALYZER] Parsed dynamic medicine count: ${normalized.medicines.length}`);
  return normalized;
}

module.exports = {
  analyzeImage, isConfigured, configurationError, providerMeta, validateImage, normalizeResult,
  _internal: { EXTRACTION_PROMPT, extractJson, extractMessageText, resolveProvider },
};
