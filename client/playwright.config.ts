// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The end-to-end suite runs every spec against both variants, on desktop and on a phone:
 *
 * - `lite`: this app's own API routes (ZEPHYREADER_VARIANT=lite), on a throwaway SQLite file.
 * - `saas`: the same UI over the SaaS server (../server, e2e_server.py), on a throwaway database.
 *
 * People sign in through the browser at a test OpenID provider (e2e/support/idp.ts) that
 * stands in for Google for both back ends. Each edition is a production build (`next build`,
 * then `next start`) in its own build directory, so the suite tests what ships and runs beside
 * a dev server. The two builds run one after the other: two Next processes in one client
 * directory at once rewrite next-env.d.ts under each other.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Zephyreader's ports on the shared runner: 48000 + 10 × the 58137 lane the job was granted
// (ZEPHYREADER_E2E_LANE, default 1: 48010–48019; Session 1 Manager, 2026-11-21, after a port clash;
// lane 11's 48110–48113, Chief of Staff, 2026-11-24).
const PORT_BASE = 48000 + 10 * Number(process.env.ZEPHYREADER_E2E_LANE ?? '1');
export const PORTS = { idp: PORT_BASE, server: PORT_BASE + 1, lite: PORT_BASE + 2, saas: PORT_BASE + 3 } as const;
const host = (port: number) => `http://127.0.0.1:${port}`;
export const IDP = host(PORTS.idp);
const scratch = mkdtempSync(path.join(process.env.E2E_SCRATCH ?? tmpdir(), 'zephyreader-e2e-'));
const NEXT = './node_modules/.bin/next';
/** Lite writes this once its build is done; the SaaS build waits for it. */
const LITE_BUILT = path.join(scratch, 'lite-built');
// Two production builds in turn, on a shared build runner.
const STARTUP_MS = 900_000;

/**
 * The e2e build skips Next's own type-check (next.config.js): the gate type-checks as a step of its
 * own, and on a loaded runner over NFS the check is most of the build (Text Mutation's way).
 */
const shared = {
  NEXT_TELEMETRY_DISABLED: '1',
  ZEPHYREADER_E2E_BUILD: '1',
};
/**
 * The builds are already made (a build job before the test job, each within the runner cap): the
 * servers only start. Each run still migrates its own fresh database.
 */
const PREBUILT = process.env.ZEPHYREADER_E2E_PREBUILT === '1';
const build = PREBUILT ? 'true' : `${NEXT} build`;

const lite = {
  ...shared,
  ZEPHYREADER_VARIANT: 'lite',
  NEXT_DIST_DIR: '.next-e2e-lite',
  PORT: String(PORTS.lite),
  APP_URI: host(PORTS.lite),
  DATABASE_URL: `file:${path.join(scratch, 'lite.db')}`,
  JWT_SECRET: 'e2e-lite-jwt-secret-of-at-least-32-characters',
  OAUTH_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'),
  GOOGLE_ISSUER: IDP,
  GOOGLE_CLIENT_ID: 'zephyreader-e2e',
  GOOGLE_CLIENT_SECRET: 'zephyreader-e2e-secret',
};

const saas = {
  ...shared,
  ZEPHYREADER_VARIANT: 'saas',
  NEXT_DIST_DIR: '.next-e2e-saas',
  PORT: String(PORTS.saas),
  APP_URI: host(PORTS.saas),
  ZEPHYREADER_SERVER_URI: host(PORTS.server),
  // The paid-plan waitlist is on, with its ERP somewhere that never answers: a signup is refused
  // (502) unless a test stands in for the ERP.
  WAITLIST_WEB_FORM: 'waitlist-e2e',
  WAITLIST_ERP_URL: 'http://127.0.0.1:9',
};

const desktop = devices['Desktop Chrome'];
const phone = devices['Pixel 7'];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [['list']],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: { trace: 'retain-on-failure', navigationTimeout: 60_000 },
  projects: [
    { name: 'lite', use: { ...desktop, baseURL: host(PORTS.lite) }, grepInvert: /@phone-only/ },
    { name: 'saas', use: { ...desktop, baseURL: host(PORTS.saas) }, grepInvert: /@phone-only/ },
    { name: 'lite-phone', use: { ...phone, baseURL: host(PORTS.lite) }, grep: /@phone/ },
    { name: 'saas-phone', use: { ...phone, baseURL: host(PORTS.saas) }, grep: /@phone/ },
  ],
  webServer: [
    {
      command: `node e2e/support/idp.ts ${PORTS.idp}`,
      url: `${IDP}/jwks`,
      reuseExistingServer: false,
      timeout: STARTUP_MS,
    },
    {
      command: `.venv/bin/python e2e_server.py --port ${PORTS.server} --idp ${IDP} --client ${host(PORTS.saas)}`,
      cwd: '../server',
      url: `${host(PORTS.server)}/v1/auth/oauth/providers`,
      reuseExistingServer: false,
      timeout: STARTUP_MS,
      env: { E2E_SCRATCH: scratch },
      // The server's own log, so a failed sign-in or request shows its cause.
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `./node_modules/.bin/prisma migrate deploy && ${build} && touch '${LITE_BUILT}' && ${NEXT} start -p ${PORTS.lite} -H 127.0.0.1`,
      url: `${host(PORTS.lite)}/api/v1/alive`,
      reuseExistingServer: false,
      timeout: STARTUP_MS,
      env: lite,
    },
    {
      command: `until [ -e '${LITE_BUILT}' ]; do sleep 1; done; ${build} && ${NEXT} start -p ${PORTS.saas} -H 127.0.0.1`,
      url: `${host(PORTS.saas)}/user`,
      reuseExistingServer: false,
      timeout: STARTUP_MS,
      env: saas,
    },
  ],
});
