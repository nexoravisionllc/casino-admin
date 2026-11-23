import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db.js';

/**
 * Signed HS256 JWT access tokens for admins and agents. Claims, issuer,
 * audience and key match the C# JwtTokenService, so tokens issued by either
 * backend are accepted by the other.
 */
export function createToken(partner) {
  const { key, issuer, audience, expiresHours } = config.jwt;
  return jwt.sign(
    {
      sub: String(partner.uid),
      unique_name: partner.loginId,
      name: partner.name,
      role: String(partner.role),
      jti: crypto.randomUUID(),
    },
    key,
    { algorithm: 'HS256', issuer, audience, expiresIn: expiresHours * 3600, noTimestamp: true });
}

/** Rejects requests without a valid bearer token with an empty 401. */
export function requireAuth(req, res, next) {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(req.get('authorization') ?? '');
  if (!match) {
    res.set('WWW-Authenticate', 'Bearer');
    return res.status(401).end();
  }
  try {
    const { key, issuer, audience } = config.jwt;
    // ASP.NET's default 5-minute clock skew.
    req.user = jwt.verify(match[1], key, { algorithms: ['HS256'], issuer, audience, clockTolerance: 300 });
    if (req.user.exp == null) throw new Error('Token has no expiration.');
  } catch {
    res.set('WWW-Authenticate', 'Bearer error="invalid_token"');
    return res.status(401).end();
  }
  // Demo mode: agents (anyone but the top admin) can look but not change anything.
  if (isReadOnly(req.user) && !['GET', 'HEAD', 'OPTIONS'].includes(req.method))
    return res.status(403).json({ message: 'This is a demo: actions are disabled for agent accounts.' });
  next();
}

/** True when DEV_MODE is on and the token belongs to an agent rather than the top admin (role 1). */
export const isReadOnly = (user) => config.devMode && String(user?.role) !== '1';

/** Uid of the signed-in partner (the token's "sub"), or 0. */
export function currentPartnerId(req) {
  const id = Number(req.user?.sub);
  return Number.isSafeInteger(id) ? id : 0;
}

/** LoginId of the signed-in partner, or null. Pass a transaction's query to read inside it. */
export async function currentManagerLogin(req, query = db.query) {
  const [row] = await query('SELECT LoginId FROM Partners WHERE Uid = :id', { id: currentPartnerId(req) });
  return row?.LoginId ?? null;
}
