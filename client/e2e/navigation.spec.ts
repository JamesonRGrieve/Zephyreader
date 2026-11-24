// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Getting around, on both back ends, on a desktop and a phone: the landing page is for visitors,
 * signed-in people land on their scripts, every app page reaches the app's navigation, each page
 * names itself, and the app installs as itself.
 */
import { expect, test, type Page } from '@playwright/test';
import { makeScript } from './support/api';
import { signedInPerson } from './support/people';
import { settled } from './support/settled';

const isPhone = (projectName: string) => projectName.endsWith('-phone');

/** Opens the app's navigation where it is folded away (a phone), and returns it. */
async function navigation(page: Page, phone: boolean) {
  if (phone) await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click();
  return page.locator('[data-sidebar="sidebar"]').filter({ hasText: 'Recordings' });
}

test('signed in, every app page reaches the navigation and names itself @phone', async ({ browser }, testInfo) => {
  const { page, context } = await signedInPerson(browser, testInfo);
  await page.goto('/');
  await page.waitForURL((url) => url.pathname === '/scripts');
  const script = await makeScript(page, 'Navigation test', 'Good evening, everyone.');
  for (const [path, title] of [
    ['/scripts', 'Your scripts'],
    [`/script/${script.id}`, 'Edit script'],
    ['/remote', 'Remote control'],
    ['/recordings', 'Recordings'],
    ['/settings', 'Prompter settings'],
  ] as const) {
    await page.goto(path);
    await settled(page);
    await expect(page, path).toHaveTitle(`${title} · Zephyreader`);
    const nav = await navigation(page, isPhone(testInfo.project.name));
    await expect(nav.getByRole('link', { name: 'Recordings' }), path).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Scripts' }), path).toHaveAttribute('href', '/scripts');
  }
  await page.goto(`/present/${script.id}`);
  await expect(page).toHaveTitle('Prompter · Zephyreader');
  await context.close();
});

test('signed out, the landing page is for visitors and app pages ask you to sign in @phone', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Zephyreader');
  // The hosted service's way in is its waitlist (sign-up is closed there); lite's is sign-in.
  const start = testInfo.project.name.startsWith('saas') ? 'Join the waitlist' : 'Sign in to start';
  await expect(page.getByRole('link', { name: start })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in' })).toBeVisible();
  for (const path of ['/scripts', '/recordings', '/settings']) {
    await page.goto(path);
    await page.waitForURL((url) => url.pathname.startsWith('/user'));
  }
});

test('the app installs as Zephyreader and lets people zoom', async ({ page }) => {
  await page.goto('/');
  const manifestPath = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestPath).not.toBeNull();
  const manifest = (await (await page.request.get(manifestPath ?? '')).json()) as {
    name: string;
    icons: { src: string }[];
    serviceworker?: unknown;
  };
  expect(manifest.name).toBe('Zephyreader');
  expect(manifest.serviceworker).toBeUndefined();
  for (const icon of manifest.icons) {
    expect((await page.request.get(icon.src)).status(), icon.src).toBe(200);
  }
  for (const link of await page.locator('link[rel~="icon"], link[rel="apple-touch-icon"]').all()) {
    const href = (await link.getAttribute('href')) ?? '';
    expect((await page.request.get(href)).status(), href).toBe(200);
  }
  const viewport = (await page.locator('meta[name="viewport"]').getAttribute('content')) ?? '';
  expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)/);
  expect(viewport).not.toMatch(/maximum-scale\s*=\s*1(\.0)?\b/);
});
