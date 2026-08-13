'use strict';

const { createClient } = require('@supabase/supabase-js');
const { sniffMime, isForbiddenActiveContent, parseDataUrl, ALLOWED_DOC_MIME, ALLOWED_PUBLIC_IMAGE_MIME, MAX_PRIVATE_BYTES, MAX_PUBLIC_IMAGE_BYTES } = require('../secureStorage');
const { buildObjectKey, assertSafeObjectKey, classifyVisibility } = require('./keys');
const { encodeSupabaseRef, parseSupabaseRef, isExternalHttpUrl } = require('./refs');

let _client = null;
let _cfg = null;

function attachConfig(cfg) {
  _cfg = cfg;
  _client = null;
}

function getClient() {
  if (!_cfg) {
    const err = new Error('Supabase storage is not configured');
    err.code = 'STORAGE_CONFIG';
    throw err;
  }
  if (!_client) {
    _client = createClient(_cfg.supabaseUrl, _cfg.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return _client;
}

function bucketForKind(kind) {
  return classifyVisibility(kind) === 'public' ? _cfg.publicBucket : _cfg.privateBucket;
}

function publicObjectUrl(bucket, objectKey) {
  const base = String(_cfg.supabaseUrl).replace(/\/+$/, '');
  return `${base}/storage/v1/object/public/${bucket}/${objectKey}`;
}

async function putIncoming(input, opts) {
  const kind = opts && opts.kind;
  if (input == null || input === '') return null;
  const trimmed = String(input).trim();

  if (isExternalHttpUrl(trimmed) && kind === 'public-image' && trimmed.length < 2000) {
    return {
      storagePath: trimmed,
      mimeType: 'image/jpeg',
      sizeBytes: 0,
      publicUrl: trimmed
    };
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

  const isPublic = kind === 'public-image';
  const allow = isPublic ? ALLOWED_PUBLIC_IMAGE_MIME : ALLOWED_DOC_MIME;
  if (!allow.has(sniffed)) {
    const err = new Error(`MIME type not allowed: ${sniffed}`);
    err.status = 400;
    throw err;
  }

  const maxBytes = isPublic ? MAX_PUBLIC_IMAGE_BYTES : MAX_PRIVATE_BYTES;
  if (parsed.buffer.length > maxBytes) {
    const err = new Error(`File exceeds size limit of ${maxBytes} bytes`);
    err.status = 400;
    throw err;
  }

  const bucket = bucketForKind(kind);
  const objectKey = assertSafeObjectKey(buildObjectKey(kind, sniffed, opts || {}));
  const client = getClient();
  const { error } = await client.storage.from(bucket).upload(objectKey, parsed.buffer, {
    contentType: sniffed,
    upsert: false
  });
  if (error) {
    const err = new Error('Storage upload failed');
    err.status = 502;
    err.cause = error;
    throw err;
  }

  const ref = encodeSupabaseRef(bucket, objectKey);
  return {
    storagePath: ref,
    mimeType: sniffed,
    sizeBytes: parsed.buffer.length,
    publicUrl: isPublic ? publicObjectUrl(bucket, objectKey) : null
  };
}

function publicUrl(storagePath) {
  const parsed = parseSupabaseRef(storagePath);
  if (!parsed) {
    if (isExternalHttpUrl(storagePath)) return storagePath;
    return null;
  }
  if (parsed.bucket !== _cfg.publicBucket) return null;
  return publicObjectUrl(parsed.bucket, parsed.objectKey);
}

async function openPrivate(storagePath) {
  const parsed = parseSupabaseRef(storagePath);
  if (!parsed) return null;
  if (parsed.bucket !== _cfg.privateBucket) return null;
  assertSafeObjectKey(parsed.objectKey);
  const client = getClient();
  const { data, error } = await client.storage.from(parsed.bucket).download(parsed.objectKey);
  if (error || !data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  const { Readable } = require('stream');
  return {
    stream: Readable.from(buf),
    mimeType: data.type || null
  };
}

async function createSignedUrl(storagePath) {
  const parsed = parseSupabaseRef(storagePath);
  if (!parsed) return null;
  assertSafeObjectKey(parsed.objectKey);
  const client = getClient();
  const { data, error } = await client.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.objectKey, _cfg.signedTtlSeconds);
  if (error || !data || !data.signedUrl) return null;
  return { url: data.signedUrl, expiresIn: _cfg.signedTtlSeconds };
}

async function removeIfManaged(storagePath) {
  const parsed = parseSupabaseRef(storagePath);
  if (!parsed) return false;
  if (parsed.bucket !== _cfg.publicBucket && parsed.bucket !== _cfg.privateBucket) return false;
  assertSafeObjectKey(parsed.objectKey);
  const client = getClient();
  const { error } = await client.storage.from(parsed.bucket).remove([parsed.objectKey]);
  return !error;
}

async function objectExists(storagePath) {
  const parsed = parseSupabaseRef(storagePath);
  if (!parsed) return false;
  const client = getClient();
  const dir = parsed.objectKey.includes('/')
    ? parsed.objectKey.slice(0, parsed.objectKey.lastIndexOf('/'))
    : '';
  const name = parsed.objectKey.slice(parsed.objectKey.lastIndexOf('/') + 1);
  const { data, error } = await client.storage.from(parsed.bucket).list(dir, { search: name });
  if (error || !Array.isArray(data)) return false;
  return data.some((row) => row && row.name === name);
}

module.exports = {
  name: 'supabase',
  attachConfig,
  putIncoming,
  publicUrl,
  openPrivate,
  createSignedUrl,
  removeIfManaged,
  objectExists
};
