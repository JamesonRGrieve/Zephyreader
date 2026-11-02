// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MetadataRoute } from 'next';
import { APP_DESCRIPTION, APP_NAME, LIBRARY_PATH } from '~/zephyrex.config';

/** Installing Zephyreader from the browser: it opens on the script library, either way up. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    start_url: LIBRARY_PATH,
    display: 'standalone',
    orientation: 'any',
    background_color: '#0c0910',
    theme_color: '#0c0910',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
