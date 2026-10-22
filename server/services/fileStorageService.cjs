// ---------------------------------------------------------------------------
// Server-side prescription image storage. Files are persisted server-side and
// encrypted at rest with AES-256-GCM (per-file random IV + auth tag), under
// <dataDir>/prescription-files/<org>/<uuid>.bin or in MongoDB GridFS. The key comes from
// PHARMACHAIN_FILE_KEY (hex/base64, 32 bytes) with a dev-only fallback — and a
// loud warning when the fallback is used. The key is never logged or sent to
// the client. MIME + size validation is shared with the analyzer path.
// ---------------------------------------------------------------------------
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const mongoose = require('mongoose');
const { FILE_STORAGE_BACKEND, FILE_STORAGE_DIR } = require('../config/env.cjs');

const DATA_ROOT = path.isAbsolute(FILE_STORAGE_DIR)
  ? FILE_STORAGE_DIR
  : path.join(__dirname, '..', '..', FILE_STORAGE_DIR);
const GRIDFS_BUCKET_NAME = 'prescriptionFiles';
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function storageKey() {
  const raw = process.env.PHARMACHAIN_FILE_KEY || '';
  if (raw) {
    // Accept hex (64 chars) or base64 (44 chars with padding) encoding 32 bytes.
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
    if (/^[A-Za-z0-9+/]{43}=$/.test(raw)) {
      const b = Buffer.from(raw, 'base64');
      if (b.length === 32) return b;
    }
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
  const safeOrg = safeOrganization(org);
  const dir = path.join(DATA_ROOT, 'prescription-files', safeOrg);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function safeOrganization(org) {
  return String(org || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'unknown';
}

function organizationHash(organizationId) {
  return crypto.createHash('sha256')
    .update(String(organizationId || 'unknown'))
    .digest('hex');
}

function gridFsBucket() {
  const db = mongoose.connection.db;
  if (mongoose.connection.readyState !== 1 || !db) {
    const err = new Error('MongoDB must be connected to use GridFS prescription storage.');
    err.status = 503;
    throw err;
  }
  return new mongoose.mongo.GridFSBucket(db, { bucketName: GRIDFS_BUCKET_NAME });
}

function validateImageInput({ mimetype, size, buffer }) {
  const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf']);
  const contentType = String(mimetype || '').toLowerCase();
  if (!ALLOWED.has(contentType)) {
    const err = new Error(`Unsupported file type "${mimetype || 'unknown'}". Allowed: PNG, JPG, WEBP, PDF.`);
    err.status = 422;
    throw err;
  }
  if (!Buffer.isBuffer(buffer) || size !== buffer.length) {
    const err = new Error('Invalid file data.');
    err.status = 422;
    throw err;
  }
  if (size <= 0) {
    const err = new Error('Empty file.');
    err.status = 422;
    throw err;
  }
  if (size > MAX_FILE_BYTES) {
    const err = new Error('File exceeds the 10 MB limit.');
    err.status = 422;
    throw err;
  }
  // Content-Type and filename are client-controlled — never trusted. Verify
  // magic bytes match the declared type before the file is persisted.
  const jpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = buffer.length >= 12
    && buffer.subarray(0, 4).toString('latin1') === 'RIFF'
    && buffer.subarray(8, 12).toString('latin1') === 'WEBP';
  const pdf = buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  const sniffed = jpeg ? 'image/jpeg' : png ? 'image/png' : webp ? 'image/webp' : pdf ? 'application/pdf' : null;
  const declared = contentType === 'image/jpg' ? 'image/jpeg' : contentType;
  if (!sniffed || sniffed !== declared) {
    const err = new Error('File content does not match its declared type.');
    err.status = 422;
    throw err;
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
  const encrypted = Buffer.concat([iv, tag, ciphertext]);
  if (FILE_STORAGE_BACKEND === 'gridfs') {
    const bucket = gridFsBucket();
    const upload = bucket.openUploadStreamWithId(id, `${id}.bin`, {
      metadata: {
        organizationHash: organizationHash(organizationId),
        encrypted: true,
        originalSize: buffer.length,
      },
    });
    await pipeline(Readable.from([encrypted]), upload);
  } else {
    const dir = orgDir(organizationId);
    fs.writeFileSync(path.join(dir, `${id}.bin`), encrypted);
  }

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
  let raw;
  if (FILE_STORAGE_BACKEND === 'gridfs') {
    const db = mongoose.connection.db;
    if (mongoose.connection.readyState !== 1 || !db) {
      const err = new Error('MongoDB must be connected to use GridFS prescription storage.');
      err.status = 503;
      throw err;
    }
    const file = await db.collection(`${GRIDFS_BUCKET_NAME}.files`).findOne({
      _id: safeId,
      'metadata.organizationHash': organizationHash(organizationId),
      'metadata.encrypted': true,
    });
    if (!file) {
      const err = new Error('File not found');
      err.status = 404;
      throw err;
    }
    if (!Number.isSafeInteger(file.length) || file.length < 29 || file.length > MAX_FILE_BYTES + 28
      || file.length !== file.metadata.originalSize + 28) {
      const err = new Error('Stored file is incomplete or corrupted.');
      err.status = 500;
      throw err;
    }
    const chunks = [];
    for await (const chunk of gridFsBucket().openDownloadStream(safeId)) {
      chunks.push(Buffer.from(chunk));
    }
    raw = Buffer.concat(chunks);
  } else {
    const dir = orgDir(organizationId);
    const filePath = path.join(dir, `${safeId}.bin`);
    if (!fs.existsSync(filePath)) {
      const err = new Error('File not found');
      err.status = 404;
      throw err;
    }
    raw = fs.readFileSync(filePath);
  }
  if (raw.length < 29) {
    const err = new Error('Stored file is incomplete or corrupted.');
    err.status = 500;
    throw err;
  }
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
