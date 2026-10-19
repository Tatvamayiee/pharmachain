// ---------------------------------------------------------------------------
// Vision prescription analyzer (server-side only). Provider-agnostic: one
// OpenAI-compatible chat/completions wire format, two configurable providers.
//
//   PHARMACHAIN_AI_* (OpenAI vision, e.g. gpt-4o-mini)   — used when set
//   HF_TOKEN (Hugging Face Inference Providers, Qwen VL) — used otherwise
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

const { OPENAI_API_KEY, AI_PROVIDER, AI_BASE_URL, AI_API_KEY, AI_MODEL, HF_TOKEN, HF_MODEL } = require('../config/env.cjs');

const DEFAULT_HF_ROUTER_URL = 'https://router.huggingface.co/v1/chat/completions';
const DEFAULT_OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const TIMEOUT_MS = 90_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']);

/**
 * Resolve the active vision provider from env.
 * Precedence:
 * 1. OpenAI (if AI_PROVIDER is 'openai' / 'openai-compatible' or if OPENAI_API_KEY is present and provider !== 'huggingface')
 * 2. Hugging Face (if HF_TOKEN is present)
 * 3. null (returns 501 unconfigured error)
 */
function resolveProvider() {
  const openaiKey = OPENAI_API_KEY || AI_API_KEY;
  const isExplicitHf = AI_PROVIDER === 'huggingface';
  const isExplicitOpenai = AI_PROVIDER === 'openai' || AI_PROVIDER === 'openai-compatible';
  
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
      model: HF_MODEL || 'Qwen/Qwen2.5-VL-3B-Instruct',
      label: 'Hugging Face',
    };
  }
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
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: EXTRACTION_PROMPT },
              { type: 'image_url', image_url: { url: dataUri } },
            ],
          },
        ],
        max_tokens: 1400,
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
    const providerMsg = errBody && errBody.error && (errBody.error.message || errBody.error.code)
      ? (errBody.error.message || errBody.error.code)
      : (errBody && errBody.message ? errBody.message : `HTTP ${res.status}`);

    console.error(`[ANALYZER] ${provider.label} returned error status ${res.status}:`, providerMsg);

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
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: EXTRACTION_PROMPT },
                  { type: 'image_url', image_url: { url: dataUri } },
                ],
              },
            ],
            max_tokens: 1400,
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

  const content = body && Array.isArray(body.choices) && body.choices[0]
    && body.choices[0].message ? body.choices[0].message.content : null;
  const parsed = extractJson(typeof content === 'string' ? content : JSON.stringify(content));
  if (!parsed) {
    const e = new Error('AI returned an unparsable response. Please retry with a clearer prescription image.');
    e.status = 502;
    throw e;
  }

  const normalized = normalizeResult(parsed);
  console.log(`[ANALYZER] Parsed dynamic medicine count: ${normalized.medicines.length}`);
  return normalized;
}

module.exports = {
  analyzeImage, isConfigured, providerMeta, validateImage, normalizeResult,
  _internal: { EXTRACTION_PROMPT, extractJson, resolveProvider },
};
