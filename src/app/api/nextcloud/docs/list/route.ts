import { NextRequest, NextResponse } from 'next/server';
import verifyJWT from '../../../../../../app/api/v1/user/AuthProvider';
import { NextcloudConnector } from '../../NextcloudConnector';

export async function GET(request: NextRequest) {
  try {
    await verifyJWT(request);

    const connector = new NextcloudConnector();
    const docs = await connector.listUserDocuments();

    return NextResponse.json(docs);
  } catch (error) {
    console.error('Error listing Nextcloud documents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
