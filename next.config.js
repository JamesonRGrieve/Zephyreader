// SPDX-License-Identifier: AGPL-3.0-or-later
// Public origin of the app (the OAuth redirect base). The API and auth paths come
// from src/zephyrex.config.ts, not from env.
const APP_URI = process.env.APP_URI || 'http://localhost:6969';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep file tracing scoped to this app; the surrounding directory is not a workspace.
  outputFileTracingRoot: __dirname,
  // Self-contained server bundle for the Containerfile's runtime stage.
  ...(process.env.NEXT_OUTPUT_STANDALONE ? { output: 'standalone' } : {}),
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.APP_NAME || 'Open Teleprompt',
    NEXT_PUBLIC_APP_DESCRIPTION: process.env.APP_DESCRIPTION || 'An open source teleprompting software.',
    APP_URI,
    NEXT_PUBLIC_THEME_DEFAULT_MODE: process.env.DEFAULT_THEME_MODE || 'dark',
  },
};

module.exports = nextConfig;
