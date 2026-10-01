// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse, type NextRequest } from 'next/server';
import { apiErrorResponse } from '~/lib/apiErrors';
import { authenticate } from '~/lib/auth/session';

/**
 * GET /v1/team (server-framework parity, `{ teams: [...] }`): the caller's teams.
 * The app has no teams, so a signed-in caller gets an empty list; anonymous is 401.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await authenticate(request);
    return NextResponse.json({ teams: [] });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
