import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse } from '~/lib/apiErrors';
import { GoogleOAuth } from '../GoogleConnector';
import verifyJWT from '../../user/AuthProvider';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyJWT(request);

    const google = new GoogleOAuth();

    const documentID = request.nextUrl.searchParams.get('id');
    if (!documentID) {
      return NextResponse.json({ error: 'Missing document id' }, { status: 400 });
    }

    const documentBody = await google.getUserDocumentMarkdown(user.email, documentID);

    //console.log(documentBody);

    return NextResponse.json(documentBody);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
