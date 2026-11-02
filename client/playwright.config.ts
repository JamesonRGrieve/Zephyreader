// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The end-to-end suite runs every spec against both variants, on desktop and on a phone:
 *
 * - `lite`: this app's own API routes (ZEPHYREADER_VARIANT=lite), on a throwaway SQLite file.
 * - `saas`: the same UI over the SaaS server (../server, e2e_server.py), on a throwaway database.
 *
 * People sign in through the browser at a test OpenID provider (e2e/support/idp.ts) that
 * stands in for Google for both back ends. Each server has its own port and build directory,
 * so the suite runs beside a dev server.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

export const PORTS = { idp: 47100, server: 47101, lite: 47102, saas: 47103 } as const;
const host = (port: number) => `http://127.0.0.1:${port}`;
export const IDP = host(PORTS.idp);
const scratch = mkdtempSync(path.join(process.env.E2E_SCRATCH ?? tmpdir(), 'zephyreader-e2e-'));
const NEXT_DEV = './node_modules/.bin/next dev';
const STARTUP_MS = 300_000;

const shared = {
  NEXT_TELEMETRY_DISABLED: '1',
};

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
      command: `./node_modules/.bin/prisma migrate deploy && ${NEXT_DEV} -p ${PORTS.lite} -H 127.0.0.1`,
      url: `${host(PORTS.lite)}/api/v1/alive`,
      reuseExistingServer: false,
      timeout: STARTUP_MS,
      env: lite,
    },
    {
      command: `${NEXT_DEV} -p ${PORTS.saas} -H 127.0.0.1`,
      url: `${host(PORTS.saas)}/user`,
      reuseExistingServer: false,
      timeout: STARTUP_MS,
      env: saas,
    },
  ],
});
