// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Sessions and session JWTs, matching server-framework: HS256 tokens with
 * aud/iss "zephyrex", `jti` = the session row id (session_key), 24h expiry and
 * 30s clock leeway. Every request re-checks the session row, so revocation is
 * immediate rather than waiting out the token's expiry.
 */
import type { User } from '@prisma/client';
import { errors, jwtVerify, SignJWT } from 'jose';
import { ApiError } from '~/lib/apiErrors';
import { constantTimeEqual } from '~/lib/auth/crypto';
import { CSRF_COOKIE, CSRF_HEADER, parseCookies, SAFE_METHODS, SESSION_COOKIE } from '~/lib/auth/sessionCookies';
import { requireEnv } from '~/lib/env';
import { prisma } from '~/lib/prisma';

const JWT_ALGORITHM = 'HS256';
const JWT_AUDIENCE = 'zephyrex';
const JWT_ISSUER = 'zephyrex';
const JWT_TTL = '24h';
const CLOCK_TOLERANCE_SECONDS = 30;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_TIMEZONE = 'UTC';
const BEARER_PREFIX = 'Bearer ';

export interface IssuedSession {
  sessionKey: string;
  userId: string;
  grantType: string;
  expiresAt: Date;
  token: string;
}

function signingKey(): Uint8Array {
  return new TextEncoder().encode(requireEnv('JWT_SECRET'));
}

export async function issueSession(
  user: Pick<User, 'id' | 'email' | 'timezone'>,
  grantType: string,
): Promise<IssuedSession> {
  const session = await prisma.session.create({
    data: { userId: user.id, grantType, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
  const token = await new SignJWT({ email: user.email, timezone: user.timezone ?? DEFAULT_TIMEZONE })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setSubject(user.id)
    .setJti(session.id)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setNotBefore('0s')
    .setExpirationTime(JWT_TTL)
    .sign(signingKey());
  return { sessionKey: session.id, userId: user.id, grantType, expiresAt: session.expiresAt, token };
}

async function verifyToken(token: string): Promise<{ sub: string; jti: string }> {
  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      requiredClaims: ['sub', 'jti', 'exp', 'nbf', 'iat'],
    });
    return { sub: payload.sub ?? '', jti: payload.jti ?? '' };
  } catch (error) {
    if (error instanceof errors.JWTExpired) throw new ApiError(401, 'Token has expired');
    if (error instanceof errors.JOSEError) throw new ApiError(401, 'Invalid token');
    throw error;
  }
}

/**
 * The request's session JWT, in server-framework's precedence: an explicit
 * `Authorization` header, then `X-API-Key`, then the `zx_session` cookie. The
 * cookie counts only when neither header is present (a bad explicit header is
 * never rescued by it), and a cookie-authenticated unsafe request must echo
 * `zx_csrf` in `X-CSRF-Token` (checked before the token, as the server does).
 */
function presentedToken(request: Request): string {
  const header = request.headers.get('authorization');
  if (header) {
    if (!header.startsWith(BEARER_PREFIX)) {
      throw new ApiError(401, 'Unsupported authorization method; use a Bearer token');
    }
    return header.slice(BEARER_PREFIX.length);
  }
  // This app issues no API keys, so any presented key is invalid.
  if (request.headers.has('x-api-key')) throw new ApiError(401, 'Invalid API key');

  const cookies = parseCookies(request.headers.get('cookie'));
  const token = cookies.get(SESSION_COOKIE);
  if (!token) throw new ApiError(401, 'No authentication provided.');
  if (!SAFE_METHODS.has(request.method)) {
    const expected = cookies.get(CSRF_COOKIE) ?? '';
    const offered = request.headers.get(CSRF_HEADER) ?? '';
    if (!expected || !constantTimeEqual(expected, offered)) throw new ApiError(403, 'CSRF token missing or invalid');
  }
  return token;
}

/** Resolves the request's credentials to its active user and live session. */
export async function authenticateSession(request: Request): Promise<{ user: User; sessionKey: string }> {
  const { sub, jti } = await verifyToken(presentedToken(request));
  const session = await prisma.session.findUnique({ where: { id: jti }, include: { user: true } });
  if (!session || session.revoked || session.expiresAt <= new Date() || session.userId !== sub) {
    throw new ApiError(401, 'Session has been revoked');
  }
  if (!session.user.active) throw new ApiError(403, 'User account is disabled');
  return { user: session.user, sessionKey: session.id };
}

export async function authenticate(request: Request): Promise<User> {
  return (await authenticateSession(request)).user;
}

/** Ends a session: later requests carrying its JWT get 401. */
export async function revokeSession(sessionKey: string): Promise<void> {
  await prisma.session.update({ where: { id: sessionKey }, data: { revoked: true } });
}
