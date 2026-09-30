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

const DEFAULT_PORT = 6969;

const config: ZephyrexConfig = {
  server: {
    // Same-origin: the browser calls `/api/v1/...` on this app (src/app/api/v1/*),
    // so the HttpOnly session cookie never leaves the origin.
    baseUrl: '/api',
    // Where this Next server reaches that same in-process API for the middleware's
    // session check. A fixed server-side address, never derived from the request.
    // `||`, not `??`: an empty API_UPSTREAM_URL= (as in .env.example) means "use the default".
    upstreamUrl: process.env.API_UPSTREAM_URL || `http://127.0.0.1:${process.env.PORT || DEFAULT_PORT}/api`,
  },
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME ?? 'Open Teleprompt',
    description: process.env.NEXT_PUBLIC_APP_DESCRIPTION ?? 'An open source teleprompting software.',
    defaultTheme: (process.env.NEXT_PUBLIC_THEME_DEFAULT_MODE as 'dark' | 'light') ?? 'dark',
  },
  auth: {
    authPath: '/user',
    // Google is the only sign-in: no email/password or magic-link accounts exist.
    authModes: { basic: false, magical: false },
    oauthProviders: ['google'],
    privateRoutes: (process.env.PRIVATE_ROUTES ?? '').split(',').filter(Boolean),
  },
  // The sidebar lists only what the app declares: the framework pages it mounts.
  navItems: [
    {
      title: 'Documentation',
      url: '/docs/api-reference',
      children: [
        { title: 'API Reference', url: '/docs/api-reference' },
        { title: 'Privacy Policy', url: '/docs/privacy' },
      ],
    },
  ],
  extensions: [teleprompterExtension],
};

export default config;
