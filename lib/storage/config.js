'use strict';

const { isProduction } = require('../security/env');

const DEFAULT_PUBLIC_BUCKET = 'matchfield-public';
const DEFAULT_PRIVATE_BUCKET = 'matchfield-private';
const DEFAULT_SIGNED_TTL = 120;

function readProvider() {
  const raw = String(process.env.STORAGE_PROVIDER || '').trim().toLowerCase();
  if (raw === 'local' || raw === 'supabase') return raw;
  if (raw) {
    const err = new Error(`Invalid STORAGE_PROVIDER "${raw}". Use local or supabase.`);
    err.code = 'STORAGE_CONFIG';
    throw err;
  }
  return isProduction() ? 'supabase' : 'local';
}

function readStorageConfig() {
  const provider = readProvider();
  const publicBucket = String(process.env.SUPABASE_PUBLIC_BUCKET || DEFAULT_PUBLIC_BUCKET).trim();
  const privateBucket = String(process.env.SUPABASE_PRIVATE_BUCKET || DEFAULT_PRIVATE_BUCKET).trim();
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const signedTtl = Number(process.env.SIGNED_URL_TTL_SECONDS) || DEFAULT_SIGNED_TTL;

  if (provider === 'supabase') {
    const missing = [];
    if (!supabaseUrl) missing.push('SUPABASE_URL');
    if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (missing.length) {
      const err = new Error(
        `STORAGE_PROVIDER=supabase requires ${missing.join(', ')}. Refusing to use local filesystem.`
      );
      err.code = 'STORAGE_CONFIG';
      throw err;
    }
  }

  if (isProduction() && provider === 'local' && String(process.env.STORAGE_PROVIDER || '').trim() !== 'local') {
    const err = new Error(
      'Production defaults to STORAGE_PROVIDER=supabase. Set STORAGE_PROVIDER=local explicitly to use disk.'
    );
    err.code = 'STORAGE_CONFIG';
    throw err;
  }

  return {
    provider,
    publicBucket,
    privateBucket,
    supabaseUrl,
    serviceRoleKey,
    signedTtlSeconds: Math.min(600, Math.max(30, signedTtl))
  };
}

function validateStorageConfigOrExit() {
  try {
    readStorageConfig();
  } catch (err) {
    if (err && err.code === 'STORAGE_CONFIG') {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }
}

module.exports = {
  DEFAULT_PUBLIC_BUCKET,
  DEFAULT_PRIVATE_BUCKET,
  DEFAULT_SIGNED_TTL,
  readProvider,
  readStorageConfig,
  validateStorageConfigOrExit
};
