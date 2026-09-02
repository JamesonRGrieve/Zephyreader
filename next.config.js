// SPDX-License-Identifier: AGPL-3.0-or-later
const path = require('path');

// The Zephyrex framework is consumed as a source-exported package (npm link).
// Its internal modules import via the `@/*` alias, which resolves to the
// framework's own `src`. We point `@` at the linked package's source so those
// imports resolve when Next transpiles the package (see `transpilePackages`).
const ZEPHYREX_SRC = path.resolve(__dirname, 'node_modules/zephyrex/src');
const APP_URI = process.env.APP_URI || 'http://localhost:6969';
const AUTH_SERVER = process.env.AUTH_SERVER || `${APP_URI}/api/v1`;
const AUTH_WEB = process.env.AUTH_WEB || `${APP_URI}/user`;
const ENV = (process.env.ENV || process.env.NODE_ENV || 'development').toLowerCase();

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['zephyrex'],
  // The linked `zephyrex` framework ships raw source (not a built, typed
  // package); consuming it re-typechecks its internals, which carry pre-existing
  // type skew (e.g. auth pins a slightly older `next`). Ignore build-time type
  // errors outside development so this consumer's build is not gated on the
  // dependency; Zephyrex's own code is kept type-clean (`pnpm typecheck` in dev).
  // Next 16 removed the `eslint` config option (and `next lint`); ESLint runs via
  // the CLI now, so there is no build-time lint gate to configure here.
  typescript: {
    ignoreBuildErrors: ENV !== 'development',
  },
  // Keep file tracing scoped to this app; the surrounding directory is not a workspace.
  outputFileTracingRoot: __dirname,
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.APP_NAME || 'Open Teleprompt',
    NEXT_PUBLIC_APP_DESCRIPTION: process.env.APP_DESCRIPTION || 'An open source teleprompting software.',
    NEXT_PUBLIC_APP_URI: APP_URI,
    APP_URI,
    NEXT_PUBLIC_AUTH_SERVER: AUTH_SERVER,
    AUTH_SERVER,
    NEXT_PUBLIC_AUTH_URI: AUTH_WEB,
    AUTH_WEB,
    NEXT_PUBLIC_THEME_DEFAULT_MODE: process.env.DEFAULT_THEME_MODE || 'dark',
  },
  // Built with webpack (see the `--webpack` flag in package.json scripts):
  // Turbopack mis-resolves the npm-linked framework (source package living
  // outside this app dir) and its absolute-path aliases.
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      // Framework-internal alias -> linked package source.
      '@': ZEPHYREX_SRC,
      // This app's own alias.
      '~': path.resolve(__dirname, 'src'),
    };
    return config;
  },
};

module.exports = nextConfig;
