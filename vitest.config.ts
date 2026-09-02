// SPDX-License-Identifier: AGPL-3.0-or-later
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['src/__tests__/setup.ts'],
    globals: true,
    exclude: ['**/node_modules/**', '.next/**', 'e2e/**', 'tests/**', '**/*.stories.{ts,tsx}'],
  },
  resolve: {
    alias: {
      // Mirrors tsconfig paths: `@` → the linked framework source, `~` → this app.
      '@': path.resolve(__dirname, './node_modules/zephyrex/src'),
      '~': path.resolve(__dirname, './src'),
    },
  },
});
