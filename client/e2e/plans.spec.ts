// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * What each back end offers: lite has no paid features to show; the SaaS free plan shows
 * them behind an upgrade prompt; a pro subscriber has them. The same UI decides all three
 * from what the back end serves, never from the variant.
 */
import { expect, test, type Page } from '@playwright/test';
import { makeScript } from './support/api';
import { PRO_EMAIL, signedInPerson } from './support/people';

const isSaas = (projectName: string) => projectName.startsWith('saas');

async function openEditor(page: Page): Promise<void> {
  const script = await makeScript(page, 'Plans test', 'Good evening everyone, and welcome to the launch.');
  await page.goto(`/script/${script.id}`);
  await expect(page.getByLabel('Title')).toHaveValue('Plans test');
}

test('free and lite: paid features are offered or absent, never broken', async ({ browser }, testInfo) => {
  const { page, context } = await signedInPerson(browser, testInfo);
  await openEditor(page);
  const actions = page.getByRole('complementary', { name: 'Script actions' });
  if (isSaas(testInfo.project.name)) {
    await expect(actions.getByRole('note', { name: 'Upgrade' })).toContainText('A paid plan unlocks the AI writer.');
  } else {
    await expect(actions.getByRole('note', { name: 'Upgrade' })).toHaveCount(0);
  }
  await expect(actions.getByRole('region', { name: 'AI writer' })).toHaveCount(0);

  await page.goto('/recordings');
  if (isSaas(testInfo.project.name)) {
    await expect(page.getByRole('note', { name: 'Upgrade' })).toContainText('A paid plan unlocks cloud recordings.');
  } else {
    await expect(page.getByText('there is no cloud library on this server')).toBeVisible();
  }
  await context.close();
});

test('a pro subscriber has the AI writer and the recordings library', async ({ browser }, testInfo) => {
  test.skip(!isSaas(testInfo.project.name), 'Plans are sold only by the SaaS back end');
  const { page, context } = await signedInPerson(browser, testInfo, PRO_EMAIL);
  await openEditor(page);
  const writer = page.getByRole('region', { name: 'AI writer' });
  await expect(writer).toBeVisible();
  // No AI provider is configured on the e2e server: the writer says so instead of failing silently.
  await writer.getByRole('button', { name: 'Shorten the script' }).click();
  await expect(writer.getByRole('alert')).toBeVisible();

  // The library itself, not the upgrade prompt (other tests may have stored this subscriber's takes).
  await page.goto('/recordings');
  await expect(page.getByRole('region', { name: 'Your recordings' })).toBeVisible();
  await expect(page.getByRole('note', { name: 'Upgrade' })).toHaveCount(0);
  await context.close();
});
