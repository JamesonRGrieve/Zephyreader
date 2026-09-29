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

/** Resolves the request's `Authorization: Bearer <jwt>` to its active user. */
export async function authenticate(request: Request): Promise<User> {
  const header = request.headers.get('authorization');
  if (!header) throw new ApiError(401, 'No authentication provided.');
  if (!header.startsWith(BEARER_PREFIX)) {
    throw new ApiError(401, 'Unsupported authorization method; use a Bearer token');
  }

  const { sub, jti } = await verifyToken(header.slice(BEARER_PREFIX.length));
  const session = await prisma.session.findUnique({ where: { id: jti }, include: { user: true } });
  if (!session || session.revoked || session.expiresAt <= new Date() || session.userId !== sub) {
    throw new ApiError(401, 'Session has been revoked');
  }
  if (!session.user.active) throw new ApiError(403, 'User account is disabled');
  return session.user;
}
