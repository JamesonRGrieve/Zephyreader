// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The app with scripts off, and the page policy a plain-http build sends, on both back ends.
 * The framework's no-script menu (client-framework 507c6b0 and 5c7d7ce) gives a phone the same
 * pages the sidebar does, as plain links, and never offers a signed-out visitor the private app
 * pages. An e2e build is served over plain http (NEXT_PUBLIC_APP_URI is http://127.0.0.1:…), so
 * its policy must not ask the browser to upgrade requests to https (client-framework 6617284).
 */
import { expect, test } from '@playwright/test';

const PRIVATE_PAGES = ['Scripts', 'Remote control', 'Recordings', 'Prompter settings'];

test('a plain-http build does not ask for https upgrades', async ({ page }) => {
  const response = await page.goto('/docs/privacy');
  const policy = response?.headers()['content-security-policy'] ?? '';
  expect(policy).not.toBe('');
  expect(policy).not.toContain('upgrade-insecure-requests');
});

test.describe('with scripts off', () => {
  test.use({ javaScriptEnabled: false });

  test('a signed-out phone gets the public pages as a menu, never the private ones @phone-only', async ({ page }) => {
    await page.goto('/docs/privacy');
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
    await page.getByText('Menu', { exact: true }).click();
    const pages = page.getByRole('navigation', { name: 'Pages' });
    await expect(pages.getByRole('link', { name: 'Privacy Policy' })).toBeVisible();
    for (const name of PRIVATE_PAGES) {
      await expect(pages.getByRole('link', { name, exact: true })).toHaveCount(0);
    }
  });
});
