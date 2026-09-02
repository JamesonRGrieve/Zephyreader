// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// Next 16 removed `next lint`; ESLint runs via the CLI (`pnpm lint` -> `eslint .`)
// on this flat config. `eslint-config-next` supplies the React, React Hooks,
// jsx-a11y, import, and typescript-eslint rule sets (core-web-vitals promotes the
// Core Web Vitals rules to errors), so no separate plugin installs are required.
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Dependencies
    'node_modules/**',
    // Build / generated output
    '.next/**',
    'out/**',
    'build/**',
    'dist/**',
    'analyze/**',
    'next-env.d.ts',
    // Generated PWA/service-worker assets under public/
    'public/sw.js',
    'public/workbox-*.js',
    // Test / coverage / Storybook artifacts
    'coverage/**',
    'storybook-static/**',
    'test-results/**',
    'playwright-report/**',
    'blob-report/**',
    'playwright/.cache/**',
  ]),
  {
    // CommonJS config files and the Node server entry legitimately use
    // `require()` / `module.exports`; the ESM-only rule does not apply to them.
    files: ['**/*.config.js', '**/*.cjs', 'server-wrapper.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);
