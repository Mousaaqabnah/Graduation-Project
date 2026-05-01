const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'chat');
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
const MAX_SIZE = 8 * 1024 * 1024; // 8MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_ROOT),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '';
    const safe = `${Date.now()}_${Math.random().toString(36).slice(2, 12)}${ext}`;
    cb(null, safe);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    const mt = String(file.mimetype || '').toLowerCase();
    if (ALLOWED_MIME.has(mt)) return cb(null, true);
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

router.post('/attachment', authenticate, (req, res) => {
  if (denyChatForUnverifiedOwner(req, res)) return;

  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.message || 'Upload failed';
      return res.status(400).json({ error: msg });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const publicUrl = `/uploads/chat/${req.file.filename}`;
    res.status(201).json({
      url: publicUrl,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname || req.file.filename,
      size: req.file.size
    });
  });
});

module.exports = router;
