// SPDX-License-Identifier: AGPL-3.0-or-later
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // The framework's jsdom stand-ins and toast clearing first; then workerDatabase, so each worker
    // gets its own copy of the migrated database and files run in parallel; then the app's mocks.
    setupFiles: ['zephyrex/testing/setup', 'src/__tests__/workerDatabase.ts', 'src/__tests__/setup.ts'],
    globalSetup: ['src/__tests__/globalSetup.ts'],
    // Threads over forks: lighter per-worker memory and startup; one worker per core.
    pool: 'threads',
    maxWorkers: '100%',
    globals: true,
    exclude: ['**/node_modules/**', '.next/**', 'e2e/**', 'tests/**', '**/*.stories.{ts,tsx}'],
    // The framework through Vite, not Node, so the setup's next/navigation mock reaches its
    // imports too (it imports 'next/navigation.js'): its header renders in a test as in the app.
    server: { deps: { inline: ['zephyrex'] } },
  },
  resolve: {
    alias: {
      // Mirrors the tsconfig `~/*` path to this app's source.
      '~': path.resolve(__dirname, './src'),
    },
  },
});
