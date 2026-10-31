// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse, type NextRequest } from 'next/server';
import { ApiError, apiErrorResponse } from '~/lib/apiErrors';
import { authenticate } from '~/lib/auth/session';
import { NextcloudConnector } from '../NextcloudConnector';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await authenticate(request);

    const documentPath = request.nextUrl.searchParams.get('id');
    if (!documentPath) throw new ApiError(400, 'Missing document id');

    const connector = new NextcloudConnector();
    const documentBody = await connector.getUserDocumentMarkdown(documentPath);

    return NextResponse.json(documentBody);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
