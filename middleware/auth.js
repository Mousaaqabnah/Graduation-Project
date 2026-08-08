const jwt = require('jsonwebtoken');
const { prisma } = require('../lib/prisma');

async function loadUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      fullName: true,
      role: true,
      status: true,
      sessionVersion: true,
      avatarUrl: true,
      playerCode: true,
      deletedAt: true,
      ownerProfile: {
        select: { verificationStatus: true, verifiedAt: true }
      }
    }
  });

  if (!user || user.deletedAt) return null;

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    sessionVersion: user.sessionVersion ?? 0,
    avatar: user.avatarUrl,
    avatarUrl: user.avatarUrl,
    playerCode: user.playerCode,
    verificationStatus: user.ownerProfile?.verificationStatus || null
  };
}

function attachUser(req, user) {
  req.user = user;
}

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.typ && decoded.typ !== 'access') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const user = await loadUser(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Account is suspended' });
    }
    const tokenVersion = decoded.sv != null ? Number(decoded.sv) : 0;
    if (tokenVersion !== Number(user.sessionVersion || 0)) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    attachUser(req, user);
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(500).json({ error: 'Authentication error' });
  }
};

const authenticateAllowSuspended = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await loadUser(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    const tokenVersion = decoded.sv != null ? Number(decoded.sv) : 0;
    if (tokenVersion !== Number(user.sessionVersion || 0)) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    attachUser(req, user);
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(500).json({ error: 'Authentication error' });
  }
};

const optionalAuthenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return next();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await loadUser(decoded.userId);
    if (
      user &&
      user.status === 'ACTIVE' &&
      Number(decoded.sv != null ? decoded.sv : 0) === Number(user.sessionVersion || 0)
    ) {
      attachUser(req, user);
    }
    next();
  } catch {
    next();
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const userRole = String(req.user.role || '').toUpperCase();
    const allowedRoles = roles.map((r) => String(r || '').toUpperCase());
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

const requireOwnerOrAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.role === 'ADMIN') return next();
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authorization error' });
  }
};

const requireVerifiedOwner = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const role = String(req.user.role || '').toUpperCase();
  if (role !== 'OWNER') return next();
  const verificationStatus = String(req.user.verificationStatus || '').toUpperCase();
  if (verificationStatus !== 'APPROVED') {
    return res.status(403).json({
      error: 'Owner account verification is required before using owner features'
    });
  }
  return next();
};

module.exports = {
  authenticate,
  authenticateAllowSuspended,
  optionalAuthenticate,
  requireRole,
  requireOwnerOrAdmin,
  requireVerifiedOwner,
  loadUser
};
