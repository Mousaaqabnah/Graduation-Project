/**
 * Migrate local MatchField files to Supabase Storage.
 *
 * Default: --dry-run (no DB writes, no local deletes, no uploads).
 * Apply only after explicit approval: node scripts/migrate-storage-to-supabase.js --apply
 *
 * Never prints service-role keys or signed URLs.
 */
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { prisma } = require('../lib/prisma');
const { isStoredDataUrl, sniffMime } = require('../lib/secureStorage');
const { readStorageConfig } = require('../lib/storage/config');
const { encodeSupabaseRef, isSupabaseRef, isManagedLocalPath, isExternalHttpUrl } = require('../lib/storage/refs');
const { assertSafeObjectKey, buildObjectKey } = require('../lib/storage/keys');

const APPLY = process.argv.includes('--apply');
const DRY = !APPLY;

function classifyRef(value) {
  if (!value || typeof value !== 'string') return 'empty';
  if (isStoredDataUrl(value)) return 'data-url';
  if (isSupabaseRef(value)) return 'already-supabase';
  if (isExternalHttpUrl(value)) return 'external-http';
  if (isManagedLocalPath(value)) return 'local-managed';
  if (value.startsWith('/uploads/public/')) return 'local-managed';
  return 'unknown';
}

function localAbs(storagePath) {
  const n = String(storagePath || '').replace(/\\/g, '/').replace(/^\//, '');
  return path.resolve(path.join(__dirname, '..'), n);
}

function countLocalFiles() {
  const roots = [
    path.join(__dirname, '..', 'storage', 'private', 'field-docs'),
    path.join(__dirname, '..', 'storage', 'private', 'verification'),
    path.join(__dirname, '..', 'uploads', 'public', 'fields')
  ];
  let total = 0;
  for (const dir of roots) {
    if (!fs.existsSync(dir)) continue;
    total += fs.readdirSync(dir).filter((f) => !f.startsWith('.')).length;
  }
  return total;
}

async function main() {
  console.log(DRY ? '=== Storage migration DRY-RUN (no mutations) ===\n' : '=== Storage migration APPLY ===\n');

  const fieldDocs = await prisma.fieldDocument.findMany({
    select: { id: true, fieldId: true, type: true, storagePath: true, mimeType: true }
  });
  const verDocs = await prisma.verificationDocument.findMany({
    select: { id: true, type: true, storagePath: true, mimeType: true, verification: { select: { ownerId: true } } }
  });
  const images = await prisma.fieldImage.findMany({
    select: { id: true, fieldId: true, storagePath: true, publicUrl: true }
  });
  const users = await prisma.user.findMany({
    select: { id: true, avatarUrl: true }
  });

  const groups = {
    fieldDocuments: summarize(fieldDocs, (d) => d.storagePath),
    verificationDocuments: summarize(verDocs, (d) => d.storagePath),
    fieldImages: summarize(images, (d) => d.storagePath || d.publicUrl),
    avatars: summarize(users, (d) => d.avatarUrl)
  };

  console.log('Reference classification:');
  console.log(JSON.stringify(groups, null, 2));
  console.log('\nLocal files on disk (not deleted):', countLocalFiles());

  const migrateCandidates = [
    ...fieldDocs.filter((d) => classifyRef(d.storagePath) === 'local-managed'),
    ...verDocs.filter((d) => classifyRef(d.storagePath) === 'local-managed'),
    ...images.filter((d) => classifyRef(d.storagePath) === 'local-managed')
  ];
  const avatarCandidates = users.filter((u) => classifyRef(u.avatarUrl) === 'data-url' || classifyRef(u.avatarUrl) === 'local-managed');

  console.log('\nWould migrate:');
  console.log('  field/verification/gallery local refs:', migrateCandidates.length);
  console.log('  avatar data-url or local refs:', avatarCandidates.length);
  console.log('  already on Supabase:', 
    fieldDocs.filter((d) => classifyRef(d.storagePath) === 'already-supabase').length +
    verDocs.filter((d) => classifyRef(d.storagePath) === 'already-supabase').length +
    images.filter((d) => classifyRef(d.storagePath) === 'already-supabase').length
  );

  if (DRY) {
    console.log('\nDry-run complete. No uploads, no DB updates, no local deletes.');
    console.log('Next (after approval): node scripts/migrate-storage-to-supabase.js --apply');
    await prisma.$disconnect();
    return;
  }

  const cfg = readStorageConfig();
  if (cfg.provider !== 'supabase') {
    throw new Error('APPLY requires STORAGE_PROVIDER=supabase and valid Supabase credentials');
  }
  const { createClient } = require('@supabase/supabase-js');
  const client = createClient(cfg.supabaseUrl, cfg.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  async function uploadLocalAndUpdate(row, kind, ctx, updateFn) {
    const abs = localAbs(row.storagePath);
    if (!fs.existsSync(abs)) {
      console.log('SKIP missing file id=', row.id);
      skipped += 1;
      return;
    }
    const buf = fs.readFileSync(abs);
    const mime = sniffMime(buf) || row.mimeType || 'application/octet-stream';
    const key = assertSafeObjectKey(buildObjectKey(kind, mime, ctx));
    const bucket = kind === 'public-image' ? cfg.publicBucket : cfg.privateBucket;
    const { error } = await client.storage.from(bucket).upload(key, buf, {
      contentType: mime,
      upsert: false
    });
    if (error && !String(error.message || '').toLowerCase().includes('already exists')) {
      console.log('FAIL upload id=', row.id);
      failed += 1;
      return;
    }
    const ref = encodeSupabaseRef(bucket, key);
    await updateFn(ref, mime, buf.length);
    uploaded += 1;
    console.log('OK id=', row.id, 'kind=', kind);
  }

  for (const d of fieldDocs) {
    if (classifyRef(d.storagePath) !== 'local-managed') continue;
    await uploadLocalAndUpdate(
      d,
      'field-doc',
      { fieldId: d.fieldId, docType: d.type },
      async (ref, mime, size) => {
        await prisma.fieldDocument.update({
          where: { id: d.id },
          data: { storagePath: ref, mimeType: mime, sizeBytes: size }
        });
      }
    );
  }

  for (const d of verDocs) {
    if (classifyRef(d.storagePath) !== 'local-managed') continue;
    await uploadLocalAndUpdate(
      d,
      'verification',
      { ownerId: d.verification && d.verification.ownerId, docSubtype: d.type },
      async (ref, mime, size) => {
        await prisma.verificationDocument.update({
          where: { id: d.id },
          data: { storagePath: ref, mimeType: mime, sizeBytes: size }
        });
      }
    );
  }

  for (const img of images) {
    if (classifyRef(img.storagePath) !== 'local-managed') continue;
    await uploadLocalAndUpdate(
      img,
      'public-image',
      { fieldId: img.fieldId, purpose: 'gallery' },
      async (ref) => {
        const publicUrl = `${String(cfg.supabaseUrl).replace(/\/+$/, '')}/storage/v1/object/public/${cfg.publicBucket}/${ref.slice(('sb://' + cfg.publicBucket + '/').length)}`;
        await prisma.fieldImage.update({
          where: { id: img.id },
          data: { storagePath: ref, publicUrl }
        });
      }
    );
  }

  console.log('\nApply summary uploaded=', uploaded, 'skipped=', skipped, 'failed=', failed);
  console.log('Local source files were NOT deleted.');
  await prisma.$disconnect();
}

function summarize(rows, pick) {
  const out = { total: rows.length, local: 0, supabase: 0, dataUrl: 0, external: 0, empty: 0, unknown: 0 };
  rows.forEach((r) => {
    const c = classifyRef(pick(r));
    if (c === 'local-managed') out.local += 1;
    else if (c === 'already-supabase') out.supabase += 1;
    else if (c === 'data-url') out.dataUrl += 1;
    else if (c === 'external-http') out.external += 1;
    else if (c === 'empty') out.empty += 1;
    else out.unknown += 1;
  });
  return out;
}

main().catch(async (e) => {
  console.error(e && e.message ? e.message : e);
  try { await prisma.$disconnect(); } catch (_) {}
  process.exit(1);
});
