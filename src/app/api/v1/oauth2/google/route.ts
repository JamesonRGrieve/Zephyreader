// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse, type NextRequest } from 'next/server';
import { apiErrorResponse } from '~/lib/apiErrors';
import { GoogleOAuth } from '../../google/GoogleConnector';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { code } = (await request.json()) as { code?: string };
    if (!code) {
      return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
    }

    const result = await new GoogleOAuth().callback(code);

    return NextResponse.json({
      detail: result.magic_link,
      email: result.email,
      token: result.token,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
