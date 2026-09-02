import { NextRequest, NextResponse } from 'next/server';
import { GoogleOAuth } from '../../google/GoogleConnector';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    const google = new GoogleOAuth();
    const result = await google.callback(code);

    return NextResponse.json({
      detail: result.magic_link,
      email: result.email,
      token: result.token,
    });
  } catch (error) {
    console.error('OAuth login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
