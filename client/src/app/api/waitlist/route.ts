// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * POST /api/waitlist: a place on the waitlist, handed to Zephyrex's CRM as a lead by
 * @zephyrex/marketing's createWaitlistRoute (its checks, limits and answers). On both variants,
 * outside /api/v1 (which the SaaS build sends to its back end). A deployment that names no web
 * form (lite) answers 404.
 *
 * Signed out is fine, so instead of the session's CSRF token the request must come from this
 * app's own pages (its Origin).
 */
import { createWaitlistRoute } from '@zephyrex/marketing';
import { NextResponse } from 'next/server';
import { WAITLIST_INTERESTS, waitlistSettings } from '~/lib/waitlist';
import { APP_NAME } from '~/zephyrex.config';

const refusal = (status: number, message: string) => NextResponse.json({ detail: { message } }, { status });

/** One route per web form (in practice one), so its rate limits hold across requests. */
const routes = new Map<string, ReturnType<typeof createWaitlistRoute>>();

/** Whether the request came from this app's own pages. */
function sameOrigin(request: Request): boolean {
  const own = process.env.APP_URI ? new URL(process.env.APP_URI).origin : new URL(request.url).origin;
  return request.headers.get('origin') === own;
}

export async function POST(request: Request): Promise<Response> {
  const settings = waitlistSettings();
  if (settings === undefined) return refusal(404, 'This server has no waitlist.');
  if (!sameOrigin(request)) return refusal(403, 'Join the waitlist from the plans page.');
  const key = `${settings.webForm} ${settings.erpOrigin ?? ''}`;
  let route = routes.get(key);
  if (route === undefined) {
    route = createWaitlistRoute({
      ...settings,
      app: APP_NAME,
      enquiry: 'accounts and paid plans',
      interests: WAITLIST_INTERESTS,
    });
    routes.set(key, route);
  }
  return route.POST(request);
}
