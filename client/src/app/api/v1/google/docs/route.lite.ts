// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse, type NextRequest } from 'next/server';
import { ApiError, apiErrorResponse } from '~/lib/apiErrors';
import { authenticate } from '~/lib/auth/session';
import { GoogleDrive } from '../GoogleConnector';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await authenticate(request);

    const documentID = request.nextUrl.searchParams.get('id');
    if (!documentID) throw new ApiError(400, 'Missing document id');

    return NextResponse.json(await new GoogleDrive(user.id).documentMarkdown(documentID));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
