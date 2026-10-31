// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { authenticate, issueSession } from '~/lib/auth/session';
import { prisma } from '~/lib/prisma';
import { POST as logout } from './route.lite';

const CSRF = 'csrf-value';

beforeEach(async () => {
  await prisma.user.deleteMany();
});

async function signedIn() {
  const user = await prisma.user.create({ data: { email: 'ada@example.com' } });
  return issueSession(user, 'oauth_consumer');
}

const logoutRequest = (headers: Record<string, string>) =>
  new NextRequest('https://app.test/api/v1/user/logout', { method: 'POST', headers });

describe('POST /api/v1/user/logout', () => {
  it('revokes a cookie session (with X-CSRF-Token), clears both cookies and returns 204', async () => {
    const { token } = await signedIn();
    const cookie = `zx_session=${token}; zx_csrf=${CSRF}`;

    const res = await logout(logoutRequest({ cookie, 'x-csrf-token': CSRF }));

    expect(res.status).toBe(204);
    expect(res.cookies.get('zx_session')).toMatchObject({ value: '', maxAge: 0 });
    expect(res.cookies.get('zx_csrf')).toMatchObject({ value: '', maxAge: 0 });
    const reuse = await authenticate(new Request('https://app.test/api/v1/user', { headers: { cookie } })).catch(
      (e: unknown) => e,
    );
    expect(reuse).toMatchObject({ status: 401, detail: 'Session has been revoked' });
  });

  it('refuses a cookie logout without the CSRF header (403)', async () => {
    const { token } = await signedIn();
    const res = await logout(logoutRequest({ cookie: `zx_session=${token}; zx_csrf=${CSRF}` }));
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ detail: 'CSRF token missing or invalid' });
  });

  it('revokes a Bearer session too', async () => {
    const { token } = await signedIn();
    expect((await logout(logoutRequest({ authorization: `Bearer ${token}` }))).status).toBe(204);
    expect((await logout(logoutRequest({ authorization: `Bearer ${token}` }))).status).toBe(401);
  });

  it('401s without credentials', async () => {
    const res = await logout(logoutRequest({}));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ detail: 'No authentication provided.' });
  });
});
