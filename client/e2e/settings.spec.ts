// SPDX-License-Identifier: AGPL-3.0-or-later
/** Prompter settings saved once reach the prompter on every later visit, on both back ends. */
import { expect, test } from '@playwright/test';
import { makeScript } from './support/api';
import { signedInPerson } from './support/people';

test('a saved colour theme is what the prompter opens with', async ({ browser }, testInfo) => {
  const { page, context } = await signedInPerson(browser, testInfo);
  await page.goto('/settings');
  await page.getByRole('radiogroup', { name: 'Colours' }).getByRole('radio', { name: 'Yellow on black' }).click();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText('Settings saved').first()).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole('radiogroup', { name: 'Colours' }).getByRole('radio', { name: 'Yellow on black' }),
  ).toBeChecked();

  const script = await makeScript(page, 'Settings test', 'Hello there, everyone.');
  await page.goto(`/present/${script.id}`);
  const surface = page.getByLabel('Script', { exact: true });
  await expect(surface).toContainText('Hello there');
  await expect(surface).toHaveCSS('color', 'rgb(255, 230, 0)');
  await expect(surface).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await context.close();
});
