// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Points this test worker at its own copy of the migrated template database
 * (globalSetup.ts), so parallel workers never share a SQLite file. Runs as the
 * first setup file, before any test module imports the Prisma client.
 */
import { copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export const TEMPLATE_DATABASE_FILE = 'template.db';

const dir = process.env.TEST_DATABASE_DIR;
if (dir !== undefined) {
  const workerFile = path.join(dir, `worker-${process.env.VITEST_POOL_ID ?? '0'}.db`);
  if (!existsSync(workerFile)) copyFileSync(path.join(dir, TEMPLATE_DATABASE_FILE), workerFile);
  process.env.DATABASE_URL = `file:${workerFile}`;
}
