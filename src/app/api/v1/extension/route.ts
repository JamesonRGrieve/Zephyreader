// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse, type NextRequest } from 'next/server';
import { apiErrorResponse } from '~/lib/apiErrors';
import { authenticate } from '~/lib/auth/session';

/**
 * GET /v1/extension (server-framework parity, AuthType.JWT): the server-side
 * extensions this API exposes. The app bundles none, so a signed-in caller gets
 * an empty list; an anonymous one gets the usual 401.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await authenticate(request);
    return NextResponse.json({ extensions: [] });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
