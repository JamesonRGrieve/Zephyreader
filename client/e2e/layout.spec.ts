// SPDX-License-Identifier: AGPL-3.0-or-later
/** No page scrolls sideways, on a desktop or a phone, on either back end. */
import { expect, test, type Page } from '@playwright/test';
import { makeScript } from './support/api';
import { signedInPerson } from './support/people';

/** Waits until the page shows its content rather than a loading state (a live stream never lets the network go idle). */
async function settled(page: Page): Promise<void> {
  await page.waitForLoadState('load');
  await expect(page.getByText(/^(Loading|Opening|Getting the prompter ready|Connecting)/)).toHaveCount(0);
}

async function overflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test('signed out, the landing and sign-in pages fit the screen @phone', async ({ page }) => {
  for (const path of ['/', '/user']) {
    await page.goto(path);
    await settled(page);
    expect(await overflow(page), path).toBeLessThanOrEqual(0);
  }
});

test('signed in, every page fits the screen @phone', async ({ browser }, testInfo) => {
  const { page, context } = await signedInPerson(browser, testInfo);
  const script = await makeScript(
    page,
    'A deliberately long script title that should wrap or truncate rather than push the page wider than the screen',
    'A line with a very-long-unbroken-word-that-could-overflow-a-narrow-screen-if-the-layout-is-careless and more.',
  );
  for (const path of [
    '/',
    `/script/${script.id}`,
    `/present/${script.id}`,
    `/remote?script=${script.id}`,
    '/remote',
    '/recordings',
    '/settings',
  ]) {
    await page.goto(path);
    await settled(page);
    expect(await overflow(page), path).toBeLessThanOrEqual(0);
  }
  await context.close();
});
