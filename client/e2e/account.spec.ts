// SPDX-License-Identifier: AGPL-3.0-or-later
/** Deleting an account from its own page, on both back ends: everything it held goes with it. */
import { expect, test } from '@playwright/test';
import { makeScript } from './support/api';
import { signIn, signedInPerson } from './support/people';

test('deleting your account erases your scripts and signs you out @phone', async ({ browser }, testInfo) => {
  const { page, context, email } = await signedInPerson(browser, testInfo);
  await makeScript(page, 'Soon gone', 'Good evening, everyone.');

  await page.goto('/user/manage');
  await expect(page.getByText('Your scripts, folders, prompter settings and recordings are deleted')).toBeVisible();
  await page.getByLabel(/Type .delete. to confirm/).fill('delete');
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/user/manage'));

  // Signing in again with the same Google account starts afresh.
  await signIn(page, email);
  await expect(page.getByText('No scripts yet.')).toBeVisible();
  await expect(page.getByText('Soon gone')).toHaveCount(0);
  await context.close();
});
