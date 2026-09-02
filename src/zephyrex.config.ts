// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ZephyrexClientExtension, ZephyrexConfig } from 'zephyrex';

/**
 * OpenTeleprompt registers a single nav entry for its home surface. The
 * teleprompter itself is served by the app root (`src/app/page.tsx`) inside the
 * framework shell, so this extension only contributes navigation.
 *
 * The config is imported by the (server) root layout and passed as a prop to
 * the client `ZephyrexApp`, so every value here must be serializable — no
 * component/function values (e.g. nav `icon`s).
 */
const teleprompterExtension: ZephyrexClientExtension = {
  name: 'teleprompter',
  displayName: 'Teleprompter',
  description: 'Present Google Docs and Nextcloud documents as a synced teleprompter.',
  navItems: [{ title: 'Teleprompter', url: '/' }],
};

const config: ZephyrexConfig = {
  server: {
    baseUrl: process.env.NEXT_PUBLIC_AUTH_SERVER ?? 'http://localhost:6969/api/v1',
  },
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME ?? 'Open Teleprompt',
    description: process.env.NEXT_PUBLIC_APP_DESCRIPTION ?? 'An open source teleprompting software.',
    defaultTheme: (process.env.NEXT_PUBLIC_THEME_DEFAULT_MODE as 'dark' | 'light') ?? 'dark',
  },
  auth: {
    privateRoutes: (process.env.PRIVATE_ROUTES ?? '/settings,/team').split(','),
  },
  extensions: [teleprompterExtension],
};

export default config;
