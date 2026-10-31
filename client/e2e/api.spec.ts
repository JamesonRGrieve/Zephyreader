// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test';

test.describe('api routes', () => {
  test('GET /api/v1/alive returns runtime config as JSON', async ({ request }) => {
    const response = await request.get('/api/v1/alive');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    await expect(response.json()).resolves.toBeTruthy();
  });

  test('GET /api/v1/user without a token is rejected', async ({ request }) => {
    const response = await request.get('/api/v1/user');
    expect(response.status()).toBe(401);
  });
});
