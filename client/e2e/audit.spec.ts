// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The visual audit (G4): every page, on both back ends, at desktop 1366 and phone 390@2x,
 * dark and light, signed out and signed in with sample scripts. Each shot is saved with
 * what the page reported (status, console errors and warnings, page errors, sideways
 * overflow, h1 count, images without alt, unnamed links, title) for review, image by image.
 *
 *   VISUAL_AUDIT=<dir> playwright test e2e/audit.spec.ts --project lite --project saas
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  test,
  type Browser,
  type ConsoleMessage,
  type Page,
  type Request,
  type Response,
  type TestInfo,
} from '@playwright/test';
import { call, makeScript } from './support/api';
import { signIn } from './support/people';
import { settled } from './support/settled';

const AUDIT_DIR = process.env.VISUAL_AUDIT ?? '';
const VIEWPORTS = {
  desktop: { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
} as const;
const THEMES = ['dark', 'light'] as const;
/** The dev server's own badge is not part of the app: leave it out of the shots. */
const HIDE_DEV_TOOLS = 'nextjs-portal { display: none !important; }';

const SAMPLE = `# Opening

Good evening, everyone. [smile, pause] Thank you for joining us tonight.

We built **Zephyreader** for anyone who speaks to a camera, a room or a conference call
and wants to look up, not down.

## The problem

Most teleprompters ==scroll at one speed==. People don't speak at one speed.
[slide 2]
They pause, they slow down for the hard parts, and they *speed up* when they are excited.

## What we did

Zephyreader listens. When you speak, it scrolls. When you pause, it waits.

## Close

Thank you. [wave]`;

interface ShotReport {
  name: string;
  status: number | null;
  title: string;
  consoleErrors: string[];
  consoleWarnings: string[];
  pageErrors: string[];
  /** Requests answered 4xx or 5xx, as `status url`. */
  failedRequests: string[];
  /** Requests to any origin but the app's own: a self-hosted page makes none. */
  foreignRequests: string[];
  overflow: number;
  h1: number;
  imagesWithoutAlt: number;
  unnamedLinks: number;
}

async function shoot(page: Page, origin: string, name: string, url: string, reports: ShotReport[]): Promise<void> {
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const foreignRequests: string[] = [];
  const onResponse = (answer: Response) => {
    if (answer.status() >= 400) failedRequests.push(`${answer.status()} ${answer.url()}`);
  };
  const onRequest = (request: Request) => {
    const target = new URL(request.url());
    if (target.protocol.startsWith('http') && target.origin !== origin) foreignRequests.push(request.url());
  };
  const onConsole = (message: ConsoleMessage) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
    if (message.type() === 'warning') consoleWarnings.push(message.text());
  };
  const onPageError = (error: Error) => pageErrors.push(error.message);
  page.on('response', onResponse);
  page.on('request', onRequest);
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  const response = await page.goto(url);
  await settled(page);
  await page.waitForTimeout(600);
  const facts = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    h1: document.querySelectorAll('h1').length,
    imagesWithoutAlt: [...document.querySelectorAll('img')].filter((image) => !image.hasAttribute('alt')).length,
    unnamedLinks: [...document.querySelectorAll('a')].filter(
      (link) =>
        (link.textContent ?? '').trim() === '' &&
        !link.getAttribute('aria-label') &&
        !link.querySelector('[aria-label], img[alt]'),
    ).length,
    title: document.title,
  }));
  await page.screenshot({ path: path.join(AUDIT_DIR, `${name}.png`), fullPage: true, style: HIDE_DEV_TOOLS });
  // Only this page's own traffic: what the test does next is not its doing.
  page.off('response', onResponse);
  page.off('request', onRequest);
  page.off('console', onConsole);
  page.off('pageerror', onPageError);
  reports.push({
    name,
    status: response?.status() ?? null,
    consoleErrors,
    consoleWarnings,
    pageErrors,
    failedRequests,
    foreignRequests,
    ...facts,
  });
}

async function audit(
  browser: Browser,
  testInfo: TestInfo,
  viewport: keyof typeof VIEWPORTS,
  theme: (typeof THEMES)[number],
) {
  const variant = testInfo.project.name;
  const base = testInfo.project.use.baseURL ?? '';
  const context = await browser.newContext({
    ...VIEWPORTS[viewport],
    baseURL: base,
    colorScheme: theme,
    extraHTTPHeaders: { 'X-Forwarded-For': `10.77.${THEMES.indexOf(theme)}.${viewport === 'desktop' ? 1 : 2}` },
  });
  await context.addCookies([{ name: 'theme', value: theme, url: base }]);
  const page = await context.newPage();
  const origin = new URL(base).origin;
  const reports: ShotReport[] = [];
  const prefix = `${variant}-${viewport}-${theme}`;

  for (const [name, url] of [
    ['landing', '/'],
    ['sign-in', '/user'],
    ['privacy', '/docs/privacy'],
  ] as const) {
    await shoot(page, origin, `${prefix}-out-${name}`, url, reports);
  }

  await signIn(page, `audit-${variant}-${viewport}-${theme}@e2e.test`);
  const folder = (await (
    await call(page, 'POST', '/v1/script_folder', { script_folder: { name: 'Launch week' } })
  ).json()) as {
    script_folder: { id: string };
  };
  const keynote = await makeScript(page, 'Launch keynote', SAMPLE);
  await call(
    page,
    'PUT',
    `/v1/script/${keynote.id}`,
    { script: { starred: true, script_folder_id: folder.script_folder.id } },
    {
      'If-Match': `"${String(((await (await call(page, 'GET', `/v1/script/${keynote.id}`)).json()) as { script: { updated_at: string } }).script.updated_at)}"`,
    },
  );
  await makeScript(page, 'Weekly team update', 'Here is what we shipped this week, and what comes next.');
  await makeScript(page, 'Investor pitch (draft)', 'We are raising a seed round to bring Zephyreader to every presenter.');

  for (const [name, url] of [
    ['library', '/scripts'],
    ['editor', `/script/${keynote.id}`],
    ['prompter', `/present/${keynote.id}`],
    ['remote-pick', '/remote'],
    ['remote', `/remote?script=${keynote.id}`],
    ['recordings', '/recordings'],
    ['settings', '/settings'],
    ['account', '/user/manage'],
    ['api-reference', '/docs/api-reference'],
  ] as const) {
    await shoot(page, origin, `${prefix}-in-${name}`, url, reports);
  }
  // The prompter's panels, open.
  await page.goto(`/present/${keynote.id}`);
  await settled(page);
  for (const panel of ['Display', 'Scrolling', 'Record', 'Devices and remote']) {
    await page.getByRole('button', { name: panel, exact: true }).click();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(AUDIT_DIR, `${prefix}-in-prompter-panel-${panel.split(' ')[0].toLowerCase()}.png`),
      style: HIDE_DEV_TOOLS,
    });
    await page.keyboard.press('Escape');
  }
  writeFileSync(path.join(AUDIT_DIR, `${prefix}.json`), JSON.stringify(reports, null, 2));
  await context.close();
}

test.describe('visual audit', () => {
  test.skip(AUDIT_DIR === '', 'Set VISUAL_AUDIT=<dir> to run the visual audit');
  test.beforeAll(() => mkdirSync(AUDIT_DIR, { recursive: true }));
  for (const viewport of ['desktop', 'phone'] as const) {
    for (const theme of THEMES) {
      test(`${viewport} ${theme}`, async ({ browser }, testInfo) => {
        test.setTimeout(240_000);
        await audit(browser, testInfo, viewport, theme);
      });
    }
  }
});
