// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The health probe for the edge and the launch gate: 204, never cached. A plain route, so it is
 * in both builds (lite and SaaS), and outside the auth proxy's matcher, so it answers signed out.
 */
export const dynamic = 'force-dynamic';

export function GET(): Response {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
