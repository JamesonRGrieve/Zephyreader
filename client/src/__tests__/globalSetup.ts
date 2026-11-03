// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Migrates one template SQLite database and sets the auth secrets the code under
 * test requires. Workers spawn after this runs and inherit the env; each copies
 * the template into a database of its own (workerDatabase.ts), so test files run
 * in parallel without interleaving writes.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { TEMPLATE_DATABASE_FILE } from './workerDatabase';

const MIGRATE_TIMEOUT_MS = 60_000;

export default function setup(): () => void {
  const dir = mkdtempSync(path.join(tmpdir(), 'zephyreader-test-'));
  process.env.TEST_DATABASE_DIR = dir;
  process.env.JWT_SECRET = 'test-jwt-secret-of-at-least-32-characters';
  process.env.OAUTH_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  process.env.APP_URI = 'http://localhost';
  process.env.GOOGLE_CLIENT_ID = 'test-google-client';
  process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';

  execFileSync(path.resolve('node_modules/.bin/prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: `file:${path.join(dir, TEMPLATE_DATABASE_FILE)}` },
    stdio: 'pipe',
    timeout: MIGRATE_TIMEOUT_MS,
  });
  return () => rmSync(dir, { recursive: true, force: true });
}
