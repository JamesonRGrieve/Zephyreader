import { NextRequest, NextResponse } from 'next/server';
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
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
