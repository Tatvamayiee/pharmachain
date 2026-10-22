const { IS_DEV, CORS_ORIGINS } = require('../config/env.cjs');

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function trustedOrigin(req, res, next) {
  if (!MUTATING_METHODS.has(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next();
  if (
    origin === 'null'
    || (!IS_DEV || CORS_ORIGINS.length > 0) && !CORS_ORIGINS.includes(origin)
  ) {
    return res.status(403).json({ error: 'Untrusted request origin' });
  }
  return next();
}

module.exports = trustedOrigin;
