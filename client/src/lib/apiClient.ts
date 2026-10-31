// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Same-origin API prefix. The browser session rides in the HttpOnly
 * `zx_session` cookie, which the browser only sends to this origin, so requests
 * are relative by construction (an absolute URL behind a proxy would silently
 * become cross-origin and drop the session). Session state and CSRF headers come
 * from the framework: `useHasSession` (zephyrex) and `csrfHeaders`
 * (@zephyrex/auth/lib/session).
 */
const API_BASE = '/api';

export function apiUrl(path: `/v1/${string}`): string {
  return `${API_BASE}${path}`;
}
