// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { issueSession } from '~/lib/auth/session';
import { prisma } from '~/lib/prisma';
import { GET as getTeams } from '../team/route';
import { GET as getInvitations } from './invitation/route';
import { PUT as putUser } from './route';

const CSRF = 'csrf-value';

beforeEach(async () => {
  await prisma.user.deleteMany();
});

async function signedIn() {
  const user = await prisma.user.create({ data: { email: 'ada@example.com', firstName: 'Ada' } });
  return { user, token: (await issueSession(user, 'oauth_consumer')).token };
}

const request = (url: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) =>
  new NextRequest(`http://localhost${url}`, {
    method: init.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...init.headers },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });

describe('PUT /api/v1/user', () => {
  it('updates the caller and returns the enveloped user DTO', async () => {
    const { user, token } = await signedIn();
    const res = await putUser(
      request('/api/v1/user', {
        method: 'PUT',
        headers: { authorization: `Bearer ${token}` },
        body: { user: { last_name: 'Lovelace', timezone: 'Europe/London' } },
      }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      user: { id: user.id, first_name: 'Ada', last_name: 'Lovelace', timezone: 'Europe/London' },
    });
  });

  it('requires X-CSRF-Token when authenticated by the session cookie', async () => {
    const { token } = await signedIn();
    const cookie = `zx_session=${token}; zx_csrf=${CSRF}`;
    const body = { user: { first_name: 'Augusta' } };
    expect((await putUser(request('/api/v1/user', { method: 'PUT', headers: { cookie }, body }))).status).toBe(403);
    const ok = await putUser(request('/api/v1/user', { method: 'PUT', headers: { cookie, 'x-csrf-token': CSRF }, body }));
    expect(ok.status).toBe(200);
    await expect(ok.json()).resolves.toMatchObject({ user: { first_name: 'Augusta' } });
  });

  it('refuses an email change with 422', async () => {
    const { token } = await signedIn();
    const res = await putUser(
      request('/api/v1/user', {
        method: 'PUT',
        headers: { authorization: `Bearer ${token}` },
        body: { user: { email: 'x@y.z' } },
      }),
    );
    expect(res.status).toBe(422);
  });

  it('401s without credentials', async () => {
    expect((await putUser(request('/api/v1/user', { method: 'PUT', body: { user: {} } }))).status).toBe(401);
  });
});

describe('GET /api/v1/team and /api/v1/user/invitation', () => {
  it('return empty lists to a signed-in caller', async () => {
    const { token } = await signedIn();
    const headers = { authorization: `Bearer ${token}` };
    await expect((await getTeams(request('/api/v1/team', { headers }))).json()).resolves.toEqual({ teams: [] });
    await expect((await getInvitations(request('/api/v1/user/invitation', { headers }))).json()).resolves.toEqual({
      invitations: [],
    });
  });

  it('401 an anonymous caller', async () => {
    expect((await getTeams(request('/api/v1/team'))).status).toBe(401);
    expect((await getInvitations(request('/api/v1/user/invitation'))).status).toBe(401);
  });
});
