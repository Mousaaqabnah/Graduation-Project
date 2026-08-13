'use strict';

const fs = require('fs');
const {
  persistIncomingFile,
  resolvePrivateAbsolutePath,
  PUBLIC_UPLOAD_ROOT,
  PROJECT_ROOT
} = require('../secureStorage');
const path = require('path');
const { isManagedLocalPath } = require('./refs');

function putIncoming(input, opts) {
  return persistIncomingFile(input, { kind: opts.kind });
}

function publicUrl(storagePath) {
  if (!storagePath) return null;
  const n = String(storagePath).replace(/\\/g, '/');
  if (n.startsWith('uploads/public/')) return `/${n}`;
  if (n.startsWith('/uploads/public/')) return n;
  if (/^https?:\/\//i.test(n)) return n;
  return n.startsWith('/') ? n : `/${n}`;
}

function openPrivate(storagePath) {
  const abs = resolvePrivateAbsolutePath(storagePath);
  if (!abs) return null;
  return {
    stream: fs.createReadStream(abs),
    mimeType: null
  };
}

async function removeIfManaged(storagePath) {
  if (!isManagedLocalPath(storagePath)) return false;
  const n = String(storagePath).replace(/\\/g, '/');
  const abs = path.resolve(PROJECT_ROOT, n);
  const root = n.startsWith('storage/private/')
    ? path.resolve(PROJECT_ROOT, 'storage', 'private')
    : path.resolve(PUBLIC_UPLOAD_ROOT);
  if (!abs.startsWith(root + path.sep) && abs !== root) return false;
  if (!fs.existsSync(abs)) return false;
  fs.unlinkSync(abs);
  return true;
}

function objectExists(storagePath) {
  if (!isManagedLocalPath(storagePath)) return false;
  const abs = path.resolve(PROJECT_ROOT, String(storagePath).replace(/\\/g, '/'));
  return fs.existsSync(abs);
}

module.exports = {
  name: 'local',
  putIncoming,
  publicUrl,
  openPrivate,
  removeIfManaged,
  objectExists
};
