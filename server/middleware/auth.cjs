const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env.cjs');
const { createRepository } = require('../db/repositories/repositoryFactory.cjs');
const models = require('../db/models/index.cjs');
const userRepo = createRepository({ name: 'users', model: models.User, prefix: 'U' });

async function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  if (!payload || typeof payload.id !== 'string' || payload.id.length === 0) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  try {
    const user = await userRepo.findById(payload.id);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Account is unavailable' });
    }
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organization: user.organization || '',
    };
    return next();
  } catch (err) {
    return next(err);
  }
}

function requireRole(...roles) {
  const allowedRoles = roles.flat();
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
}

module.exports = { auth, requireRole };
