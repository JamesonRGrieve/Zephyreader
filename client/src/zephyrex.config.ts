// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ZephyrexClientExtension, ZephyrexConfig } from 'zephyrex';

/**
 * Zephyreader's pages: the script library (`/`), the editor (`/script/[id]`), the
 * prompter (`/present/[id]`), the phone remote, recordings and prompter settings. The
 * extension only contributes their navigation; the pages live under src/app.
 *
 * The config is imported by the (server) root layout and passed as a prop to
 * the client `ZephyrexApp`, so every value here must be serializable — no
 * component/function values (e.g. nav `icon`s).
 */
const teleprompterExtension: ZephyrexClientExtension = {
  name: 'teleprompter',
  displayName: 'Teleprompter',
  description: 'Write, import and present scripts on a teleprompter that follows your voice.',
  navItems: [
    { title: 'Scripts', url: '/' },
    { title: 'Remote control', url: '/remote' },
    { title: 'Recordings', url: '/recordings' },
    { title: 'Prompter settings', url: '/settings' },
  ],
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
    // Never send a signed-in user's email hash to Gravatar: no request leaves for a third party.
    gravatar: false,
  },
  auth: {
    authPath: '/user',
    // Signing in lands on the script library, not the account page.
    home: '/',
    // Google is the only sign-in: no password accounts, and no magic-link extension
    // (@zephyrex/auth-magic-link) is registered, so magic links stay off too.
    authModes: { basic: false },
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
