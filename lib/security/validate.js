/**
 * Shared express-validator helpers (S6).
 */
const { param, query, body, validationResult } = require('express-validator');
const { isUuid } = require('../ids');

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Validation failed', errors: errors.array() });
    return false;
  }
  return true;
}

const uuidParam = (name = 'id') =>
  param(name).custom((v) => {
    if (!isUuid(String(v || '').trim())) throw new Error(`Invalid ${name}`);
    return true;
  });

const paginationQuery = [
  query('page').optional().isInt({ min: 1, max: 100000 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
];

const strongPassword = body('password')
  .isLength({ min: 8, max: 128 })
  .withMessage('Password must be 8–128 characters')
  .matches(/[A-Za-z]/)
  .withMessage('Password must include a letter')
  .matches(/[0-9]/)
  .withMessage('Password must include a number');

const strongNewPassword = body('newPassword')
  .isLength({ min: 8, max: 128 })
  .withMessage('Password must be 8–128 characters')
  .matches(/[A-Za-z]/)
  .withMessage('Password must include a letter')
  .matches(/[0-9]/)
  .withMessage('Password must include a number');

/** Strip unknown keys from an object using an allowlist */
function pick(obj, keys) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined) {
      out[k] = obj[k];
    }
  }
  return out;
}

module.exports = {
  handleValidation,
  uuidParam,
  paginationQuery,
  strongPassword,
  strongNewPassword,
  pick
};
