const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

/** Public stats (no auth) — login page marketing. */
router.get('/stats', async (req, res) => {
  try {
    const fieldCount = await prisma.field.count({
      where: { isActive: true, deletedAt: null, moderationStatus: 'APPROVED' }
    });
    res.json({ fieldCount });
  } catch (error) {
    console.error('Public stats error:', error);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

module.exports = router;
