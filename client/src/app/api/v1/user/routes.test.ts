// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { issueSession } from '~/lib/auth/session';
import { toUserDto, userEntityTag } from '~/lib/auth/userDto';
import { prisma } from '~/lib/prisma';
import { GET as getTeams } from '../team/route.lite';
import { GET as getUser, PUT as putUser } from './route.lite';

const CSRF = 'csrf-value';

beforeEach(async () => {
  await prisma.user.deleteMany();
});

async function signedIn() {
  const user = await prisma.user.create({ data: { email: 'ada@example.com', firstName: 'Ada' } });
  return { user, token: (await issueSession(user, 'oauth_consumer')).token, ifMatch: userEntityTag(toUserDto(user)) };
}

const request = (url: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) =>
  new NextRequest(`http://localhost${url}`, {
    method: init.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...init.headers },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });

describe('PUT /api/v1/user', () => {
  it('updates the caller and returns the enveloped user DTO', async () => {
    const { user, token, ifMatch } = await signedIn();
    const res = await putUser(
      request('/api/v1/user', {
        method: 'PUT',
        headers: { authorization: `Bearer ${token}`, 'if-match': ifMatch },
        body: { user: { last_name: 'Lovelace', timezone: 'Europe/London' } },
      }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      user: { id: user.id, first_name: 'Ada', last_name: 'Lovelace', timezone: 'Europe/London' },
    });
  });

  it('requires X-CSRF-Token when authenticated by the session cookie', async () => {
    const { token, ifMatch } = await signedIn();
    const cookie = `zx_session=${token}; zx_csrf=${CSRF}`;
    const body = { user: { first_name: 'Augusta' } };
    const headers = { cookie, 'if-match': ifMatch };
    expect((await putUser(request('/api/v1/user', { method: 'PUT', headers, body }))).status).toBe(403);
    const ok = await putUser(
      request('/api/v1/user', { method: 'PUT', headers: { ...headers, 'x-csrf-token': CSRF }, body }),
    );
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

describe('PUT /api/v1/user preconditions', () => {
  const put = (token: string, ifMatch: string | undefined, firstName: string) =>
    putUser(
      request('/api/v1/user', {
        method: 'PUT',
        headers: { authorization: `Bearer ${token}`, ...(ifMatch === undefined ? {} : { 'if-match': ifMatch }) },
        body: { user: { first_name: firstName } },
      }),
    );

  async function currentTag(token: string): Promise<{ tag: string; updatedAt: string }> {
    const res = await getUser(request('/api/v1/user', { headers: { authorization: `Bearer ${token}` } }));
    const body = (await res.json()) as { user: { updated_at: string } };
    return { tag: res.headers.get('etag') ?? '', updatedAt: body.user.updated_at };
  }

  it('GET sends the quoted updated_at as a strong ETag', async () => {
    const { token } = await signedIn();
    const { tag, updatedAt } = await currentTag(token);
    expect(tag).toBe(`"${updatedAt}"`);
  });

  it('saves on a current If-Match and returns the new tag', async () => {
    const { token } = await signedIn();
    const before = await currentTag(token);
    const res = await put(token, before.tag, 'Augusta');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { first_name: string; updated_at: string } };
    expect(body.user.first_name).toBe('Augusta');
    expect(body.user.updated_at).not.toBe(before.updatedAt);
    expect(res.headers.get('etag')).toBe(`"${body.user.updated_at}"`);
  });

  it('412s a stale If-Match with the current row and leaves it untouched', async () => {
    const { token } = await signedIn();
    const stale = (await currentTag(token)).tag;
    expect((await put(token, stale, 'Augusta')).status).toBe(200);
    const res = await put(token, stale, 'Countess');
    expect(res.status).toBe(412);
    await expect(res.json()).resolves.toMatchObject({
      detail: expect.any(String),
      current: { first_name: 'Augusta' },
    });
    const saved = await prisma.user.findFirstOrThrow();
    expect(saved.firstName).toBe('Augusta');
  });

  it('gives two back-to-back saves distinct tags', async () => {
    const { token } = await signedIn();
    const first = await put(token, (await currentTag(token)).tag, 'One');
    const firstTag = first.headers.get('etag') ?? '';
    const second = await put(token, firstTag, 'Two');
    expect(second.status).toBe(200);
    expect(second.headers.get('etag')).not.toBe(firstTag);
  });

  it('lets exactly one of two racing saves on the same tag win', async () => {
    const { token } = await signedIn();
    const tag = (await currentTag(token)).tag;
    const statuses = (await Promise.all([put(token, tag, 'One'), put(token, tag, 'Two')])).map((res) => res.status);
    expect(statuses.toSorted()).toEqual([200, 412]);
  });

  it('428s a save without If-Match and leaves the row untouched', async () => {
    const { token } = await signedIn();
    const res = await put(token, undefined, 'Augusta');
    expect(res.status).toBe(428);
    await expect(res.json()).resolves.toEqual({ detail: 'If-Match required' });
    expect((await prisma.user.findFirstOrThrow()).firstName).toBe('Ada');
  });

  it('accepts If-Match: *', async () => {
    const { token } = await signedIn();
    expect((await put(token, '*', 'Augusta')).status).toBe(200);
  });
});

describe('GET /api/v1/team', () => {
  it('returns an empty list to a signed-in caller', async () => {
    const { token } = await signedIn();
    const headers = { authorization: `Bearer ${token}` };
    await expect((await getTeams(request('/api/v1/team', { headers }))).json()).resolves.toEqual({ teams: [] });
  });

  it('401s an anonymous caller', async () => {
    expect((await getTeams(request('/api/v1/team'))).status).toBe(401);
  });
});
