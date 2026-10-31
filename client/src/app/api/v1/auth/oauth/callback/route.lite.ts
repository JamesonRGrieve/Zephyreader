// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse, type NextRequest } from 'next/server';
import { apiErrorResponse } from '~/lib/apiErrors';
import { oauthLogin } from '~/lib/auth/oauth';
import { setSessionCookies } from '~/lib/auth/sessionCookies';
import { optionalString, readJsonObject, requiredString } from '~/lib/requestBody';
import { clearBindingCookie, OAUTH_BINDING_COOKIE } from '../bindingCookie';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await readJsonObject(request);
    const session = await oauthLogin.completeCallback({
      provider: requiredString(body, 'provider'),
      code: requiredString(body, 'code'),
      state: requiredString(body, 'state'),
      redirectUri: optionalString(body, 'redirect_uri'),
      binding: request.cookies.get(OAUTH_BINDING_COOKIE)?.value,
    });

    const response = NextResponse.json({
      session_key: session.sessionKey,
      user_id: session.userId,
      grant_type: session.grantType,
      expires_at: session.expiresAt.toISOString(),
      token: session.token,
    });
    clearBindingCookie(response);
    // A browser login: the session rides in HttpOnly cookies (the body keeps `token` for API clients).
    setSessionCookies(response, session.token);
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
