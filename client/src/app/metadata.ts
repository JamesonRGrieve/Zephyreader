// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata, Viewport } from 'next';
import { APP_DESCRIPTION, APP_NAME } from '~/zephyrex.config';

/** The browser chrome around the page, in the theme's light and dark backgrounds (zephyrex.css --background). */
const LIGHT_BACKGROUND = '#f1eff6';
const DARK_BACKGROUND = '#0c0910';

// The tab icon: public/icon-16.svg, a cut built for 16 px so the amber line stays amber, and
// public/icon.svg for every larger size (Logo Design, 2026-11-24). Both live in public/ because Next's
// file-based app/icon.svg is always sizes=any and overrides these. The install manifest is app/manifest.ts.
export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  icons: {
    icon: [
      { url: '/icon-16.svg', sizes: '16x16', type: 'image/svg+xml' },
      { url: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  },
  appleWebApp: { title: APP_NAME, statusBarStyle: 'black-translucent', capable: true },
};

// People can zoom: a prompter is read from a distance, and pinch-zoom is how many read small text.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: LIGHT_BACKGROUND },
    { media: '(prefers-color-scheme: dark)', color: DARK_BACKGROUND },
  ],
};
