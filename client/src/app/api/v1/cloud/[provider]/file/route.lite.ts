// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse, type NextRequest } from 'next/server';
import { apiErrorResponse, ApiError } from '~/lib/apiErrors';
import { authenticate } from '~/lib/auth/session';
import { accessToken, delegatedProvider, readFile } from '~/lib/googleDrive';

/** GET /v1/cloud/{provider}/file?path=: one of your files there, as text (server-framework parity). */
export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }): Promise<NextResponse> {
  try {
    const user = await authenticate(request);
    delegatedProvider((await context.params).provider);
    const path = request.nextUrl.searchParams.get('path');
    if (path === null) throw new ApiError(422, "Missing required query parameter 'path'");
    return NextResponse.json({ file: await readFile(await accessToken(user.id), path) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
