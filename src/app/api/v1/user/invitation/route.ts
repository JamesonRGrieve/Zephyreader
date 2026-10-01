// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse, type NextRequest } from 'next/server';
import { apiErrorResponse } from '~/lib/apiErrors';
import { authenticate } from '~/lib/auth/session';

/**
 * GET /v1/user/invitation (server-framework parity, `{ invitations: [...] }`): team
 * invitations addressed to the caller. The app has no teams, so there are none.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await authenticate(request);
    return NextResponse.json({ invitations: [] });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
