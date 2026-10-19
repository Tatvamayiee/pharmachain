// ---------------------------------------------------------------------------
// Request context middleware: request IDs + a one-line access log per request.
//
// - Generates an ID per request (crypto.randomUUID) OR trusts an incoming
//   x-request-id header (load balancers often supply one; length-capped and
//   sanitized before use).
// - Echoes it back as the x-request-id response header so clients/support can
//   quote it.
// - Logs one concise line per request: method, path, status, duration, and the
//   id. Errors still get their full stack from the error handler; this line is
//   the correlation anchor.
// Purely additive: no existing response body or behavior changes.
// ---------------------------------------------------------------------------

const crypto = require('crypto');

/** Sanitize a client-supplied request id: cap length, strip unsafe chars. */
function sanitizeId(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9_.-]/g, '')
    .slice(0, 64);
}

function requestContext(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const id = incoming ? sanitizeId(incoming) : crypto.randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const line = `[req:${id}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms.toFixed(0)}ms)`;
    if (res.statusCode >= 500) console.error(line);
    else console.log(line);
  });

  next();
}

module.exports = { requestContext };
