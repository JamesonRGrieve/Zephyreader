// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse, type NextRequest } from 'next/server';
import { apiErrorResponse } from '~/lib/apiErrors';
import { authenticateSession, revokeSession } from '~/lib/auth/session';
import { clearSessionCookies } from '~/lib/auth/sessionCookies';

/**
 * POST /v1/user/logout (server-framework parity): revokes the session the
 * presented JWT belongs to (header, or the session cookie plus X-CSRF-Token),
 * clears both session cookies and returns 204. A missing, invalid, expired or
 * already-revoked token is a 401.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { sessionKey } = await authenticateSession(request);
    await revokeSession(sessionKey);
    const response = new NextResponse(null, { status: 204 });
    clearSessionCookies(response);
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
