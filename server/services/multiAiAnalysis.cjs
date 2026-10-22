// ---------------------------------------------------------------------------
// MULTI-AI PRESCRIPTION ANALYSIS service — server-side only.
//
// Hard rules:
//   - Tokens/keys NEVER leave this module (no logs, no responses).
//   - No fabricated results: real provider failures propagate as errors.
//   - The model is instructed to use null for unreadable fields — never invent.
//   - Uncertainty becomes a warning, not a clinical alert.
//   - Provider credentials never reach any log or client response.
//
// Supported providers:
//   huggingface   — HF Inference Router (DeepSeek V4.1 Flash) [primary live provider]
//   gemini        — Google Gemini (model via GEMINI_MODEL, default gemini-2.5-pro)
//   gpt5          — OpenAI GPT-5
//   googlevision  — Google Cloud Vision API (OCR, no medicine parsing)
//   awstextract   — AWS Textract
//   azurevision   — Azure AI Vision
//   olmocr        — OlmOCR 2 7B
// ---------------------------------------------------------------------------

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

const {
  OPENAI_API_KEY, AI_PROVIDER, AI_BASE_URL, AI_API_KEY, AI_MODEL,

  OPENROUTER_API_KEY, OPENROUTER_MODEL,
  HF_TOKEN, HF_MODEL,
  CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_AI_MODEL,
  GEMINI_API_KEY, GEMINI_MODEL, GPT5_API_KEY, GOOGLE_VISION_API_KEY,
  AWS_TEXTract_ACCESS_KEY, AWS_TEXTract_SECRET_KEY,
  AZURE_AI_VISION_KEY, OLMOCR_TOKEN, PADDLE_PYTHON,
} = require('../config/env.cjs');

const ANALYSIS_TIMEOUT_MS = 90_000;

// ---------------------------------------------------------------------------
// Provider catalogue — only declares shape; credentials checked per-call.
// ---------------------------------------------------------------------------
const PROVIDER_CATALOGUE = {
  openrouter: {
    label: 'OpenRouter (free vision model)',
    description: 'OpenRouter hosted free vision model; paid fallbacks disabled',
    model: OPENROUTER_MODEL || 'minimax/minimax-m3.1-flash:free',
    type: 'openai-compat',
    url: () => 'https://openrouter.ai/api/v1/chat/completions',
    token: () => OPENROUTER_API_KEY,
  },
  cloudflare: {
    label: 'Cloudflare Workers AI (Llama 3.2 Vision)',
    description: 'Cloudflare Workers AI hosted vision model',
    model: CLOUDFLARE_AI_MODEL || '@cf/meta/llama-3.2-11b-vision-instruct',
    type: 'openai-compat',
    url: () => CLOUDFLARE_ACCOUNT_ID
      ? `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(CLOUDFLARE_ACCOUNT_ID)}/ai/v1/chat/completions`
      : '',
    token: () => CLOUDFLARE_API_TOKEN,
  },
  huggingface: {
    label: 'Hugging Face (DeepSeek V4.1 Flash)',
    description: 'deepseek-ai/DeepSeek-V4.1-Flash-1017 via HF Router',
    model: HF_MODEL || 'deepseek-ai/DeepSeek-V4.1-Flash-1017',
    type: 'openai-compat',
    url: () => process.env.HF_TEST_STUB_URL || 'https://router.huggingface.co/v1/chat/completions',
    token: () => HF_TOKEN,
  },
  openai: {
    label: 'OpenAI (GPT-4o)',
    description: 'OpenAI GPT-4o vision via OpenAI API',
    model: AI_MODEL || 'gpt-4o-mini',
    type: 'openai-compat',
    url: () => AI_BASE_URL || 'https://api.openai.com/v1/chat/completions',
    token: () => OPENAI_API_KEY || AI_API_KEY,
  },
  gemini: {
    label: `Gemini (${GEMINI_MODEL})`,
    description: `Google Gemini via Generative Language API (${GEMINI_MODEL})`,
    model: GEMINI_MODEL,
    type: 'gemini',
    url: () => `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    token: () => GEMINI_API_KEY,
  },
  gpt5: {
    label: 'GPT-5',
    description: 'OpenAI GPT-5 via OpenAI API (optional re-analysis)',
    model: 'gpt-5',
    type: 'openai-compat',
    url: () => AI_BASE_URL || 'https://api.openai.com/v1/chat/completions',
    token: () => GPT5_API_KEY || OPENAI_API_KEY,
  },
  googlevision: {
    label: 'Google Cloud Vision',
    description: 'Google Cloud Vision API (document text detection)',
    model: 'google-vision-v1',
    type: 'google-vision',
    url: () => `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
    token: () => GOOGLE_VISION_API_KEY,
  },
  awstextract: {
    label: 'AWS Textract',
    description: 'Amazon Textract document analysis',
    model: 'aws-textract',
    type: 'aws-textract',
    url: () => 'https://textract.amazonaws.com/',
    token: () => AWS_TEXTract_ACCESS_KEY,
    secret: () => AWS_TEXTract_SECRET_KEY,
  },
  azurevision: {
    label: 'Azure AI Vision',
    description: 'Microsoft Azure AI Vision Read API',
    model: 'azure-vision-read',
    type: 'azure-vision',
    url: () => process.env.AZURE_VISION_ENDPOINT || '',
    token: () => AZURE_AI_VISION_KEY,
  },
  olmocr: {
    label: 'OlmOCR 2 7B',
    description: 'OlmOCR 2 7B via HF Router',
    model: 'allenai/olmOCR-7B-0225-preview',
    type: 'openai-compat',
    url: () => 'https://router.huggingface.co/v1/chat/completions',
    token: () => OLMOCR_TOKEN,
  },
  paddleocr: {
    label: 'PaddleOCR-VL',
    description: 'Local PaddleOCR + AI Structuring',
    model: 'paddleocr-vl',
    type: 'paddleocr',
    url: () => 'local',
    token: () => 'local',
  },
};


/**
 * Returns the resolved config for a provider, or null if not configured.
 * A provider is "configured" iff its primary token is non-empty.
 */
function resolveProvider(providerId) {
  const def = PROVIDER_CATALOGUE[providerId];
  if (!def) return null;
  const token = def.token();
  if (!token) return null;
  if (providerId === 'openrouter' && !def.model.endsWith(':free')) return null;
  // AWS also needs a secret
  if (def.type === 'aws-textract' && !def.secret()) return null;
  // Azure needs an endpoint URL
  if (def.type === 'azure-vision' && !def.url()) return null;
  return { ...def, id: providerId, resolvedToken: token, resolvedUrl: def.url() };
}

/** Returns available provider metadata (no tokens) for the client. */
function getAvailableProviders() {
  return Object.entries(PROVIDER_CATALOGUE)
    .filter(([id]) => resolveProvider(id) !== null)
    .map(([id, def]) => ({
      id,
      label: def.label,
      description: def.description,
      model: def.model,
      type: def.type,
    }));
}

function isConfigured() {
  return getAvailableProviders().length > 0;
}

// ---------------------------------------------------------------------------
// Shared extraction prompt (identical across all vision-capable providers).
// ---------------------------------------------------------------------------
const EXTRACTION_PROMPT = `You are a pharmacy prescription-analysis assistant. Read the attached prescription image and extract ONLY what is actually visible and legible.

Rules:
- Never invent a medicine, doctor, diagnosis, or test.
- Never guess unclear handwriting: use null for anything you cannot read confidently.
- If a medicine name is unclear write exactly the string "unclear" — do not invent a name.
- Preserve the prescription's own wording for names, dosages, and instructions.
- Do not change dosage or frequency values.
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

// ---------------------------------------------------------------------------
// JSON extraction helper
// ---------------------------------------------------------------------------
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
function clampConf(v) {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n > 1 ? n / 100 : n));
}

// ---------------------------------------------------------------------------
// Normalizer — converts raw AI JSON into the canonical schema.
// Works for both the hfAnalyzer format and the multi-AI format.
// ---------------------------------------------------------------------------
function normalizeResult(raw, providerId, model) {
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
        name,  // null preserved — "unclear" handwriting stays null/unclear
        strength: str(src.strength),
        dosage: str(src.dosage),
        frequency: str(src.frequency),
        duration: str(src.duration),
        route: str(src.route),
        instructions: str(src.instructions),
        confidence: clampConf(src.confidence),
        needsVerification: !src.name || clampConf(src.confidence) < 0.6,
      };
    })
    .filter((m) => m.name || m.strength || m.dosage || m.frequency);

  const warnings = Array.isArray(raw.warnings) ? raw.warnings.map(String).filter(Boolean) : [];
  for (const m of medicines) {
    if (!m.name) warnings.push('Medicine name could not be confidently read.');
    else if (m.name === 'unclear') warnings.push('A medicine name was marked unclear by the AI.');
    else if (m.confidence < 0.6) warnings.push(`Low confidence reading for "${m.name}".`);
  }
  if (medicines.length === 0) warnings.push('No medicines could be confidently extracted from the image.');

  return {
    doctor: {
      name: str(doctor.name),
      registrationNumber: str(doctor.registration_number),
    },
    patient: {
      name: str(patient.name),
      age: typeof patient.age === 'number' ? patient.age : null,
      gender: str(patient.gender),
    },
    date: str(raw.prescription_date),
    medicines,
    diagnosis: Array.isArray(raw.diagnosis) ? raw.diagnosis.map(String).filter(Boolean) : [],
    tests: Array.isArray(raw.tests) ? raw.tests.map(String).filter(Boolean) : [],
    additional_instructions: Array.isArray(raw.additional_instructions)
      ? raw.additional_instructions.map(String).filter(Boolean) : [],
    warnings: [...new Set(warnings)],
    overallConfidence: clampConf(
      raw.overall_confidence ?? (medicines.length
        ? medicines.reduce((s, m) => s + m.confidence, 0) / medicines.length
        : 0)
    ),
    provider: providerId,
    providerLabel: PROVIDER_CATALOGUE[providerId]?.label || providerId,
    model,
    analyzedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// HTTP fetch helper
// ---------------------------------------------------------------------------
async function fetchJson(url, { method = 'POST', headers = {}, body, timeoutMs = ANALYSIS_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  return res;
}

// ---------------------------------------------------------------------------
// OpenAI-compatible provider (HF Router, OpenAI, GPT-5, OlmOCR)
// ---------------------------------------------------------------------------
async function analyzeOpenAiCompat(provider, imageBuffer, mimetype) {
  const mime = mimetype === 'image/jpg' ? 'image/jpeg' : mimetype;
  const dataUri = `data:${mime};base64,${imageBuffer.toString('base64')}`;

  const res = await fetchJson(provider.resolvedUrl, {
    headers: { Authorization: `Bearer ${provider.resolvedToken}` },
    body: {
      model: provider.model,
      ...(provider.id === 'openrouter' ? { provider: { allow_fallbacks: false } } : {}),
      ...(provider.id === 'openrouter' ? { response_format: { type: 'json_object' } } : {}),
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: EXTRACTION_PROMPT },
          { type: 'image_url', image_url: { url: dataUri } },
        ],
      }],
      max_tokens: 1600,
      temperature: 0,
    },
  });

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      errMsg = errBody?.error?.message || errBody?.error?.code || errBody?.message || errMsg;
    } catch { /* non-JSON */ }
    console.error(`[MULTI-AI] ${provider.label} error ${res.status}:`, errMsg);
    const e = new Error(`${provider.label}: ${errMsg}`);
    e.status = res.status === 401 || res.status === 403 ? 501 : 502;
    throw e;
  }

  const body = await res.json();
  const content = body?.choices?.[0]?.message?.content;
  const parsed = extractJson(typeof content === 'string' ? content : JSON.stringify(content));
  if (!parsed) {
    const e = new Error(`${provider.label} returned an unparsable response. Retry with a clearer image.`);
    e.status = 502; throw e;
  }
  return normalizeResult(parsed, provider.id, provider.model);
}

// ---------------------------------------------------------------------------
// Gemini provider — uses generateContent API with inlineData.
// Google retired 2.5 Pro for keys created after its deprecation; when the
// configured model is unavailable we transparently retry the current Pro
// alias and report the model that actually ran (never silently).
// ---------------------------------------------------------------------------
function geminiUrl(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
}

async function analyzeGemini(provider, imageBuffer, mimetype) {
  const mime = mimetype === 'image/jpg' ? 'image/jpeg' : mimetype;

  const buildBody = () => ({
    contents: [{
      parts: [
        { text: EXTRACTION_PROMPT },
        { inlineData: { mimeType: mime, data: imageBuffer.toString('base64') } },
      ],
    }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 4096,
      // Thinking models (gemini-2.5/3.x) spend the token budget on hidden
      // reasoning first — cap it so the JSON answer always fits.
      thinkingConfig: { thinkingBudget: 512 },
    },
  });

  let res = await fetchJson(geminiUrl(provider.model), {
    // Gemini uses API key in URL, no Authorization header needed
    headers: {},
    body: buildBody(),
  });

  let usedModel = provider.model;
  let retireNotice = null;
  if (res.status === 404) {
    let msg = '';
    try { msg = (await res.json())?.error?.message || ''; } catch { /* ignore */ }
    if (/no longer available|not found|not supported/i.test(msg)) {
      // Retry with the current stable Pro alias.
      usedModel = 'gemini-pro-latest';
      retireNotice = `Configured model ${provider.model} is no longer served to this API key; used ${usedModel} instead.`;
      res = await fetchJson(geminiUrl(usedModel), { headers: {}, body: buildBody() });
    }
  }

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      errMsg = errBody?.error?.message || errBody?.error?.code || errMsg;
    } catch { /* non-JSON */ }
    console.error(`[MULTI-AI] Gemini error ${res.status}:`, errMsg);
    const e = new Error(`Gemini (${usedModel}): ${errMsg}`);
    e.status = res.status === 401 || res.status === 403 ? 501 : 502;
    throw e;
  }

  const body = await res.json();
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = extractJson(text);
  if (!parsed) {
    // Try if the whole text is JSON
    const fallback = extractJson(JSON.stringify(body));
    if (!fallback) {
      const e = new Error('Gemini returned an unparsable response. Retry with a clearer image.');
      e.status = 502; throw e;
    }
    const r = normalizeResult(fallback, provider.id, usedModel);
    if (retireNotice) r.warnings.push(retireNotice);
    return r;
  }
  const r2 = normalizeResult(parsed, provider.id, usedModel);
  if (retireNotice) r2.warnings.push(retireNotice);
  return r2;
}

// ---------------------------------------------------------------------------
// Google Cloud Vision — Document Text Detection → raw OCR text only.
// We do not parse medicines from raw OCR here (no AI reasoning), so we return
// a special result that the frontend can show as a raw text comparison.
// ---------------------------------------------------------------------------
async function analyzeGoogleVision(provider, imageBuffer, mimetype) {
  const res = await fetchJson(provider.resolvedUrl, {
    headers: {},  // API key embedded in URL
    body: {
      requests: [{
        image: { content: imageBuffer.toString('base64') },
        features: [
          { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 },
        ],
      }],
    },
  });

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      errMsg = errBody?.error?.message || errMsg;
    } catch { /* non-JSON */ }
    const e = new Error(`Google Cloud Vision: ${errMsg}`);
    e.status = res.status === 401 || res.status === 403 ? 501 : 502;
    throw e;
  }

  const body = await res.json();
  const fullText = body?.responses?.[0]?.fullTextAnnotation?.text || '';
  
  // Vision API gives raw OCR text — return it as a special result with no medicines
  // (honest: we cannot parse medicines without AI reasoning)
  return {
    doctor: { name: null, registrationNumber: null },
    patient: { name: null, age: null, gender: null },
    date: null,
    medicines: [],
    diagnosis: [],
    tests: [],
    additional_instructions: [],
    warnings: ['Google Cloud Vision returned raw OCR text only. Medicine parsing requires an AI language model.'],
    overallConfidence: 0,
    rawOcrText: fullText,
    provider: provider.id,
    providerLabel: provider.label,
    model: provider.model,
    analyzedAt: new Date().toISOString(),
    isOcrOnly: true,
  };
}

// ---------------------------------------------------------------------------
// PaddleOCR (Local OCR + AI Structuring)
// ---------------------------------------------------------------------------
async function analyzePaddleOcr(provider, imageBuffer, mimetype) {
  // 1. Write image to temp file
  const ext = mimetype.split('/')[1] || 'png';
  const tempPath = path.join(os.tmpdir(), `paddleocr_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);
  fs.writeFileSync(tempPath, imageBuffer);

  let rawOcrText = '';
  try {
    const pyScript = path.join(__dirname, 'paddle_ocr.py');
    const pythonBin = PADDLE_PYTHON && PADDLE_PYTHON.trim() ? PADDLE_PYTHON.trim() : 'python';
    const { stdout } = await execFileAsync(pythonBin, [pyScript, tempPath], { maxBuffer: 1024 * 1024 * 10, timeout: 240_000 });
    
    let result;
    try {
      // Find the last line that starts with { (to ignore any paddle paddle warnings)
      const lines = stdout.trim().split('\n');
      const jsonLine = lines.reverse().find(l => l.trim().startsWith('{'));
      if (!jsonLine) throw new Error('No JSON output found');
      result = JSON.parse(jsonLine);
    } catch (err) {
      const e = new Error(`PaddleOCR output was not valid JSON. Error: ${err.message}`);
      e.status = 502; throw e;
    }

    if (result.error || !result.success) {
      const e = new Error(`PaddleOCR Error: ${result.error || 'Unknown failure'}`);
      e.status = 502; throw e;
    }

    rawOcrText = result.text || '';
  } finally {
    try { fs.unlinkSync(tempPath); } catch (e) {}
  }

  if (!rawOcrText.trim()) {
    const res = normalizeResult({}, provider.id, provider.model);
    res.warnings.push('PaddleOCR extracted no text from the image.');
    return res;
  }

  // 3. Structure with an available language model. Order: Gemini first, then
  // any openai-compatible provider (GPT-5, HF/Qwen…). A provider that fails
  // (quota / 404 / 5xx) is skipped and the next one is tried — one
  // rate-limited upstream must never abort the whole PaddleOCR analysis.
  const available = getAvailableProviders();
  const candidateDefs = [
    ...available.filter(p => p.id === 'gemini'),
    ...available.filter(p => p.type === 'openai-compat'),
  ];

  const TEXT_PROMPT = `${EXTRACTION_PROMPT}
  
IMPORTANT: Instead of an image, you are provided with the RAW OCR TEXT extracted by PaddleOCR. 
Read the text and structure it exactly as requested. 

Raw OCR Text:
"""
${rawOcrText}
"""
`;

  let parsed = null;
  let structProvider = null;
  const attempts = [];
  for (const def of candidateDefs) {
    const sp = resolveProvider(def.id);
    if (!sp) continue;
    const calls = sp.type === 'gemini'
      ? [
          { url: sp.resolvedUrl, headers: {} },
          { url: geminiUrl('gemini-pro-latest'), headers: {} }, // alias if the configured model is unavailable
        ]
      : [{ url: sp.resolvedUrl, headers: { Authorization: `Bearer ${sp.resolvedToken}` } }];

    for (const call of calls) {
      try {
        const body = sp.type === 'gemini'
          ? {
              contents: [{ parts: [{ text: TEXT_PROMPT }] }],
              generationConfig: { temperature: 0, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 512 } },
            }
          : {
              model: sp.model,
              messages: [{ role: 'user', content: TEXT_PROMPT }],
              max_tokens: 1600,
              temperature: 0,
            };
        const res = await fetchJson(call.url, { headers: call.headers, body });
        if (!res.ok) { attempts.push(`${sp.label}: HTTP ${res.status}`); continue; }
        const rj = await res.json();
        const text = sp.type === 'gemini'
          ? rj?.candidates?.[0]?.content?.parts?.[0]?.text
          : rj?.choices?.[0]?.message?.content;
        parsed = extractJson(text) || extractJson(JSON.stringify(rj));
        if (parsed) { structProvider = sp; break; }
        attempts.push(`${sp.label}: response contained no JSON`);
      } catch (err) {
        attempts.push(`${sp.label}: ${err.message}`);
      }
    }
    if (parsed) break;
  }

  if (!parsed || !structProvider) {
    // Honest OCR-only result: never invent medicines no model could parse.
    return {
      doctor: { name: null, registrationNumber: null },
      patient: { name: null, age: null, gender: null },
      date: null,
      medicines: [],
      diagnosis: [],
      tests: [],
      additional_instructions: [],
      warnings: [
        'PaddleOCR returned raw OCR text, but every structuring model failed or was rate-limited.',
        ...attempts.map(a => `Structuring attempt — ${a}`),
      ],
      overallConfidence: 0,
      rawOcrText,
      provider: provider.id,
      providerLabel: provider.label,
      model: provider.model,
      analyzedAt: new Date().toISOString(),
      isOcrOnly: true,
    };
  }

  const normalized = normalizeResult(parsed, provider.id, provider.model);
  normalized.rawOcrText = rawOcrText; // feed OCR text quality into the ML feature layer
  normalized.warnings.push(`Medicines parsed by ${structProvider.label} based on text extracted by PaddleOCR.`);
  return normalized;
}

// ---------------------------------------------------------------------------
// Main entry point — analyze with a single named provider.
// ---------------------------------------------------------------------------
async function analyzeWithProvider(imageBuffer, mimetype, providerId) {
  const provider = resolveProvider(providerId);
  if (!provider) {
    const e = new Error(`Provider "${providerId}" is not configured on the server.`);
    e.status = 501; throw e;
  }

  console.log(`[MULTI-AI] Starting analysis: ${provider.label} (${provider.model})`);
  console.log(`[MULTI-AI] Image: ${imageBuffer.length} bytes, mimetype: ${mimetype}`);

  let result;
  if (provider.type === 'gemini') {
    result = await analyzeGemini(provider, imageBuffer, mimetype);
  } else if (provider.type === 'google-vision') {
    result = await analyzeGoogleVision(provider, imageBuffer, mimetype);
  } else if (provider.type === 'paddleocr') {
    result = await analyzePaddleOcr(provider, imageBuffer, mimetype);
  } else if (provider.type === 'openai-compat') {
    result = await analyzeOpenAiCompat(provider, imageBuffer, mimetype);
  } else {
    const e = new Error(`Provider type "${provider.type}" is not yet implemented.`);
    e.status = 501; throw e;
  }


  console.log(`[MULTI-AI] ${provider.label} complete — ${result.medicines.length} medicines extracted`);
  return result;
}

// ---------------------------------------------------------------------------
// Field-by-field comparison of two analysis results.
// Never picks a winner — only reports MATCH or NEEDS_VERIFICATION per field.
// ---------------------------------------------------------------------------
function compareAnalyses(first, second) {
  const SCALAR_FIELDS = [
    { key: 'date', label: 'Prescription date' },
  ];
  const DOCTOR_FIELDS = [
    { key: 'name', label: 'Doctor name' },
    { key: 'registrationNumber', label: 'Doctor registration number' },
  ];
  const PATIENT_FIELDS = [
    { key: 'name', label: 'Patient name' },
    { key: 'age', label: 'Patient age' },
    { key: 'gender', label: 'Patient gender' },
  ];
  const MED_FIELDS = [
    { key: 'name', label: 'Medicine name' },
    { key: 'strength', label: 'Strength' },
    { key: 'dosage', label: 'Dosage' },
    { key: 'frequency', label: 'Frequency' },
    { key: 'duration', label: 'Duration' },
    { key: 'route', label: 'Route' },
  ];

  function compareVal(a, b) {
    if (a === null && b === null) return 'match';
    if (a === null || b === null) return 'needs_verification';
    const sa = String(a).trim().toLowerCase();
    const sb = String(b).trim().toLowerCase();
    return sa === sb ? 'match' : 'needs_verification';
  }

  const fields = [];

  // Scalar
  for (const { key, label } of SCALAR_FIELDS) {
    const a = first[key], b = second[key];
    fields.push({ category: 'prescription', field: key, label, ai1: a, ai2: b, status: compareVal(a, b) });
  }

  // Doctor
  for (const { key, label } of DOCTOR_FIELDS) {
    const a = first.doctor?.[key] ?? null, b = second.doctor?.[key] ?? null;
    fields.push({ category: 'doctor', field: key, label, ai1: a, ai2: b, status: compareVal(a, b) });
  }

  // Patient
  for (const { key, label } of PATIENT_FIELDS) {
    const a = first.patient?.[key] ?? null, b = second.patient?.[key] ?? null;
    fields.push({ category: 'patient', field: key, label, ai1: a, ai2: b, status: compareVal(a, b) });
  }

  // Medicines — compare by position; flag length mismatch
  const maxMeds = Math.max(first.medicines.length, second.medicines.length);
  if (maxMeds === 0) {
    fields.push({ category: 'medicines', field: 'count', label: 'Medicine count', ai1: 0, ai2: 0, status: 'match' });
  } else if (first.medicines.length !== second.medicines.length) {
    fields.push({
      category: 'medicines', field: 'count', label: 'Medicine count',
      ai1: first.medicines.length, ai2: second.medicines.length,
      status: 'needs_verification',
    });
  }

  for (let i = 0; i < maxMeds; i++) {
    const m1 = first.medicines[i] || null;
    const m2 = second.medicines[i] || null;
    for (const { key, label } of MED_FIELDS) {
      const a = m1?.[key] ?? null, b = m2?.[key] ?? null;
      fields.push({
        category: 'medicine',
        medicineIndex: i,
        field: key,
        label: `Medicine ${i + 1} — ${label}`,
        ai1: a,
        ai2: b,
        status: compareVal(a, b),
      });
    }
  }

  const totalFields = fields.length;
  const matchedFields = fields.filter((f) => f.status === 'match').length;
  const disagreements = fields.filter((f) => f.status === 'needs_verification').length;

  return {
    fields,
    summary: {
      totalFields,
      matched: matchedFields,
      disagreements,
      agreementPercent: totalFields > 0 ? Math.round((matchedFields / totalFields) * 100) : 100,
    },
  };
}

/**
 * Adapt a multiAiAnalysis result to the shape the /analyze route expects
 * from the HF analyzer (prescription_date / overall_confidence / _meta).
 */
function toHfShape(result) {
  return {
    medicines: result.medicines,
    doctor: result.doctor,
    patient: result.patient,
    prescription_date: result.date,
    diagnosis: result.diagnosis,
    tests: result.tests,
    additional_instructions: result.additional_instructions,
    warnings: result.warnings,
    overall_confidence: result.overallConfidence,
    _meta: {
      provider: result.provider,
      model: result.model,
      analyzed_at: result.analyzedAt,
    },
  };
}

module.exports = {
  analyzeWithProvider,
  compareAnalyses,
  getAvailableProviders,
  isConfigured,
  normalizeResult,
  toHfShape,
  PROVIDER_CATALOGUE,
  _internal: { extractJson, EXTRACTION_PROMPT, resolveProvider },
};