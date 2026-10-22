const { IS_DEV, JWT_EXPIRES_IN } = require('../config/env.cjs');

const COOKIE_NAME = 'pc_session';
const durationMatch = /^(\d+)(s|m|h|d)$/i.exec(JWT_EXPIRES_IN);
const durationUnits = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
const maxAge = durationMatch
  ? Number(durationMatch[1]) * durationUnits[durationMatch[2].toLowerCase()]
  : 7 * 86_400_000;

const cookieOptions = {
  httpOnly: true,
  secure: !IS_DEV,
  sameSite: IS_DEV ? 'lax' : 'none',
  path: '/',
  maxAge,
};

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, cookieOptions);
}

function clearSessionCookie(res) {
  const { maxAge: _maxAge, ...clearOptions } = cookieOptions;
  res.clearCookie(COOKIE_NAME, clearOptions);
}

function sessionToken(req) {
  const cookieHeader = req.headers.cookie || '';
  const sessionCookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  return sessionCookie ? sessionCookie.slice(COOKIE_NAME.length + 1) : null;
}

module.exports = { setSessionCookie, clearSessionCookie, sessionToken };
