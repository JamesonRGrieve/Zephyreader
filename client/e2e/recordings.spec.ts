// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * A pro subscriber's cloud recording, through every layer a real take passes: the browser, the
 * SaaS front end's proxy and the server's body limits. A minute of 720p is easily 12 MB, past
 * the framework's default body cap, so a test with a small clip would miss the failure.
 */
import { expect, test } from '@playwright/test';
import { call } from './support/api';
import { PRO_EMAIL, signedInPerson } from './support/people';

const TAKE_BYTES = 12 * 1024 * 1024;
/** WebM's magic number, so the take reads as the type it claims. */
const WEBM_MAGIC = [0x1a, 0x45, 0xdf, 0xa3];

test('a pro subscriber stores a full-length take in the cloud library', async ({ browser }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('saas'), 'Cloud recordings are sold only by the SaaS back end');
  const { page, context } = await signedInPerson(browser, testInfo, PRO_EMAIL);
  const created = await call(page, 'POST', '/v1/recording', { recording: { title: 'Full take', mime_type: 'video/webm' } });
  expect(created.status()).toBe(201);
  const recording = ((await created.json()) as { recording: { id: string } }).recording;
  const etag = created.headers().etag ?? '';

  const stored = await page.evaluate(
    async ({ id, etag, size, magic }) => {
      const take = new Uint8Array(size);
      take.set(magic);
      const token = document.cookie.match(/(?:^|; )zx_csrf=([^;]*)/)?.[1] ?? '';
      const response = await fetch(`/api/v1/recording/${id}/content`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'video/webm', 'If-Match': etag, 'X-CSRF-Token': decodeURIComponent(token) },
        body: take,
      });
      return { status: response.status, body: (await response.json()) as unknown };
    },
    { id: recording.id, etag, size: TAKE_BYTES, magic: WEBM_MAGIC },
  );
  expect(stored.status, JSON.stringify(stored.body)).toBe(200);
  expect(stored.body).toMatchObject({ recording: { size_bytes: TAKE_BYTES } });

  // And it can be deleted again (leaving the shared subscriber as it was).
  const current = await call(page, 'GET', `/v1/recording/${recording.id}`);
  const deleted = await call(page, 'DELETE', `/v1/recording/${recording.id}`, undefined, {
    'If-Match': current.headers().etag ?? '',
  });
  expect(deleted.status()).toBe(200);
  await context.close();
});
