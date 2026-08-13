'use strict';

const crypto = require('crypto');
const { isUuid } = require('../ids');

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf'
};

function safeId(value, fallback) {
  const s = String(value || '').trim();
  if (isUuid(s)) return s;
  if (/^[a-zA-Z0-9_-]{8,64}$/.test(s)) return s;
  return fallback || 'unscoped';
}

function extForMime(mime) {
  return EXT_BY_MIME[String(mime || '').toLowerCase()] || '.bin';
}

function randomObjectName(mime) {
  return `${crypto.randomUUID()}${extForMime(mime)}`;
}

/**
 * Server-controlled object keys. Never use original filenames.
 */
function buildObjectKey(kind, mime, ctx) {
  const name = randomObjectName(mime);
  const fieldId = safeId(ctx && ctx.fieldId);
  const userId = safeId(ctx && (ctx.userId || ctx.ownerId));
  const ownerId = safeId(ctx && ctx.ownerId, userId);

  switch (kind) {
    case 'public-image':
      if (ctx && ctx.purpose === 'avatar') {
        return `avatars/${userId}/${name}`;
      }
      return `fields/${fieldId}/gallery/${name}`;
    case 'verification': {
      const side = ctx && ctx.docSubtype === 'ID_BACK' ? 'back' : 'front';
      return `owners/${ownerId}/identity/${side}/${name}`;
    }
    case 'field-doc': {
      const doc =
        ctx && (ctx.docType === 'BUSINESS_LICENSE' || ctx.docSubtype === 'license')
          ? 'license'
          : 'ownership';
      return `fields/${fieldId}/documents/${doc}/${name}`;
    }
    default: {
      const err = new Error('Unknown storage kind');
      err.status = 400;
      throw err;
    }
  }
}

function assertSafeObjectKey(key) {
  const k = String(key || '').replace(/\\/g, '/');
  if (!k || k.length > 500) {
    const err = new Error('Invalid object key');
    err.status = 400;
    throw err;
  }
  if (k.includes('..') || k.startsWith('/') || k.includes('\\') || k.includes('\0')) {
    const err = new Error('Path traversal is not allowed');
    err.status = 400;
    throw err;
  }
  if (!/^[a-zA-Z0-9/_.-]+$/.test(k)) {
    const err = new Error('Invalid object key characters');
    err.status = 400;
    throw err;
  }
  return k;
}

function classifyVisibility(kind) {
  return kind === 'public-image' ? 'public' : 'private';
}

module.exports = {
  EXT_BY_MIME,
  extForMime,
  randomObjectName,
  buildObjectKey,
  assertSafeObjectKey,
  classifyVisibility
};
