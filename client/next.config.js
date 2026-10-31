// SPDX-License-Identifier: AGPL-3.0-or-later
// Public origin of the app (the OAuth redirect base). The API and auth paths come
// from src/zephyrex.config.ts, not from env.
const APP_URI = process.env.APP_URI || 'http://localhost:6969';

// Which backend answers /api/v1/*. The UI is the same either way: it only ever
// calls the same-origin /api, so switching variants is a build-time config change.
//   lite (default): the app's own `route.lite.ts` handlers (self-hosted, Next.js only).
//   saas:           server/ (the zephyrex server framework), reached through a proxy.
const VARIANTS = ['lite', 'saas'];
const VARIANT = process.env.ZEPHYREADER_VARIANT || 'lite';
if (!VARIANTS.includes(VARIANT)) {
  throw new Error(`ZEPHYREADER_VARIANT must be one of ${VARIANTS.join(', ')}, got "${VARIANT}"`);
}
const IS_LITE = VARIANT === 'lite';

// The framework server the SaaS build proxies to (server-side only, never sent to
// the browser). Its routes live at /v1/*, so /api/v1/x maps to ${SERVER_URI}/v1/x.
const SERVER_URI = process.env.ZEPHYREADER_SERVER_URI || 'http://127.0.0.1:6970';

const DEFAULT_PAGE_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js'];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep file tracing scoped to this app; the surrounding directory is not a workspace.
  outputFileTracingRoot: __dirname,
  // Lets the e2e suite build beside a running dev server without sharing its output.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Self-contained server bundle for the Containerfile's runtime stage.
  ...(process.env.NEXT_OUTPUT_STANDALONE ? { output: 'standalone' } : {}),
  // `route.lite.ts` is a route only in the lite build; the SaaS build never sees it.
  pageExtensions: IS_LITE ? ['lite.ts', ...DEFAULT_PAGE_EXTENSIONS] : DEFAULT_PAGE_EXTENSIONS,
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.APP_NAME || 'Open Teleprompt',
    NEXT_PUBLIC_APP_DESCRIPTION: process.env.APP_DESCRIPTION || 'An open source teleprompting software.',
    NEXT_PUBLIC_ZEPHYREADER_VARIANT: VARIANT,
    APP_URI,
    NEXT_PUBLIC_THEME_DEFAULT_MODE: process.env.DEFAULT_THEME_MODE || 'dark',
  },
  async rewrites() {
    if (IS_LITE) {
      return [];
    }
    // beforeFiles, so the app-root [...slug] catch-all page never claims an API path.
    return { beforeFiles: [{ source: '/api/v1/:path*', destination: `${SERVER_URI}/v1/:path*` }] };
  },
};

module.exports = nextConfig;
