// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ZephyrexClientExtension, ZephyrexConfig } from 'zephyrex';
import { ZephyreaderLogo } from './brand/ZephyreaderLogo';

/** Where a signed-in person works: the script library. `/` is the landing page for visitors. */
export const LIBRARY_PATH = '/scripts';

/** Plans: paid plans are waitlist-only, so every "See plans" leads to the waitlist here. */
export const PLANS_PATH = '/plans';

/** The app's pages, which need a signed-in user (matched as path prefixes). */
const APP_ROUTES = [LIBRARY_PATH, '/script/', '/present/', '/remote', '/recordings', '/settings'];

/**
 * Zephyreader's pages: the script library (`/scripts`), the editor (`/script/[id]`), the
 * prompter (`/present/[id]`), the phone remote, recordings and prompter settings. The
 * extension only contributes their navigation; the pages live under src/app.
 *
 * The config is imported on the client (app/Providers.tsx) and by the server's
 * middleware, so it may carry components (the logo).
 */
const teleprompterExtension: ZephyrexClientExtension = {
  name: 'teleprompter',
  displayName: 'Teleprompter',
  description: 'Write, import and present scripts on a teleprompter that follows your voice.',
  navItems: [
    { title: 'Scripts', url: LIBRARY_PATH },
    { title: 'Remote control', url: '/remote' },
    { title: 'Recordings', url: '/recordings' },
    { title: 'Prompter settings', url: '/settings' },
  ],
};

const DEFAULT_PORT = 6969;

export const APP_NAME = 'Zephyreader';
export const APP_DESCRIPTION = 'A teleprompter that follows your voice, on every screen you own.';

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
    name: APP_NAME,
    description: APP_DESCRIPTION,
    logo: ZephyreaderLogo,
    defaultTheme: (process.env.NEXT_PUBLIC_THEME_DEFAULT_MODE as 'dark' | 'light') ?? 'dark',
    // Never send a signed-in user's email hash to Gravatar: no request leaves for a third party.
    gravatar: false,
    // Every upgrade prompt's "See plans": the waitlist, not a checkout (no plan is on sale yet).
    plans: PLANS_PATH,
  },
  auth: {
    authPath: '/user',
    // Signing in lands on the script library, not the account page.
    home: LIBRARY_PATH,
    // What the account page says deleting an account takes with it (the server erases it first).
    deletionNote:
      'Your scripts, folders, prompter settings and recordings are deleted with your account, and you are signed out. This cannot be undone.',
    // Google is the only sign-in: no password accounts, and no magic-link extension
    // (@zephyrex/auth-magic-link) is registered, so magic links stay off too.
    authModes: { basic: false },
    oauthProviders: ['google'],
    // The app's pages, and any more the deployment names.
    privateRoutes: [...APP_ROUTES, ...(process.env.PRIVATE_ROUTES ?? '').split(',').filter(Boolean)],
  },
  // The sidebar lists only what the app declares: the framework pages it mounts.
  navItems: [
    {
      title: 'Documentation',
      url: '/docs/privacy',
      children: [{ title: 'Privacy Policy', url: '/docs/privacy' }],
    },
  ],
  extensions: [teleprompterExtension],
};

export default config;
