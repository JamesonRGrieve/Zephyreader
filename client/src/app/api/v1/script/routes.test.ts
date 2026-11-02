// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The lite records against a real database, answering as server-framework answers
 * (the same cases as server/extensions/teleprompter/EP_Teleprompter_test.py): word
 * count kept by the server, list pagination, `_links`, 428 without If-Match, a W/ tag
 * accepted, 412 with the current record, another user's record 404, validation 422,
 * team sharing 402, delete 204, folders of one's own, one settings record per user.
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { issueSession } from '~/lib/auth/session';
import { prisma } from '~/lib/prisma';
import { GET as getPreferences, POST as postPreference } from '../prompter_preference/route.lite';
import { POST as postFolder } from '../script_folder/route.lite';
import { DELETE as deleteScript, GET as getScript, PUT as putScript } from './[id]/route.lite';
import { GET as listScripts, POST as postScript } from './route.lite';

beforeEach(async () => {
  await prisma.script.deleteMany();
  await prisma.scriptFolder.deleteMany();
  await prisma.prompterPreference.deleteMany();
  await prisma.user.deleteMany();
});

async function signedIn(email: string): Promise<Record<string, string>> {
  const user = await prisma.user.create({ data: { email } });
  return { authorization: `Bearer ${(await issueSession(user, 'oauth_consumer')).token}` };
}

function call(path: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) {
  return new NextRequest(`http://localhost/api${path}`, {
    method: init.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...init.headers },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const noParams = { params: Promise.resolve({}) };

async function createScript(headers: Record<string, string>, script: Record<string, unknown>) {
  const response = await postScript(call('/v1/script', { method: 'POST', headers, body: { script } }), noParams);
  expect(response.status).toBe(201);
  return { body: (await response.json()) as { script: Record<string, unknown> }, etag: response.headers.get('etag') ?? '' };
}

describe('scripts', () => {
  it('creates, lists and reads with the word count the server keeps', async () => {
    const headers = await signedIn('ada@example.com');
    const { body, etag } = await createScript(headers, {
      title: 'Keynote',
      content: 'Good evening [smile] everyone',
      word_count: 99,
    });
    expect(body.script).toMatchObject({ title: 'Keynote', word_count: 3, team_id: null, script_folder_id: null });
    expect(etag).toBe(`"${String(body.script.updated_at)}"`);
    expect(String(body.script.updated_at)).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}$/);

    const list = await listScripts(call('/v1/script', { headers }), noParams);
    expect(list.headers.get('etag')).toMatch(/^W\/"[0-9a-f]{16}"$/);
    await expect(list.json()).resolves.toEqual({
      scripts: [body.script],
      pagination: { offset: 0, limit: 1000, total: 1, has_more: false },
    });

    const id = String(body.script.id);
    const read = await getScript(call(`/v1/script/${id}`, { headers }), params(id));
    await expect(read.json()).resolves.toEqual({
      script: body.script,
      _links: { self: { href: `/v1/script/${id}` }, collection: { href: '/v1/script' } },
    });
  });

  it('needs If-Match, accepts a W/ tag, and refuses a stale one with the current record', async () => {
    const headers = await signedIn('ada@example.com');
    const { body, etag } = await createScript(headers, { title: 'Keynote', content: 'Hi' });
    const id = String(body.script.id);
    const put = (ifMatch: string | null, script: Record<string, unknown>) =>
      putScript(
        call(`/v1/script/${id}`, {
          method: 'PUT',
          headers: { ...headers, ...(ifMatch === null ? {} : { 'if-match': ifMatch }) },
          body: { script },
        }),
        params(id),
      );

    const missing = await put(null, { title: 'x' });
    expect(missing.status).toBe(428);
    await expect(missing.json()).resolves.toEqual({ detail: 'If-Match required' });

    const weak = await put(`W/${etag}`, { content: 'Hello there friends', word_count: 1 });
    expect(weak.status).toBe(200);
    await expect(weak.json()).resolves.toMatchObject({ script: { content: 'Hello there friends', word_count: 3 } });

    const stale = await put(etag, { title: 'Overwrite' });
    expect(stale.status).toBe(412);
    const refused = (await stale.json()) as { detail: string; current: Record<string, unknown> };
    expect(refused.detail).toBe('The record was changed since it was read');
    expect(refused.current).toMatchObject({ title: 'Keynote', content: 'Hello there friends' });
  });

  it("hides another user's script (404 in the framework's envelope)", async () => {
    const mine = await signedIn('ada@example.com');
    const theirs = await signedIn('bob@example.com');
    const { body } = await createScript(mine, { title: 'Private' });
    const id = String(body.script.id);
    const read = await getScript(call(`/v1/script/${id}`, { headers: theirs }), params(id));
    expect(read.status).toBe(404);
    await expect(read.json()).resolves.toEqual({
      detail: { message: 'Request searched script and could not find the required record.' },
    });
    const list = await listScripts(call('/v1/script', { headers: theirs }), noParams);
    await expect(list.json()).resolves.toMatchObject({ scripts: [] });
  });

  it('refuses an empty title (422) and team sharing as the free plan does (402)', async () => {
    const headers = await signedIn('ada@example.com');
    const empty = await postScript(
      call('/v1/script', { method: 'POST', headers, body: { script: { title: '' } } }),
      noParams,
    );
    expect(empty.status).toBe(422);
    await expect(empty.json()).resolves.toMatchObject({ detail: { message: 'Validation error', code: 'validation_error' } });

    const shared = await postScript(
      call('/v1/script', { method: 'POST', headers, body: { script: { title: 'Shared', team_id: 'team-1' } } }),
      noParams,
    );
    expect(shared.status).toBe(402);
    await expect(shared.json()).resolves.toEqual({ detail: { feature: 'team_sharing', upgrade_to: ['team'] } });
  });

  it('files a script only in a folder of your own, and deletes with 204', async () => {
    const mine = await signedIn('ada@example.com');
    const theirs = await signedIn('bob@example.com');
    const folder = await postFolder(
      call('/v1/script_folder', { method: 'POST', headers: theirs, body: { script_folder: { name: 'Talks' } } }),
      noParams,
    );
    const folderId = String(((await folder.json()) as { script_folder: { id: string } }).script_folder.id);
    const refused = await postScript(
      call('/v1/script', { method: 'POST', headers: mine, body: { script: { title: 'x', script_folder_id: folderId } } }),
      noParams,
    );
    expect(refused.status).toBe(404);

    const { body, etag } = await createScript(mine, { title: 'Gone soon' });
    const id = String(body.script.id);
    const deleted = await deleteScript(
      call(`/v1/script/${id}`, { method: 'DELETE', headers: { ...mine, 'if-match': etag } }),
      params(id),
    );
    expect(deleted.status).toBe(204);
    expect((await getScript(call(`/v1/script/${id}`, { headers: mine }), params(id))).status).toBe(404);
  });
});

describe('prompter preferences', () => {
  it('keeps one settings record per user', async () => {
    const headers = await signedIn('ada@example.com');
    const body = { prompter_preference: { settings: { font_size: 48, mirror: 'none' } } };
    const created = await postPreference(call('/v1/prompter_preference', { method: 'POST', headers, body }), noParams);
    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toMatchObject({
      prompter_preference: { settings: { font_size: 48, mirror: 'none' } },
    });
    const again = await postPreference(call('/v1/prompter_preference', { method: 'POST', headers, body }), noParams);
    expect(again.status).toBe(409);
    await expect(again.json()).resolves.toEqual({ detail: { message: 'You already have prompter settings; update them' } });
    const list = await getPreferences(call('/v1/prompter_preference', { headers }), noParams);
    await expect(list.json()).resolves.toMatchObject({ pagination: { total: 1 } });
  });
});
