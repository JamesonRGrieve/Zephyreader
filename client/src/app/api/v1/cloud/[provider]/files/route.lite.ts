// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse, type NextRequest } from 'next/server';
import { apiErrorResponse, recordError } from '~/lib/apiErrors';
import { authenticate } from '~/lib/auth/session';
import { accessToken, delegatedProvider, listFiles, MAX_SEARCH_LENGTH } from '~/lib/googleDrive';

/** GET /v1/cloud/{provider}/files?folder=&search=: your readable files there (server-framework parity). */
export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }): Promise<NextResponse> {
  try {
    const user = await authenticate(request);
    delegatedProvider((await context.params).provider);
    const folder = request.nextUrl.searchParams.get('folder') ?? '';
    const search = request.nextUrl.searchParams.get('search');
    if (search !== null && search.length > MAX_SEARCH_LENGTH) {
      throw recordError(422, `search may be at most ${MAX_SEARCH_LENGTH} characters`);
    }
    return NextResponse.json({ files: await listFiles(await accessToken(user.id), folder, search) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
