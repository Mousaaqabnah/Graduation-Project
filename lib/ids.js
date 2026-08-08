const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

function isMongoObjectIdString(value) {
  // Kept for transitional validation rejection messaging only.
  return typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value.trim());
}

module.exports = { isUuid, isMongoObjectIdString, UUID_RE };
