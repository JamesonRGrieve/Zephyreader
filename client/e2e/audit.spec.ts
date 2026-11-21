// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The visual audit (G4): every page, on both back ends, at desktop 1366 and phone 390@2x,
 * dark and light, signed out and signed in with sample scripts. Each shot is saved with
 * what the page reported (status, console errors and warnings, page errors, sideways
 * overflow, h1 count, images without alt, unnamed links, title) for review, image by image.
 * The facts a page can't be shipped with fail the test: sideways overflow, a page error, a
 * request to another origin, a broken link, other than one h1, no title, an image without alt,
 * or a heading that skips a level (Zephyrex Framework App Standards). It runs in every e2e pass; the shots go to VISUAL_AUDIT=<dir> when it is set.
 *
 *   VISUAL_AUDIT=<dir> playwright test e2e/audit.spec.ts --project lite --project saas
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  devices,
  expect,
  request,
  test,
  type Browser,
  type ConsoleMessage,
  type Page,
  type Request,
  type Response,
  type TestInfo,
} from '@playwright/test';
import { call, makeScript, writeCurrent } from './support/api';
import { signIn } from './support/people';
import { settled, still } from './support/settled';

const AUDIT_DIR = process.env.VISUAL_AUDIT || path.join('test-results', 'visual-audit');
// Real devices (their browsers' user agents, touch and mobile behaviour), at the audit's sizes.
const VIEWPORTS = {
  desktop: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 },
  phone: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
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
  /** The page's own links that lead nowhere, as `status url`. */
  brokenLinks: string[];
  overflow: number;
  h1: number;
  imagesWithoutAlt: number;
  unnamedLinks: number;
  /** Buttons a screen reader would announce only as 'button'. */
  unnamedButtons: number;
  /** Headings that skip a level after the one before them (an h2 straight to an h4), as `hN after hM`. */
  headingSkips: string[];
}

/** Link checks already made in this audit pass, by signed-in state and URL. */
const linkStatus = new Map<string, number>();
let signedIn = false;
const linkKey = (href: string) => `${signedIn ? 'in' : 'out'} ${href}`;

/** The facts that fail the audit; everything else in a report is for the eye review. */
function assertShippable(reports: ShotReport[]): void {
  for (const report of reports) {
    expect.soft(report.overflow, `${report.name}: sideways overflow`).toBe(0);
    expect.soft(report.pageErrors, `${report.name}: page errors`).toEqual([]);
    expect.soft(report.foreignRequests, `${report.name}: requests to another origin`).toEqual([]);
    expect.soft(report.brokenLinks, `${report.name}: broken links`).toEqual([]);
    expect.soft(report.h1, `${report.name}: h1 count`).toBe(1);
    expect.soft(report.title.trim(), `${report.name}: page title`).not.toBe('');
    expect.soft(report.imagesWithoutAlt, `${report.name}: images without alt`).toBe(0);
    // axe's heading-order rule sits outside the WCAG tags the accessibility spec runs.
    expect.soft(report.headingSkips, `${report.name}: skipped heading levels`).toEqual([]);
  }
}

/**
 * A full-page shot sees only the document, but the app scrolls inside the framework's SidebarInset:
 * unroll the page's own scroller (the tallest element that scrolls vertically) so the shot holds
 * the whole page, not its first screen.
 */
async function unroll(page: Page): Promise<void> {
  await page.evaluate(() => {
    const [scroller] = [...document.querySelectorAll<HTMLElement>('*')]
      .filter((element) => /(auto|scroll)/.test(getComputedStyle(element).overflowY))
      .filter((element) => element.scrollHeight > element.clientHeight)
      // The prompter's script is a surface sized to the screen on purpose: unrolled, its eye line
      // (a share of its height) drops far down the script and the time left reads short (0:21 for 0:33).
      .filter((element) => element.closest('section[aria-label="Script"]') === null)
      .sort((a, b) => b.scrollHeight - a.scrollHeight);
    if (scroller !== undefined) {
      scroller.style.height = 'auto';
      scroller.style.overflow = 'visible';
    }
  });
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
  await still(page);
  const facts = await page.evaluate(() => ({
    // The app scrolls inside the framework's SidebarInset, where sideways overflow never widens the
    // document (16 Worldviews' finding): count the page's own scroller too, the tallest element
    // that scrolls vertically.
    overflow: Math.max(
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ...[...document.querySelectorAll<HTMLElement>('*')]
        .filter((element) => /(auto|scroll)/.test(getComputedStyle(element).overflowY))
        .filter((element) => element.scrollHeight > element.clientHeight)
        .sort((a, b) => b.scrollHeight - a.scrollHeight)
        .slice(0, 1)
        .map((scroller) => scroller.scrollWidth - scroller.clientWidth),
    ),
    h1: document.querySelectorAll('h1').length,
    imagesWithoutAlt: [...document.querySelectorAll('img')].filter((image) => !image.hasAttribute('alt')).length,
    unnamedLinks: [...document.querySelectorAll('a')].filter(
      (link) =>
        (link.textContent ?? '').trim() === '' &&
        !link.getAttribute('aria-label') &&
        !link.querySelector('[aria-label], img[alt]'),
    ).length,
    unnamedButtons: [...document.querySelectorAll('button, [role="button"]')].filter(
      (button) =>
        (button.textContent ?? '').trim() === '' &&
        !button.getAttribute('aria-label') &&
        !button.getAttribute('aria-labelledby') &&
        !button.getAttribute('title') &&
        ((button as HTMLButtonElement).labels?.length ?? 0) === 0,
    ).length,
    headingSkips: [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')]
      .map((heading) => Number(heading.tagName[1]))
      .flatMap((level, index, levels) =>
        index > 0 && level > levels[index - 1] + 1 ? [`h${level} after h${levels[index - 1]}`] : [],
      ),
    title: document.title,
  }));
  await unroll(page);
  await page.screenshot({ path: path.join(AUDIT_DIR, `${name}.png`), fullPage: true, style: HIDE_DEV_TOOLS });
  const brokenLinks: string[] = [];
  const hrefs = await page.evaluate(() => [
    ...new Set([...document.querySelectorAll('a[href]')].map((link) => (link as HTMLAnchorElement).href)),
  ]);
  // Checked from a copy of the page's cookies, so following a link (a sign-in redirect that
  // remembers where to return) cannot change what the page itself does next. Each link is
  // checked once per audit pass and signed-in state, not once per page that shows it.
  const unchecked = hrefs.filter((candidate) => new URL(candidate).origin === origin && !linkStatus.has(linkKey(candidate)));
  if (unchecked.length > 0) {
    const checker = await request.newContext({ storageState: await page.context().storageState() });
    for (const href of unchecked) linkStatus.set(linkKey(href), (await checker.get(href, { maxRedirects: 5 })).status());
    await checker.dispose();
  }
  for (const href of hrefs.filter((candidate) => new URL(candidate).origin === origin)) {
    const status = linkStatus.get(linkKey(href)) ?? 0;
    if (status >= 400) brokenLinks.push(`${status} ${href}`);
  }
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
    brokenLinks,
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

  // Framework defect (reported to Cule, 2026-11-21): auth's middleware remembers where to return
  // (the `href` cookie) on any signed-out request for a private page, prefetches included, and the
  // signed-out sidebar lists the private pages, so Next's prefetch of them sends sign-in to the last
  // one (Prompter settings) instead of the library. Cleared here so the audit shoots the app; remove
  // once the framework stops doing it.
  await context.clearCookies({ name: 'href' });
  await signIn(page, `audit-${variant}-${viewport}-${theme}@e2e.test`);
  signedIn = true;
  // A first-time person's empty library, before any script exists.
  await shoot(page, origin, `${prefix}-in-library-empty`, '/scripts', reports);
  const folder = (await (
    await call(page, 'POST', '/v1/script_folder', { script_folder: { name: 'Launch week' } })
  ).json()) as {
    script_folder: { id: string };
  };
  const keynote = await makeScript(page, 'Launch keynote', SAMPLE);
  await writeCurrent(page, 'PUT', `/v1/script/${keynote.id}`, {
    script: { starred: true, script_folder_id: folder.script_folder.id },
  });

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
  ] as const) {
    await shoot(page, origin, `${prefix}-in-${name}`, url, reports);
  }
  // The library's dialogs and notices, open: a new folder, a delete still in its Undo window.
  const plainShot = async (name: string) => {
    await still(page);
    await unroll(page);
    await page.screenshot({ path: path.join(AUDIT_DIR, `${prefix}-${name}.png`), fullPage: true, style: HIDE_DEV_TOOLS });
  };
  await page.goto('/scripts');
  await settled(page);
  await page.getByRole('button', { name: 'New folder' }).click();
  await plainShot('in-library-new-folder');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Weekly team update actions' }).click();
  await page.getByRole('menuitem', { name: /Delete/ }).click();
  await plainShot('in-library-deleted-undo');
  await page.getByRole('button', { name: 'Undo' }).click();
  // The library when its scripts can't be read (a plain shot: the failure is the point).
  await page.route('**/api/v1/script?**', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'The server is busy' }) }),
  );
  await page.route('**/api/v1/script', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'The server is busy' }) }),
  );
  await page.goto('/scripts');
  await page.getByText('Try again').waitFor();
  await plainShot('in-library-error');
  await page.unrouteAll();
  // The prompter's panels, open.
  await page.goto(`/present/${keynote.id}`);
  await settled(page);
  for (const panel of ['Display', 'Scrolling', 'Record', 'Devices and remote']) {
    await page.getByRole('button', { name: panel, exact: true }).click();
    await still(page);
    await page.screenshot({
      path: path.join(AUDIT_DIR, `${prefix}-in-prompter-panel-${panel.split(' ')[0].toLowerCase()}.png`),
      style: HIDE_DEV_TOOLS,
    });
    await page.keyboard.press('Escape');
  }
  writeFileSync(path.join(AUDIT_DIR, `${prefix}.json`), JSON.stringify(reports, null, 2));
  await context.close();
  signedIn = false;
  assertShippable(reports);
}

test.describe('visual audit', () => {
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
