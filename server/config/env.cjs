// Central environment configuration. Never log secret values.
const path = require('path');

// This module lives in server/config/, so the project root is two levels up.
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_DEV = NODE_ENV !== 'production';
const PORT = Number(process.env.PORT) || 41837;
const JWT_SECRET = process.env.JWT_SECRET ||
  (IS_DEV
    ? // Dev-only deterministic fallback so local runs work out of the box.
      // Tokens minted with it are worthless to an attacker unless they can
      // read this repository — and .env overrides it for real deployments.
      'dev-secret-change-me'
    : // In production an unset JWT_SECRET is a critical misconfiguration:
      // refuse to boot rather than sign tokens with a guessable key.
      (() => { throw new Error('JWT_SECRET must be set in production'); })());
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const MONGODB_URI = process.env.PHARMACHAIN_MONGODB_URI || '';
if (NODE_ENV === 'production' && !MONGODB_URI) {
  throw new Error('PHARMACHAIN_MONGODB_URI must be set in production');
}
const CORS_ORIGINS = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
if (NODE_ENV === 'production' && CORS_ORIGINS.length === 0) {
  throw new Error('CORS_ORIGINS must list the trusted frontend origins in production');
}
const FILE_KEY = process.env.PHARMACHAIN_FILE_KEY || '';
const FILE_STORAGE_BACKEND = (process.env.PHARMACHAIN_FILE_STORAGE_BACKEND || 'local').toLowerCase();
const validFileKey = /^[0-9a-fA-F]{64}$/.test(FILE_KEY)
  || (/^[A-Za-z0-9+/]{43}=$/.test(FILE_KEY) && Buffer.from(FILE_KEY, 'base64').length === 32);
if (NODE_ENV === 'production' && !validFileKey) {
  throw new Error('PHARMACHAIN_FILE_KEY must be a 32-byte hex or base64 key in production');
}
if (!['local', 'gridfs'].includes(FILE_STORAGE_BACKEND)) {
  throw new Error('PHARMACHAIN_FILE_STORAGE_BACKEND must be either "local" or "gridfs"');
}
if (NODE_ENV === 'production' && FILE_STORAGE_BACKEND !== 'gridfs') {
  throw new Error('PHARMACHAIN_FILE_STORAGE_BACKEND must be "gridfs" in production');
}
const JSON_LIMIT = process.env.JSON_BODY_LIMIT || '15mb';
// Feature flag: persistence via MongoDB is only attempted when a URI is present.

// AI prescription-analysis provider (single-provider /analyze path).
// Explicit PHARMACHAIN_AI_PROVIDER wins. Otherwise inferred:
//   'openrouter'  when OPENROUTER_API_KEY is set
//   'cloudflare'  when Cloudflare account ID and API token are set
//   'openai'      when OPENAI_API_KEY (or PHARMACHAIN_AI_API_KEY) is set
//   'huggingface' when only HF_TOKEN or HUGGINGFACE_API_KEY is set
//   'none'        when neither is set -> /analyze returns 501
// Also accepts 'openai-compatible' (custom OpenAI-shaped endpoint) and 'custom'.
// NOTE: OPENAI_API_KEY and PHARMACHAIN_AI_API_KEY are aliases for the same slot;
// whichever comes first in .env wins, so set only one of them.
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || process.env.PHARMACHAIN_AI_API_KEY || '').trim();
const AI_API_KEY = OPENAI_API_KEY;
const AI_BASE_URL = (process.env.OPENAI_BASE_URL || process.env.PHARMACHAIN_AI_BASE_URL || 'https://api.openai.com/v1/chat/completions').trim();
const AI_MODEL = (process.env.OPENAI_MODEL || process.env.PHARMACHAIN_AI_MODEL || 'gpt-4o-mini').trim();
const OPENROUTER_API_KEY = (process.env.OPENROUTER_API_KEY || '').trim();
const OPENROUTER_MODEL = (process.env.OPENROUTER_MODEL || 'minimax/minimax-m3.1-flash:free').trim();
const CLOUDFLARE_ACCOUNT_ID = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const CLOUDFLARE_API_TOKEN = (process.env.CLOUDFLARE_API_TOKEN || '').trim();
const CLOUDFLARE_AI_MODEL = (process.env.CLOUDFLARE_AI_MODEL || '@cf/meta/llama-3.2-11b-vision-instruct').trim();
const AI_PROVIDER = (process.env.PHARMACHAIN_AI_PROVIDER || (
  OPENROUTER_API_KEY ? 'openrouter' :
    CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_API_TOKEN ? 'cloudflare' :
      OPENAI_API_KEY ? 'openai' :
        process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY ? 'huggingface' : 'none'
)).toLowerCase();

// Additional AI provider credentials for multi-analysis
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const GEMINI_MODEL = (process.env.GEMINI_MODEL || 'gemini-2.5-pro').trim();
const GPT5_API_KEY = (process.env.GPT5_API_KEY || '').trim();
const GOOGLE_VISION_API_KEY = (process.env.GOOGLE_VISION_API_KEY || '').trim();
const AWS_TEXTract_ACCESS_KEY = (process.env.AWS_TEXTract_ACCESS_KEY || '').trim();
const AWS_TEXTract_SECRET_KEY = (process.env.AWS_TEXTract_SECRET_KEY || '').trim();
const AZURE_AI_VISION_KEY = (process.env.AZURE_AI_VISION_KEY || '').trim();
const OLMOCR_TOKEN = (process.env.OLMOCR_TOKEN || '').trim();

// Hugging Face Inference Providers (vision prescription analyzer).
const HF_TOKEN = (process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || '').trim();
const HF_MODEL = (process.env.HF_MODEL || 'deepseek-ai/DeepSeek-V4.1-Flash-1017').trim();
// Local PaddleOCR-VL sidecar (official pip package). Optional override for the
// python interpreter used to run server/services/paddle_ocr.py.
const PADDLE_PYTHON = (process.env.PADDLE_PYTHON || 'python').trim();
// Encrypted file storage for prescription uploads.
const FILE_STORAGE_DIR = process.env.PHARMACHAIN_FILE_STORAGE_DIR || '.data/files';

// Polygon Amoy prescription-hash registry (backend-only; key never logged).
const BLOCKCHAIN_RPC_URL = process.env.BLOCKCHAIN_RPC_URL || '';
const BLOCKCHAIN_CONTRACT_ADDRESS = process.env.BLOCKCHAIN_CONTRACT_ADDRESS || '';
const BLOCKCHAIN_PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY ||
  process.env[`BLOCKCHAIN_PRIVATE_KEY_${NODE_ENV.toUpperCase()}`] ||
  process.env[`BLOCKCHAIN_PRIVATE_KEY_${IS_DEV ? 'DEV' : 'PROD'}`] ||
  '';
const BLOCKCHAIN_NETWORK = process.env.BLOCKCHAIN_NETWORK || 'polygon-amoy';
const BLOCKCHAIN_EXPLORER_URL = process.env.BLOCKCHAIN_EXPLORER_URL || 'https://amoy.polygonscan.com';

module.exports = {
  NODE_ENV, IS_DEV, PORT, JWT_SECRET, JWT_EXPIRES_IN,
  MONGODB_URI, CORS_ORIGINS, JSON_LIMIT,
  FILE_STORAGE_BACKEND,
  OPENAI_API_KEY, AI_PROVIDER, AI_BASE_URL, AI_API_KEY, AI_MODEL,
  OPENROUTER_API_KEY, OPENROUTER_MODEL,
  CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_AI_MODEL,
  HF_TOKEN, HF_MODEL,
  PADDLE_PYTHON,
  FILE_STORAGE_DIR,
  BLOCKCHAIN_RPC_URL, BLOCKCHAIN_CONTRACT_ADDRESS, BLOCKCHAIN_PRIVATE_KEY,
  BLOCKCHAIN_NETWORK, BLOCKCHAIN_EXPLORER_URL,
  GEMINI_API_KEY, GEMINI_MODEL, GPT5_API_KEY, GOOGLE_VISION_API_KEY,
  AWS_TEXTract_ACCESS_KEY, AWS_TEXTract_SECRET_KEY, AZURE_AI_VISION_KEY, OLMOCR_TOKEN,
};
