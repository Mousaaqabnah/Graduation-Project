const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { isUuid } = require('../lib/ids');
const { isParticipant } = require('../lib/chatService');
const { sniffMime } = require('../lib/secureStorage');
const { createRateLimiter } = require('../lib/security/rateLimit');

const router = express.Router();

const chatUploadLimiter = createRateLimiter({
  bucket: 'chat-upload',
  windowMs: Number(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_UPLOAD_MAX) || 40,
  message: 'Too many uploads. Please try again later.'
});

const UPLOAD_ROOT = path.join(__dirname, '..', 'storage', 'private', 'chat');
try {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
} catch (_) {}

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf'
]);
const MAX_SIZE = 8 * 1024 * 1024;

const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf'
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_ROOT),
  filename: (_req, _file, cb) => {
    // Extension assigned after magic-byte verification
    const safe = `${Date.now()}_${crypto.randomBytes(12).toString('hex')}.tmp`;
    cb(null, safe);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    const mt = String(file.mimetype || '').toLowerCase();
    if (mt.includes('svg') || mt.includes('html') || mt.includes('javascript')) {
      return cb(new Error('File type not allowed'));
    }
    // Tentative allow; magic bytes verified after write
    if (ALLOWED_MIME.has(mt) || mt === 'application/octet-stream') return cb(null, true);
    cb(new Error('File type not allowed'));
  }
});

function denyChatForUnverifiedOwner(req, res) {
  if (!req.user) return false;
  const role = String(req.user.role || '').toUpperCase();
  const verificationStatus = String(req.user.verificationStatus || '').toUpperCase();
  if (role === 'OWNER' && verificationStatus !== 'APPROVED') {
    res.status(403).json({ error: 'Owner verification required to use chat' });
    return true;
  }
  return false;
}

router.post('/attachment', authenticate, chatUploadLimiter, (req, res) => {
  if (denyChatForUnverifiedOwner(req, res)) return;

  upload.single('file')(req, res, async (err) => {
    try {
      if (err) {
        return res.status(400).json({ error: err.message || 'Upload failed' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const conversationId = String(req.body.conversationId || req.query.conversationId || '').trim();
      if (!conversationId || !isUuid(conversationId)) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: 'conversationId is required' });
      }
      if (!(await isParticipant(conversationId, req.user.id))) {
        fs.unlink(req.file.path, () => {});
        return res.status(403).json({ error: 'Access denied' });
      }

      const buf = fs.readFileSync(req.file.path);
      const sniffed = sniffMime(buf);
      if (!sniffed || !ALLOWED_MIME.has(sniffed)) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: 'File content type not allowed' });
      }
      if (sniffed === 'image/svg+xml') {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: 'SVG uploads are not allowed' });
      }

      const ext = MIME_EXT[sniffed] || '.bin';
      const finalName = `${Date.now()}_${crypto.randomBytes(12).toString('hex')}${ext}`;
      const finalPath = path.join(UPLOAD_ROOT, finalName);
      fs.renameSync(req.file.path, finalPath);

      const storagePath = `storage/private/chat/${finalName}`;
      const url = `/api/messages/files/${encodeURIComponent(finalName)}?conversationId=${encodeURIComponent(conversationId)}`;

      res.status(201).json({
        url,
        storagePath,
        mimeType: sniffed,
        originalName: path.basename(String(req.file.originalname || finalName)).slice(0, 180),
        size: buf.length,
        conversationId
      });
    } catch (e) {
      console.error('Chat upload error:', e);
      if (req.file?.path) fs.unlink(req.file.path, () => {});
      res.status(500).json({ error: 'Upload failed' });
    }
  });
});

module.exports = router;
