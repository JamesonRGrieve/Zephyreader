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
    await expect(page.getByText('This server keeps no copy.', { exact: false })).toBeVisible();
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

test('paid plans are waitlist only: every way to pay leads to the waitlist, and none takes a payment', async ({
  browser,
}, testInfo) => {
  const { page, context } = await signedInPerson(browser, testInfo);
  // The framework's subscribe page is the plans page.
  await page.goto('/user/subscribe');
  await page.waitForURL(/\/plans$/);
  if (!isSaas(testInfo.project.name)) {
    await expect(page.getByText('This server has no paid plans.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Join the waitlist' })).toHaveCount(0);
    await context.close();
    return;
  }
  await expect(page.getByRole('heading', { name: 'Accounts and paid plans: waitlist only' })).toBeVisible();
  await expect(page.getByText('nothing here takes a payment', { exact: false })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Join the waitlist' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Pro plan, for one person' })).toBeChecked();

  // An upgrade prompt's "See plans" leads here too.
  await page.goto('/recordings');
  await page.getByRole('note', { name: 'Upgrade' }).getByRole('link', { name: 'See plans' }).click();
  await page.waitForURL(/\/plans$/);
  await expect(page.getByRole('heading', { name: 'Accounts and paid plans: waitlist only' })).toBeVisible();
  await context.close();
});

test('a visitor joins the waitlist from the landing page', async ({ page }, testInfo) => {
  test.skip(!isSaas(testInfo.project.name), 'lite has no waitlist');
  // A stand-in for this app's /api/waitlist, so no lead reaches the ERP (the route is unit-tested).
  const sent: unknown[] = [];
  await page.route('**/api/waitlist', async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({ status: 202, json: { ok: true } });
  });
  await page.goto('/');
  await page.getByRole('main').getByRole('link', { name: 'Join the waitlist' }).click();
  await page.waitForURL(/\/plans$/);
  const form = page.getByRole('region', { name: 'Join the waitlist' });
  await form.getByRole('textbox', { name: 'Email' }).fill('zephyrex-site-test+e2e@example.com');
  // A visitor starts on an account; they may pick a plan instead.
  await expect(form.getByRole('radio', { name: 'An account' })).toBeChecked();
  await form.getByRole('radio', { name: 'Team plan, shared with colleagues' }).click();
  await form.getByRole('checkbox').check();
  await form.getByRole('button', { name: 'Join the waitlist' }).click();
  await expect(form.getByRole('status')).toContainText('on the waitlist');
  expect(sent).toEqual([{ email: 'zephyrex-site-test+e2e@example.com', consent: true, interest: 'team' }]);
});

test('lite has no waitlist route', async ({ request }, testInfo) => {
  test.skip(isSaas(testInfo.project.name), 'the hosted edition has the waitlist');
  const answer = await request.post('/api/waitlist', { data: { email: 'a@example.com', consent: true } });
  expect(answer.status()).toBe(404);
});

test('with sign-up closed, the sign-up page leads to the waitlist, and sign-in stays open @signup-closed', async ({
  page,
}) => {
  await page.goto('/user/register');
  await page.waitForURL(/\/plans$/);
  await expect(page.getByRole('heading', { name: 'Accounts and paid plans: waitlist only' })).toBeVisible();
  await page.goto('/user');
  await expect(page).toHaveURL(/\/user$/);
  await expect(page.getByRole('button', { name: 'Continue with Zephyrex' })).toBeVisible();
});

test('the hosted edition signs in only with Zephyrex, and lite only with Google', async ({ page }, testInfo) => {
  await page.goto('/user');
  const provider = isSaas(testInfo.project.name) ? 'Zephyrex' : 'Google';
  await expect(page.getByRole('button', { name: `Continue with ${provider}` })).toBeVisible();
  // No other provider, and no email sign-in (password or magic link).
  await expect(page.getByRole('button', { name: /^Continue with/ })).toHaveCount(1);
  await expect(page.getByRole('textbox')).toHaveCount(0);
});
