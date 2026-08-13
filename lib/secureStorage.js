const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROJECT_ROOT = path.join(__dirname, '..');
const PRIVATE_ROOT = path.join(PROJECT_ROOT, 'storage', 'private');
const PUBLIC_UPLOAD_ROOT = path.join(PROJECT_ROOT, 'uploads', 'public');

const MAX_PRIVATE_BYTES = 8 * 1024 * 1024;
const MAX_PUBLIC_IMAGE_BYTES = 6 * 1024 * 1024;

const ALLOWED_DOC_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
]);

const ALLOWED_PUBLIC_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
]);

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf'
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function randomName(ext) {
  return `${Date.now()}_${crypto.randomBytes(12).toString('hex')}${ext}`;
}

function sniffMime(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return 'image/gif';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buffer.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
  return null;
}

function parseDataUrl(input) {
  const raw = String(input || '').trim();
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(raw);
  if (!m) return null;
  const declaredMime = (m[1] || 'application/octet-stream').toLowerCase().trim();
  const isBase64 = Boolean(m[2]);
  const dataPart = m[3] || '';
  let buffer;
  try {
    buffer = isBase64
      ? Buffer.from(dataPart, 'base64')
      : Buffer.from(decodeURIComponent(dataPart), 'utf8');
  } catch {
    return null;
  }
  return { declaredMime, buffer };
}

function isDataUrl(value) {
  return typeof value === 'string' && value.trim().toLowerCase().startsWith('data:');
}

function isForbiddenActiveContent(mime) {
  const m = String(mime || '').toLowerCase();
  return (
    m.includes('html') ||
    m.includes('javascript') ||
    m === 'image/svg+xml' ||
    m === 'text/html' ||
    m === 'application/xhtml+xml'
  );
}

/**
 * Persist a data URL (or reject). Returns DB-safe metadata with relative storagePath.
 * kind: 'field-doc' | 'verification' | 'public-image'
 */
function persistIncomingFile(input, { kind }) {
  if (input == null || input === '') {
    return null;
  }

  const trimmed = String(input).trim();

  // Already a private/public reference path we issued previously
  if (!isDataUrl(trimmed)) {
    if (trimmed.startsWith('storage/private/') || trimmed.startsWith('uploads/public/')) {
      const abs = path.resolve(PROJECT_ROOT, trimmed);
      const root =
        trimmed.startsWith('storage/private/')
          ? path.resolve(PRIVATE_ROOT)
          : path.resolve(PUBLIC_UPLOAD_ROOT);
      if (!abs.startsWith(root + path.sep) && abs !== root) {
        const err = new Error('Invalid storage path');
        err.status = 400;
        throw err;
      }
      if (!fs.existsSync(abs)) {
        const err = new Error('Referenced file not found');
        err.status = 400;
        throw err;
      }
      const st = fs.statSync(abs);
      return {
        storagePath: trimmed.replace(/\\/g, '/'),
        mimeType: sniffMime(fs.readFileSync(abs)) || 'application/octet-stream',
        sizeBytes: st.size
      };
    }
    // Reject raw http URLs / arbitrary strings for private docs — force re-upload as data URL or path
    if (kind === 'field-doc' || kind === 'verification') {
      const err = new Error('Documents must be uploaded as files (data URL converted server-side) or existing storage paths');
      err.status = 400;
      throw err;
    }
    // Public images historically may be external URLs — keep short http(s) refs without writing DB blobs
    if (/^https?:\/\//i.test(trimmed) && trimmed.length < 2000) {
      return {
        storagePath: trimmed,
        mimeType: 'image/jpeg',
        sizeBytes: 0,
        publicUrl: trimmed
      };
    }
    const err = new Error('Unsupported image reference');
    err.status = 400;
    throw err;
  }

  const parsed = parseDataUrl(trimmed);
  if (!parsed || !parsed.buffer || !parsed.buffer.length) {
    const err = new Error('Invalid data URL');
    err.status = 400;
    throw err;
  }

  const sniffed = sniffMime(parsed.buffer);
  if (!sniffed) {
    const err = new Error('Unrecognized or disallowed file content');
    err.status = 400;
    throw err;
  }
  if (isForbiddenActiveContent(parsed.declaredMime) || isForbiddenActiveContent(sniffed)) {
    const err = new Error('Active content file types are not allowed');
    err.status = 400;
    throw err;
  }

  const isPublicImage = kind === 'public-image';
  const allow = isPublicImage ? ALLOWED_PUBLIC_IMAGE_MIME : ALLOWED_DOC_MIME;
  if (!allow.has(sniffed)) {
    const err = new Error(`MIME type not allowed: ${sniffed}`);
    err.status = 400;
    throw err;
  }

  const maxBytes = isPublicImage ? MAX_PUBLIC_IMAGE_BYTES : MAX_PRIVATE_BYTES;
  if (parsed.buffer.length > maxBytes) {
    const err = new Error(`File exceeds size limit of ${maxBytes} bytes`);
    err.status = 400;
    throw err;
  }

  const ext = EXT_BY_MIME[sniffed] || '.bin';
  const filename = randomName(ext);

  let absDir;
  let relPath;
  if (isPublicImage) {
    absDir = path.join(PUBLIC_UPLOAD_ROOT, 'fields');
    ensureDir(absDir);
    relPath = path.join('uploads', 'public', 'fields', filename).replace(/\\/g, '/');
  } else if (kind === 'verification') {
    absDir = path.join(PRIVATE_ROOT, 'verification');
    ensureDir(absDir);
    relPath = path.join('storage', 'private', 'verification', filename).replace(/\\/g, '/');
  } else {
    absDir = path.join(PRIVATE_ROOT, 'field-docs');
    ensureDir(absDir);
    relPath = path.join('storage', 'private', 'field-docs', filename).replace(/\\/g, '/');
  }

  const absFile = path.join(absDir, filename);
  fs.writeFileSync(absFile, parsed.buffer);

  const publicUrl = isPublicImage ? `/${relPath}` : null;
  return {
    storagePath: relPath,
    mimeType: sniffed,
    sizeBytes: parsed.buffer.length,
    publicUrl
  };
}

function resolvePrivateAbsolutePath(storagePath) {
  if (!storagePath || typeof storagePath !== 'string') return null;
  if (storagePath.startsWith('data:')) return null;
  const normalized = storagePath.replace(/\\/g, '/');
  if (!normalized.startsWith('storage/private/')) return null;
  const abs = path.resolve(PROJECT_ROOT, normalized);
  const root = path.resolve(PRIVATE_ROOT);
  if (!abs.startsWith(root + path.sep) && abs !== root) return null;
  if (!fs.existsSync(abs)) return null;
  return abs;
}

function isStoredDataUrl(storagePath) {
  return typeof storagePath === 'string' && storagePath.trim().toLowerCase().startsWith('data:');
}

module.exports = {
  PROJECT_ROOT,
  PRIVATE_ROOT,
  PUBLIC_UPLOAD_ROOT,
  persistIncomingFile,
  resolvePrivateAbsolutePath,
  isDataUrl,
  isStoredDataUrl,
  sniffMime,
  parseDataUrl,
  isForbiddenActiveContent,
  ALLOWED_DOC_MIME,
  ALLOWED_PUBLIC_IMAGE_MIME,
  MAX_PRIVATE_BYTES,
  MAX_PUBLIC_IMAGE_BYTES,
  ensureDir
};
