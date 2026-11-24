// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The tab icon on both editions: a 16 px cut and the full mark, each served as SVG to a visitor
 * (signed out) and linked from the page at its size (Logo Design, 2026-11-24).
 */
import { expect, test } from '@playwright/test';

const ICONS = [
  { href: '/icon-16.svg', sizes: '16x16' },
  { href: '/icon.svg', sizes: 'any' },
];

test('both tab icons are served as SVG and linked at their sizes', async ({ page, request }) => {
  for (const icon of ICONS) {
    const answer = await request.get(icon.href, { maxRedirects: 0 });
    expect(answer.status(), icon.href).toBe(200);
    expect(answer.headers()['content-type'], icon.href).toContain('image/svg+xml');
  }
  await page.goto('/');
  for (const icon of ICONS) {
    await expect(page.locator(`head link[rel="icon"][href^="${icon.href}"]`)).toHaveAttribute('sizes', icon.sizes);
  }
});
