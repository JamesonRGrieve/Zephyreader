// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * People for the end-to-end suite. Each gets a browser context of their own (their own
 * session cookie, so one person's CSRF token never meets another's session) and a client
 * address of their own (the servers trust the loopback proxy's X-Forwarded-For, so people
 * don't share one sign-in rate limit), and signs in through the pages, as a person does.
 */
import { randomBytes, randomInt } from 'node:crypto';
import { expect, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test';

/** The SaaS e2e server's pro subscriber (server/e2e_server.py). */
export const PRO_EMAIL = 'pro@e2e.test';

export interface Person {
  email: string;
  context: BrowserContext;
  page: Page;
}

function clientAddress(): string {
  return `10.${randomInt(0, 256)}.${randomInt(0, 256)}.${randomInt(1, 255)}`;
}

export function freshEmail(prefix = 'person'): string {
  return `${prefix}-${randomBytes(6).toString('hex')}@e2e.test`;
}

/** A person with their own browser context, signed in through the sign-in page. */
export async function signedInPerson(browser: Browser, testInfo: TestInfo, email: string = freshEmail()): Promise<Person> {
  const context = await browser.newContext({
    ...testInfo.project.use,
    extraHTTPHeaders: { 'X-Forwarded-For': clientAddress() },
  });
  const page = await context.newPage();
  await signIn(page, email);
  return { email, context, page };
}

/**
 * The one sign-in button: the hosted (SaaS) build signs in with Zephyrex's Authentik, lite with
 * Google. The test provider stands in for both. Both builds' projects share this module, so the
 * button is matched by either name.
 */
export const SIGN_IN_BUTTON = /^Continue with (Zephyrex|Google)$/;

/** Signs in on `page` at the test provider, as a person clicking through it. */
export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/user');
  await page.getByRole('button', { name: SIGN_IN_BUTTON }).click();
  await expect(page.getByRole('heading', { name: 'Test sign-in' })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Continue' }).click();
  // Signing in lands on the library (zephyrex.config auth.home).
  await page.waitForURL((url) => url.pathname === '/scripts');
  await expect(page.getByRole('heading', { name: 'Your scripts' })).toBeVisible();
}

/** Every host the page has fetched from, for the no-third-party-requests check. */
export function watchHosts(page: Page): Set<string> {
  const hosts = new Set<string>();
  page.on('request', (request) => hosts.add(new URL(request.url()).host));
  return hosts;
}
