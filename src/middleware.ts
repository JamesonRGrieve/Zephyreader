// SPDX-License-Identifier: AGPL-3.0-or-later
import { createMiddleware } from 'zephyrex';
import appConfig from './zephyrex.config';

// The framework wires the built-in auth hooks (OAuth2, JWT query param, session)
// and any extension-provided middleware. API and Next internals are excluded via
// the matcher below so the teleprompter's own route handlers run unguarded.
export default createMiddleware({ extensions: appConfig.extensions });

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
