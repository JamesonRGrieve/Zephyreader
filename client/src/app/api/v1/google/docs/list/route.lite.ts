// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse, type NextRequest } from 'next/server';
import { apiErrorResponse } from '~/lib/apiErrors';
import { authenticate } from '~/lib/auth/session';
import { GoogleDrive } from '../../GoogleConnector';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await authenticate(request);

    return NextResponse.json(await new GoogleDrive(user.id).listDocuments());
  } catch (error) {
    return apiErrorResponse(error);
  }
}
