// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse, type NextRequest } from 'next/server';
import { apiErrorResponse } from '~/lib/apiErrors';
import { oauthLogin } from '~/lib/auth/oauth';
import { optionalString, readJsonObject, requiredString } from '~/lib/requestBody';
import { setBindingCookie } from '../bindingCookie';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await readJsonObject(request);
    const { authorizeUrl, state, binding } = await oauthLogin.beginAuthorize(
      requiredString(body, 'provider'),
      optionalString(body, 'redirect_uri'),
    );

    const response = NextResponse.json({ authorize_url: authorizeUrl, state });
    setBindingCookie(request, response, binding);
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
