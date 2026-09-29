// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse, type NextRequest } from 'next/server';
import { apiErrorResponse } from '~/lib/apiErrors';
import { authenticate } from '~/lib/auth/session';
import { NextcloudConnector } from '../../NextcloudConnector';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await authenticate(request);

    const connector = new NextcloudConnector();
    const docs = await connector.listUserDocuments();

    return NextResponse.json(docs);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
