// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse, type NextRequest } from 'next/server';
import { apiErrorResponse } from '~/lib/apiErrors';
import verifyJWT from '../../user/AuthProvider';
import { GoogleOAuth } from '../GoogleConnector';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await verifyJWT(request);

    const documentID = request.nextUrl.searchParams.get('id');
    if (!documentID) {
      return NextResponse.json({ error: 'Missing document id' }, { status: 400 });
    }

    return NextResponse.json(await new GoogleOAuth().getUserDocumentMarkdown(user.email, documentID));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
