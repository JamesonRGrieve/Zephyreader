// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { issueSession } from '~/lib/auth/session';
import { prisma } from '~/lib/prisma';
import { GET as getUser } from '../../user/route';
import { POST as authorize } from './authorize/route';
import { OAUTH_BINDING_COOKIE } from './bindingCookie';
import { POST as callback } from './callback/route';

const post = (url: string, body: unknown) =>
  new NextRequest(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });

beforeEach(async () => {
  await prisma.user.deleteMany();
  await prisma.oAuthState.deleteMany();
});

describe('POST /api/v1/auth/oauth/authorize', () => {
  it('returns the Google authorize URL and sets an HttpOnly, SameSite binding cookie', async () => {
    const res = await authorize(post('https://app.test/api/v1/auth/oauth/authorize', { provider: 'google' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authorize_url).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
    expect(new URL(body.authorize_url).searchParams.get('state')).toBe(body.state);

    const cookie = res.cookies.get(OAUTH_BINDING_COOKIE);
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/api/v1/auth/oauth' });
    expect(cookie?.value).not.toBe(body.state);
  });

  it('422s without a provider', async () => {
    const res = await authorize(post('https://app.test/api/v1/auth/oauth/authorize', {}));
    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toEqual({ detail: 'provider is required' });
  });
});

describe('POST /api/v1/auth/oauth/callback', () => {
  it('422s when code or state is missing', async () => {
    const res = await callback(post('https://app.test/api/v1/auth/oauth/callback', { provider: 'google', code: 'c' }));
    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toEqual({ detail: 'state is required' });
  });

  it('400s an unknown state without calling the IdP', async () => {
    const res = await callback(
      post('https://app.test/api/v1/auth/oauth/callback', { provider: 'google', code: 'c', state: 'forged' }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ detail: 'Invalid or expired OAuth state' });
  });
});

describe('GET /api/v1/user', () => {
  it('returns the enveloped server-framework user DTO with no credential fields', async () => {
    const user = await prisma.user.create({ data: { email: 'lin@example.com', firstName: 'Lin' } });
    const { token } = await issueSession(user, 'oauth_consumer');

    const res = await getUser(
      new NextRequest('https://app.test/api/v1/user', { headers: { authorization: `Bearer ${token}` } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toMatchObject({ id: user.id, email: 'lin@example.com', first_name: 'Lin', active: true });
    expect(JSON.stringify(body)).not.toMatch(/token|password|secret/i);
  });
});
