import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse } from '~/lib/apiErrors';
import verifyJWT from '../../user/AuthProvider';
import { NextcloudConnector } from '../NextcloudConnector';

export async function GET(request: NextRequest) {
  try {
    await verifyJWT(request);

    const documentPath = request.nextUrl.searchParams.get('id');
    if (!documentPath) {
      return NextResponse.json({ error: 'Missing document id' }, { status: 400 });
    }

    const connector = new NextcloudConnector();
    const documentBody = await connector.getUserDocumentMarkdown(documentPath);

    return NextResponse.json(documentBody);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
