/**
 * One-off helper: extract base64/data-URL FieldDocument and VerificationDocument
 * rows into filesystem paths. Does NOT run automatically.
 *
 * Usage:
 *   node scripts/migrate-base64-documents.js --dry-run
 *   node scripts/migrate-base64-documents.js --apply
 */

require('dotenv').config();
const { prisma } = require('../lib/prisma');
const { persistIncomingFile, isStoredDataUrl } = require('../lib/secureStorage');

const apply = process.argv.includes('--apply');
const dryRun = !apply;

async function migrateFieldDocuments() {
  const docs = await prisma.fieldDocument.findMany();
  let converted = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of docs) {
    if (!isStoredDataUrl(doc.storagePath)) {
      skipped += 1;
      continue;
    }
    try {
      if (dryRun) {
        console.log(`[dry-run] FieldDocument ${doc.id} type=${doc.type} bytes≈${doc.storagePath.length}`);
        converted += 1;
        continue;
      }
      const saved = persistIncomingFile(doc.storagePath, { kind: 'field-doc' });
      await prisma.fieldDocument.update({
        where: { id: doc.id },
        data: {
          storagePath: saved.storagePath,
          mimeType: saved.mimeType,
          sizeBytes: saved.sizeBytes
        }
      });
      console.log(`[apply] FieldDocument ${doc.id} → ${saved.storagePath}`);
      converted += 1;
    } catch (err) {
      failed += 1;
      console.error(`[fail] FieldDocument ${doc.id}:`, err.message || err);
    }
  }

  return { converted, skipped, failed };
}

async function migrateVerificationDocuments() {
  const docs = await prisma.verificationDocument.findMany();
  let converted = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of docs) {
    if (!isStoredDataUrl(doc.storagePath)) {
      skipped += 1;
      continue;
    }
    try {
      if (dryRun) {
        console.log(`[dry-run] VerificationDocument ${doc.id} type=${doc.type} bytes≈${doc.storagePath.length}`);
        converted += 1;
        continue;
      }
      const saved = persistIncomingFile(doc.storagePath, { kind: 'verification' });
      await prisma.verificationDocument.update({
        where: { id: doc.id },
        data: {
          storagePath: saved.storagePath,
          mimeType: saved.mimeType,
          sizeBytes: saved.sizeBytes
        }
      });
      console.log(`[apply] VerificationDocument ${doc.id} → ${saved.storagePath}`);
      converted += 1;
    } catch (err) {
      failed += 1;
      console.error(`[fail] VerificationDocument ${doc.id}:`, err.message || err);
    }
  }

  return { converted, skipped, failed };
}

async function main() {
  console.log(dryRun ? 'DRY RUN (pass --apply to write)' : 'APPLYING migration');
  const field = await migrateFieldDocuments();
  const verification = await migrateVerificationDocuments();
  console.log('FieldDocument:', field);
  console.log('VerificationDocument:', verification);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
