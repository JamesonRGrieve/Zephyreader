// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * WCAG 2.1 A and AA on every page, in both themes, on both editions: the visitor pages signed
 * out, then the app's own pages signed in, with a real script so the editor, prompter and remote
 * have something to show. No rule is disabled and no element is excluded: a shared primitive
 * that fails is fixed in the framework's tokens or the primitive itself, never excused here
 * (Zephyrex Framework App Standards, the Cule and Chronos pattern).
 */
import { expect, test } from '@playwright/test';
import { violations, withTheme } from '@zephyrex/testing';
import { makeScript } from './support/api';
import { signedInPerson } from './support/people';

const VISITOR_PAGES = ['/', '/user', '/docs/privacy'];
/** One load, network idle and an axe pass per page; a flat limit runs out on a loaded runner. */
const PER_PAGE_MS = 20_000;
const SIGN_IN_MS = 30_000;

// violations() (@zephyrex/testing) checks the page really is in the theme under test, runs axe at
// WCAG 2.1 A and AA, and names each failing element by its markup as well as its selector.

for (const theme of ['light', 'dark'] as const) {
  test(`the visitor pages meet WCAG 2.1 AA in ${theme}`, async ({ page, context }, testInfo) => {
    test.setTimeout(VISITOR_PAGES.length * PER_PAGE_MS);
    await withTheme(context, theme, String(testInfo.project.use.baseURL));
    for (const path of VISITOR_PAGES) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(await violations(page, theme), path).toEqual([]);
    }
  });

  test(`the app's pages meet WCAG 2.1 AA in ${theme}`, async ({ browser }, testInfo) => {
    const { page, context } = await signedInPerson(browser, testInfo);
    await withTheme(context, theme, String(testInfo.project.use.baseURL));
    const script = await makeScript(page, 'Accessibility check', '# Opening\n\nGood evening, everyone. [pause]');
    const appPages = [
      '/scripts',
      `/script/${script.id}`,
      `/present/${script.id}`,
      '/remote',
      `/remote?script=${script.id}`,
      '/recordings',
      '/settings',
      '/user/manage',
    ];
    test.setTimeout(SIGN_IN_MS + (appPages.length + 1) * PER_PAGE_MS);
    for (const path of appPages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(await violations(page, theme), path).toEqual([]);
    }
    await context.close();
  });
}
