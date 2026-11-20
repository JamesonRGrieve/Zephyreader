// SPDX-License-Identifier: AGPL-3.0-or-later
/** The health probe the edge and the launch gate read, on both back ends, signed out. */
import { expect, test } from '@playwright/test';

test('the health probe answers 204, signed out and uncached @phone', async ({ request }) => {
  const res = await request.get('/healthz', { maxRedirects: 0 });
  expect(res.status()).toBe(204);
  expect(res.headers()['cache-control']).toBe('no-store');
});
