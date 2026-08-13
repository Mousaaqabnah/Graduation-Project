'use strict';

const SB_PREFIX = 'sb://';

function isSupabaseRef(value) {
  return typeof value === 'string' && value.startsWith(SB_PREFIX);
}

function encodeSupabaseRef(bucket, objectKey) {
  return `${SB_PREFIX}${bucket}/${String(objectKey).replace(/^\/+/, '')}`;
}

function parseSupabaseRef(value) {
  if (!isSupabaseRef(value)) return null;
  const rest = value.slice(SB_PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  return {
    bucket: rest.slice(0, slash),
    objectKey: rest.slice(slash + 1)
  };
}

function isManagedLocalPath(value) {
  if (typeof value !== 'string') return false;
  const n = value.replace(/\\/g, '/');
  return n.startsWith('storage/private/') || n.startsWith('uploads/public/');
}

function isExternalHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function isDataUrl(value) {
  return typeof value === 'string' && value.trim().toLowerCase().startsWith('data:');
}

module.exports = {
  SB_PREFIX,
  isSupabaseRef,
  encodeSupabaseRef,
  parseSupabaseRef,
  isManagedLocalPath,
  isExternalHttpUrl,
  isDataUrl
};
