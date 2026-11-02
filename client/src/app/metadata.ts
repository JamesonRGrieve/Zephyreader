// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata, Viewport } from 'next';
import { APP_DESCRIPTION, APP_NAME } from '~/zephyrex.config';

/** The browser chrome around the page, in the theme's light and dark backgrounds (zephyrex.css --background). */
const LIGHT_BACKGROUND = '#f1eff6';
const DARK_BACKGROUND = '#0c0910';

// The tab icon is app/icon.svg and the install manifest app/manifest.ts; Next links both.
export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
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
