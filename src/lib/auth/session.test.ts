// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
import { decodeJwt, SignJWT } from 'jose';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '~/lib/apiErrors';
import { authenticate, issueSession } from '~/lib/auth/session';
import { prisma } from '~/lib/prisma';

const request = (authorization?: string) =>
  new Request('http://localhost/api/v1/user', { headers: authorization ? { authorization } : {} });

async function expectDetail(promise: Promise<unknown>, status: number, detail: string) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ status, detail });
}

beforeEach(async () => {
  await prisma.user.deleteMany();
});

async function signedIn() {
  const user = await prisma.user.create({ data: { email: 'grace@example.com' } });
  return { user, session: await issueSession(user, 'oauth_consumer') };
}

describe('issueSession', () => {
  it('signs the server-framework claim set with jti = session_key', async () => {
    const { user, session } = await signedIn();
    const claims = decodeJwt(session.token);
    expect(claims).toMatchObject({ sub: user.id, jti: session.sessionKey, aud: 'zephyrex', iss: 'zephyrex' });
    expect(claims.email).toBe('grace@example.com');
    expect(claims.timezone).toBe('UTC');
    expect((claims.exp ?? 0) - (claims.iat ?? 0)).toBe(24 * 60 * 60);
    expect(claims.nbf).toBeDefined();
  });
});

describe('authenticate', () => {
  it('resolves a Bearer token to its user', async () => {
    const { user, session } = await signedIn();
    await expect(authenticate(request(`Bearer ${session.token}`))).resolves.toMatchObject({ id: user.id });
  });

  it('401s with the server-framework messages', async () => {
    const { session } = await signedIn();
    await expectDetail(authenticate(request()), 401, 'No authentication provided.');
    await expectDetail(authenticate(request(session.token)), 401, 'Unsupported authorization method; use a Bearer token');
    await expectDetail(authenticate(request('Bearer not-a-jwt')), 401, 'Invalid token');
  });

  it('rejects an expired token', async () => {
    const { user, session } = await signedIn();
    const expired = await new SignJWT({ email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setJti(session.sessionKey)
      .setIssuer('zephyrex')
      .setAudience('zephyrex')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setNotBefore(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));
    await expectDetail(authenticate(request(`Bearer ${expired}`)), 401, 'Token has expired');
  });

  it('rejects a token for another audience', async () => {
    const { user, session } = await signedIn();
    const foreign = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setJti(session.sessionKey)
      .setIssuer('zephyrex')
      .setAudience('someone-else')
      .setIssuedAt()
      .setNotBefore('0s')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));
    await expectDetail(authenticate(request(`Bearer ${foreign}`)), 401, 'Invalid token');
  });

  it('rejects a revoked session immediately', async () => {
    const { session } = await signedIn();
    await prisma.session.update({ where: { id: session.sessionKey }, data: { revoked: true } });
    await expectDetail(authenticate(request(`Bearer ${session.token}`)), 401, 'Session has been revoked');
  });

  it('403s a disabled account', async () => {
    const { user, session } = await signedIn();
    await prisma.user.update({ where: { id: user.id }, data: { active: false } });
    await expectDetail(authenticate(request(`Bearer ${session.token}`)), 403, 'User account is disabled');
  });
});
