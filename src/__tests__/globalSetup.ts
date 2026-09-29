// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Gives the test run a real, migrated SQLite database and the auth secrets the
 * code under test requires. Workers spawn after this runs and inherit the env.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const MIGRATE_TIMEOUT_MS = 60_000;

export default function setup(): () => void {
  const dir = mkdtempSync(path.join(tmpdir(), 'zephyreader-test-'));
  process.env.DATABASE_URL = `file:${path.join(dir, 'test.db')}`;
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.OAUTH_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  process.env.AUTH_WEB = 'http://localhost/user';
  process.env.GOOGLE_CLIENT_ID = 'test-google-client';
  process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';

  execFileSync(path.resolve('node_modules/.bin/prisma'), ['migrate', 'deploy'], {
    env: process.env,
    stdio: 'pipe',
    timeout: MIGRATE_TIMEOUT_MS,
  });
  return () => rmSync(dir, { recursive: true, force: true });
}
