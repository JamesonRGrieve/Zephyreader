// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The HTTP contract both back ends answer (docs/FEATURES.md), asserted identically on
 * each: the lite routes and the SaaS server must give the same statuses, bodies and
 * headers for the same calls, so the one UI works on both. Calls go through the app's
 * same-origin /api as a signed-in person, writes carrying their CSRF token.
 */
import { expect, test } from '@playwright/test';
import contract from '../../contract/teleprompter.json';
import { call } from './support/api';
import { signedInPerson } from './support/people';

/** A script record's fields, exactly: the framework's DTO, which lite copies. */
const SCRIPT_FIELDS = [
  'content',
  'created_at',
  'created_by_user_id',
  'id',
  'script_folder',
  'script_folder_id',
  'source_path',
  'source_provider',
  'starred',
  'team',
  'team_id',
  'title',
  'updated_at',
  'updated_by_user_id',
  'user',
  'user_id',
  'word_count',
];
const TIMESTAMP = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}$/;

test.describe('the shared contract', () => {
  test('records: shapes, versions, stale saves, refusals and deletes', async ({ browser }, testInfo) => {
    const ada = await signedInPerson(browser, testInfo);
    const bob = await signedInPerson(browser, testInfo);

    const created = await call(ada.page, 'POST', '/v1/script', {
      script: { title: 'Keynote', content: 'Good evening [smile] everyone' },
    });
    expect(created.status()).toBe(201);
    const { script } = (await created.json()) as { script: Record<string, unknown> };
    expect(Object.keys(script).sort()).toEqual(SCRIPT_FIELDS);
    expect(script).toMatchObject({ title: 'Keynote', word_count: 3, starred: false, team_id: null, script_folder_id: null });
    expect(String(script.updated_at)).toMatch(TIMESTAMP);
    const etag = created.headers().etag;
    expect(etag).toBe(`"${String(script.updated_at)}"`);
    const path = `/v1/script/${String(script.id)}`;

    const listed = await call(ada.page, 'GET', '/v1/script');
    expect(listed.headers().etag).toMatch(/^W\/"/);
    expect(await listed.json()).toMatchObject({
      scripts: [{ id: script.id }],
      pagination: { offset: 0, total: 1, has_more: false },
    });

    const read = await call(ada.page, 'GET', path);
    expect(await read.json()).toMatchObject({
      script: { id: script.id },
      _links: { self: { href: path }, collection: { href: '/v1/script' } },
    });

    const unguarded = await call(ada.page, 'PUT', path, { script: { title: 'x' } });
    expect(unguarded.status()).toBe(428);
    expect(await unguarded.json()).toEqual({ detail: 'If-Match required' });

    const weak = await call(ada.page, 'PUT', path, { script: { title: 'Keynote v2' } }, { 'If-Match': `W/${etag}` });
    expect(weak.status()).toBe(200);

    const stale = await call(ada.page, 'PUT', path, { script: { title: 'Overwrite' } }, { 'If-Match': etag });
    expect(stale.status()).toBe(412);
    expect(await stale.json()).toMatchObject({
      detail: 'The record was changed since it was read',
      current: { title: 'Keynote v2' },
    });

    const invalid = await call(ada.page, 'POST', '/v1/script', { script: { title: '' } });
    expect(invalid.status()).toBe(422);
    expect(await invalid.json()).toMatchObject({ detail: { message: 'Validation error', code: 'validation_error' } });

    const shared = await call(ada.page, 'POST', '/v1/script', {
      script: { title: 'Shared', team_id: '00000000-0000-0000-0000-000000000001' },
    });
    expect(shared.status()).toBe(402);
    expect(await shared.json()).toEqual({ detail: { feature: 'team_sharing', upgrade_to: ['team'] } });

    // Another person's script is not there for them, as the framework answers it.
    const theirs = await call(bob.page, 'GET', path);
    expect(theirs.status()).toBe(404);
    expect(await theirs.json()).toEqual({
      detail: { message: 'Request searched ScriptModel and could not find the required record.' },
    });
    expect(await (await call(bob.page, 'GET', '/v1/script')).json()).toMatchObject({ scripts: [] });

    const current = await call(ada.page, 'GET', path);
    const removed = await call(ada.page, 'DELETE', path, undefined, { 'If-Match': current.headers().etag });
    expect(removed.status()).toBe(204);
    expect((await call(ada.page, 'GET', path)).status()).toBe(404);

    await ada.context.close();
    await bob.context.close();
  });

  test('settings, sign-in refusals, live sync and what the back end serves', async ({ browser }, testInfo) => {
    const ada = await signedInPerson(browser, testInfo);
    const settings = { prompter_preference: { settings: { fontSize: 64 } } };
    expect((await call(ada.page, 'POST', '/v1/prompter_preference', settings)).status()).toBe(201);
    const again = await call(ada.page, 'POST', '/v1/prompter_preference', settings);
    expect(again.status()).toBe(409);
    expect(await again.json()).toEqual({ detail: { message: 'You already have prompter settings; update them' } });

    expect(await (await call(ada.page, 'GET', '/v1/live/script-x/devices')).json()).toEqual({ devices: [] });
    const unjoined = await call(ada.page, 'POST', '/v1/live/script-x', { client_id: 'ghost', type: 'scroll' });
    expect(unjoined.status()).toBe(409);
    const reserved = await call(ada.page, 'POST', '/v1/live/script-x', { client_id: 'ghost', type: 'presence' });
    expect(reserved.status()).toBe(422);

    const extensions = (
      (await (await call(ada.page, 'GET', '/v1/extension')).json()) as { extensions: { name: string }[] }
    ).extensions.map((extension) => extension.name);
    expect(extensions).toEqual(expect.arrayContaining(['teleprompter', 'live_sync', 'cloud', 'oauth_consumer']));

    // A Drive refusal a person can act on: signed in, but Google refuses the test provider's token.
    const drive = await call(ada.page, 'GET', '/v1/cloud/nextcloud/files');
    expect(drive.status()).toBe(404);
    expect(await drive.json()).toEqual({ detail: { message: "No file service named 'nextcloud'" } });

    // Signed out, everything is 401.
    const anonymous = await browser.newContext({ ...testInfo.project.use });
    const visitor = await anonymous.newPage();
    await visitor.goto('/');
    expect((await call(visitor, 'GET', '/v1/script')).status()).toBe(401);
    await anonymous.close();
    await ada.context.close();
  });

  test('the shared limits hold the same on both back ends (contract/teleprompter.json)', async ({ browser }, testInfo) => {
    const { limits } = contract;
    const ada = await signedInPerson(browser, testInfo);
    const status = async (method: string, path: string, body: unknown) =>
      (await call(ada.page, method, path, body)).status();

    expect(await status('POST', '/v1/script', { script: { title: 'x'.repeat(limits.title_characters) } })).toBe(201);
    expect(await status('POST', '/v1/script', { script: { title: 'x'.repeat(limits.title_characters + 1) } })).toBe(422);
    const longScript = { script: { title: 'Long', content: 'a'.repeat(limits.script_characters + 1) } };
    expect(await status('POST', '/v1/script', longScript)).toBe(422);
    const folder = (characters: number) => ({ script_folder: { name: 'f'.repeat(characters) } });
    expect(await status('POST', '/v1/script_folder', folder(limits.folder_name_characters))).toBe(201);
    expect(await status('POST', '/v1/script_folder', folder(limits.folder_name_characters + 1))).toBe(422);
    const bulky = { prompter_preference: { settings: { note: 'n'.repeat(limits.preferences_bytes) } } };
    expect(await status('POST', '/v1/prompter_preference', bulky)).toBe(413);

    // Live sync's rules are the framework's; lite keeps the same ones.
    const message = (clientId: string, data: unknown) => ({ client_id: clientId, type: 'scroll', data });
    expect(await status('POST', '/v1/live/script-x', message('not a valid id!', null))).toBe(422);
    expect(await status('POST', '/v1/live/script-x', message('ghost', 'd'.repeat(64 * 1024 + 1)))).toBe(413);
    await ada.context.close();
  });
});
