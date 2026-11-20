// SPDX-License-Identifier: AGPL-3.0-or-later
import { createMiddleware } from 'zephyrex';
import appConfig from './zephyrex.config';

// The framework's auth middleware (session check against the configured API,
// private routes, invitation links) plus any extension-provided middleware. API and
// Next internals are excluded via the matcher so the app's own route handlers run
// unguarded and authenticate themselves, and so is the /healthz probe, which answers
// signed out.
export default createMiddleware(appConfig);

export const config = {
  matcher: ['/((?!api|healthz|_next/static|_next/image|favicon.ico).*)'],
};
