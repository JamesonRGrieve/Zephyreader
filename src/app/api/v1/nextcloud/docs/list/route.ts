import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse } from '~/lib/apiErrors';
import verifyJWT from '../../../user/AuthProvider';
import { NextcloudConnector } from '../../NextcloudConnector';

export async function GET(request: NextRequest) {
  try {
    await verifyJWT(request);

    const connector = new NextcloudConnector();
    const docs = await connector.listUserDocuments();

    return NextResponse.json(docs);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
