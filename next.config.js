// SPDX-License-Identifier: AGPL-3.0-or-later
// Env names follow the Zephyrex framework's (APP_URI / API_URI / AUTH_URI).
const APP_URI = process.env.APP_URI || 'http://localhost:6969';
// API origin + `/api`; clients append server-framework style `/v1/...` paths.
const API_URI = process.env.API_URI || `${APP_URI}/api`;
// Root of the framework's auth UI (login, OAuth close pages).
const AUTH_URI = process.env.AUTH_URI || `${APP_URI}/user`;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep file tracing scoped to this app; the surrounding directory is not a workspace.
  outputFileTracingRoot: __dirname,
  // Self-contained server bundle for the Containerfile's runtime stage.
  ...(process.env.NEXT_OUTPUT_STANDALONE ? { output: 'standalone' } : {}),
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.APP_NAME || 'Open Teleprompt',
    NEXT_PUBLIC_APP_DESCRIPTION: process.env.APP_DESCRIPTION || 'An open source teleprompting software.',
    NEXT_PUBLIC_APP_URI: APP_URI,
    APP_URI,
    NEXT_PUBLIC_API_URI: API_URI,
    API_URI,
    NEXT_PUBLIC_AUTH_URI: AUTH_URI,
    AUTH_URI,
    NEXT_PUBLIC_THEME_DEFAULT_MODE: process.env.DEFAULT_THEME_MODE || 'dark',
  },
};

module.exports = nextConfig;
