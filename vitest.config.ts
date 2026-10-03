// SPDX-License-Identifier: AGPL-3.0-or-later
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // workerDatabase first: each worker gets its own copy of the migrated database, so files run in parallel.
    setupFiles: ['src/__tests__/workerDatabase.ts', 'src/__tests__/setup.ts'],
    globalSetup: ['src/__tests__/globalSetup.ts'],
    // Threads over forks: lighter per-worker memory and startup; one worker per core.
    pool: 'threads',
    maxWorkers: '100%',
    globals: true,
    exclude: ['**/node_modules/**', '.next/**', 'e2e/**', 'tests/**', '**/*.stories.{ts,tsx}'],
  },
  resolve: {
    alias: {
      // Mirrors the tsconfig `~/*` path to this app's source.
      '~': path.resolve(__dirname, './src'),
    },
  },
});
