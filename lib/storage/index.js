'use strict';

const { readStorageConfig } = require('./config');
const localProvider = require('./localProvider');
const supabaseProvider = require('./supabaseProvider');
const { isSupabaseRef, isManagedLocalPath, isExternalHttpUrl, isDataUrl } = require('./refs');

let _provider = null;
let _cfg = null;

function getConfig() {
  if (!_cfg) _cfg = readStorageConfig();
  return _cfg;
}

function getProvider() {
  if (_provider) return _provider;
  const cfg = getConfig();
  if (cfg.provider === 'supabase') {
    supabaseProvider.attachConfig(cfg);
    _provider = supabaseProvider;
  } else {
    _provider = localProvider;
  }
  return _provider;
}

/** Test helper — reset cached provider after env changes. */
function resetStorageCache() {
  _provider = null;
  _cfg = null;
}

async function putIncomingFile(input, opts) {
  const result = getProvider().putIncoming(input, opts || {});
  return Promise.resolve(result);
}

function resolvePublicUrl(storagePath, storedPublicUrl) {
  if (storedPublicUrl && /^https?:\/\//i.test(storedPublicUrl)) return storedPublicUrl;
  if (storedPublicUrl && storedPublicUrl.startsWith('/uploads/')) return storedPublicUrl;
  if (!storagePath) return storedPublicUrl || null;
  if (isDataUrl(storagePath)) return null;
  if (isSupabaseRef(storagePath)) {
    try {
      return getProvider().publicUrl(storagePath) || storedPublicUrl || null;
    } catch {
      return storedPublicUrl || null;
    }
  }
  if (isExternalHttpUrl(storagePath)) return storagePath;
  return localProvider.publicUrl(storagePath);
}

async function openPrivateObject(storagePath) {
  if (!storagePath || isDataUrl(storagePath)) return null;
  if (isSupabaseRef(storagePath)) {
    if (getConfig().provider !== 'supabase') return null;
    return getProvider().openPrivate(storagePath);
  }
  return localProvider.openPrivate(storagePath);
}

async function removeManagedObject(storagePath) {
  if (!storagePath) return false;
  try {
    if (isSupabaseRef(storagePath)) {
      if (getConfig().provider !== 'supabase') return false;
      return getProvider().removeIfManaged(storagePath);
    }
    if (isManagedLocalPath(storagePath)) {
      return localProvider.removeIfManaged(storagePath);
    }
  } catch {
    return false;
  }
  return false;
}

function signedUrlTtlSeconds() {
  return getConfig().signedTtlSeconds;
}

function currentProviderName() {
  return getConfig().provider;
}

module.exports = {
  getConfig,
  getProvider,
  resetStorageCache,
  putIncomingFile,
  resolvePublicUrl,
  openPrivateObject,
  removeManagedObject,
  signedUrlTtlSeconds,
  currentProviderName,
  isSupabaseRef,
  isManagedLocalPath,
  isExternalHttpUrl
};
