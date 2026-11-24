// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * POST /api/waitlist: a place on the paid-plan waitlist, passed to Zephyrex's CRM as a lead
 * (src/lib/waitlistIntake.ts). On both variants, outside /api/v1 (which the SaaS build sends to
 * its back end); a deployment that names no intake (WAITLIST_WEB_FORM unset, as on lite) answers 404.
 *
 * Signed out is fine, so instead of the session's CSRF token the request must come from this
 * app's own pages (its Origin), and it is rate-limited per visitor and overall.
 */
import { NextResponse } from 'next/server';
import { intakeConfig, IntakeError, submitLead, WaitlistEntrySchema, WindowLimiter } from '~/lib/waitlistIntake';

const MAX_BODY_BYTES = 8 * 1024;
const HOUR_MS = 60 * 60 * 1000;
const perVisitor = new WindowLimiter(5, HOUR_MS);
const overall = new WindowLimiter(200, HOUR_MS);

const problem = (status: number, detail: string) => NextResponse.json({ detail }, { status });

/** The visitor's address as the edge in front of this server saw it (the last hop it added). */
function visitor(request: Request): string {
  const hops = (request.headers.get('x-forwarded-for') ?? '').split(',').map((hop) => hop.trim());
  return hops.at(-1) || 'unknown';
}

/** Whether the request came from this app's own pages. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const own = process.env.APP_URI ? new URL(process.env.APP_URI).origin : new URL(request.url).origin;
  return origin === own;
}

export async function POST(request: Request): Promise<NextResponse> {
  const config = intakeConfig();
  if (config === undefined) return problem(404, 'This server has no waitlist');
  if (!sameOrigin(request)) return problem(403, 'Join the waitlist from the plans page');
  if (!perVisitor.take(visitor(request)) || !overall.take('*')) {
    return problem(429, 'Too many signups just now; try again later');
  }
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) return problem(413, 'Request body too large');
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return problem(413, 'Request body too large');

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return problem(400, 'The request body is not JSON');
  }
  const entry = WaitlistEntrySchema.safeParse(body);
  if (!entry.success) return problem(422, 'Check the email address and try again');

  try {
    await submitLead(entry.data, config);
  } catch (error) {
    if (!(error instanceof IntakeError)) throw error;
    console.error(`waitlist: ${error.message}`);
    return problem(502, "The waitlist couldn't be reached; try again later");
  }
  return new NextResponse(null, { status: 204 });
}
