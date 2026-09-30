// SPDX-License-Identifier: AGPL-3.0-or-later
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['src/__tests__/setup.ts'],
    globalSetup: ['src/__tests__/globalSetup.ts'],
    // Auth tests share one real SQLite database; run files serially so they don't interleave writes.
    fileParallelism: false,
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
