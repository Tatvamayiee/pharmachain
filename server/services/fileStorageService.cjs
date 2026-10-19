// ---------------------------------------------------------------------------
// Server-side prescription image storage. Files are persisted server-side and
// encrypted at rest with AES-256-GCM (per-file random IV + auth tag), under
// <dataDir>/prescription-files/<org>/<uuid>.bin. The key comes from
// PHARMACHAIN_FILE_KEY (hex/base64, 32 bytes) with a dev-only fallback — and a
// loud warning when the fallback is used. The key is never logged or sent to
// the client. MIME + size validation is shared with the analyzer path.
// ---------------------------------------------------------------------------
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { FILE_STORAGE_DIR } = require('../config/env.cjs');

const DATA_ROOT = path.isAbsolute(FILE_STORAGE_DIR)
  ? FILE_STORAGE_DIR
  : path.join(__dirname, '..', '..', FILE_STORAGE_DIR);

function storageKey() {
  const raw = process.env.PHARMACHAIN_FILE_KEY || '';
  if (raw) {
    // Accept hex (64 chars) or base64 (44 chars with padding) encoding 32 bytes.
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
    const b = Buffer.from(raw, 'base64');
    if (b.length === 32) return b;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('PHARMACHAIN_FILE_KEY must be set to a 32-byte hex/base64 key in production');
  }
  if (!storageKey._warned) {
    // One-time warning only — never prints the key itself.
    console.warn('[fileStorage] PHARMACHAIN_FILE_KEY not set — using an ephemeral dev key. Files will be unreadable after restart.');
    storageKey._warned = true;
  }
  return crypto.createHash('sha256').update('pharmachain-dev-file-key').digest();
}

function orgDir(org) {
  const safeOrg = String(org || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'unknown';
  const dir = path.join(DATA_ROOT, 'prescription-files', safeOrg);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function validateImageInput({ mimetype, size, buffer }) {
  const ALLOWED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
  const MAX_BYTES = 10 * 1024 * 1024;
  if (!mimetype || !ALLOWED.includes(mimetype)) {
    const err = new Error(`Unsupported file type "${mimetype || 'unknown'}". Allowed: PNG, JPG, WEBP, PDF.`);
    err.status = 422;
    throw err;
  }
  if (!size || size <= 0) {
    const err = new Error('Empty file.');
    err.status = 422;
    throw err;
  }
  if (size > MAX_BYTES) {
    const err = new Error('File exceeds the 10 MB limit.');
    err.status = 422;
    throw err;
  }
  // Content-Type and filename are client-controlled — never trusted. Verify
  // magic bytes match the declared type before the file is persisted.
  if (buffer && buffer.length >= 8) {
    const sig = buffer.subarray(0, 8);
    const startsWith = (...bytes) => bytes.every((b, i) => sig[i] === b);
    const jpeg = startsWith(0xff, 0xd8, 0xff);
    const png = startsWith(0x89, 0x50, 0x4e, 0x47);
    const webp = startsWith(0x52, 0x49, 0x46, 0x46) && buffer.subarray(8, 12).toString('latin1') === 'WEBP';
    const pdf = startsWith(0x25, 0x50, 0x44, 0x46);
    const sniffed = jpeg ? 'image/jpeg' : png ? 'image/png' : webp ? 'image/webp' : pdf ? 'application/pdf' : null;
    if (!sniffed || sniffed !== mimetype) {
      const err = new Error('File content does not match its declared type.');
      err.status = 422;
      throw err;
    }
  }
}

/**
 * Encrypt and persist a file. Returns metadata only (never the key).
 * Stored layout: [12-byte IV][16-byte auth tag][ciphertext].
 */
async function saveFile({ buffer, mimetype, originalName, organizationId }) {
  validateImageInput({ mimetype, size: buffer.length, buffer });
  const key = storageKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();

  const id = crypto.randomUUID();
  const dir = orgDir(organizationId);
  const filePath = path.join(dir, `${id}.bin`);
  fs.writeFileSync(filePath, Buffer.concat([iv, tag, ciphertext]));

  return {
    fileId: id,
    originalName: String(originalName || 'prescription').slice(0, 160),
    mimetype,
    size: buffer.length,
    storedEncrypted: true,
    algorithm: 'aes-256-gcm',
    organizationId,
    createdAt: new Date().toISOString(),
  };
}

/** Decrypt a stored file for an authorized org. Throws if org/path mismatch. */
async function readFile({ organizationId, fileId }) {
  const safeId = String(fileId || '').replace(/[^a-zA-Z0-9-]/g, '');
  if (!safeId) {
    const err = new Error('Invalid file id');
    err.status = 400;
    throw err;
  }
  const dir = orgDir(organizationId);
  const filePath = path.join(dir, `${safeId}.bin`);
  if (!fs.existsSync(filePath)) {
    const err = new Error('File not found');
    err.status = 404;
    throw err;
  }
  const raw = fs.readFileSync(filePath);
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const key = storageKey();
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    const err = new Error('File decryption failed — storage key changed or file corrupted');
    err.status = 500;
    throw err;
  }
}

module.exports = { saveFile, readFile, validateImageInput, DATA_ROOT };
