// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse, type NextRequest } from 'next/server';
import { apiErrorResponse } from '~/lib/apiErrors';
import { authenticate } from '~/lib/auth/session';

/**
 * The server-side extensions this API serves, as server-framework lists its own
 * (`GET /v1/extension`, signed in). The UI turns a feature on when the extension
 * serving it is listed, so lite lists exactly what its own routes answer; the AI,
 * recording, payment and team features stay off because their extensions are absent.
 */
export const LITE_EXTENSIONS = [
  { id: 'lite-oauth_consumer', name: 'oauth_consumer', friendly_name: 'OAuth sign-in', description: 'Sign in with Google' },
  {
    id: 'lite-teleprompter',
    name: 'teleprompter',
    friendly_name: 'Teleprompter',
    description: 'Scripts, folders and prompter settings',
  },
  {
    id: 'lite-live_sync',
    name: 'live_sync',
    friendly_name: 'Live sync',
    description: "Real-time messages between a user's own devices",
  },
  {
    id: 'lite-cloud',
    name: 'cloud',
    friendly_name: 'Cloud files',
    description: "Your own Google Drive's Docs and text files",
  },
] as const;

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await authenticate(request);
    return NextResponse.json({ extensions: LITE_EXTENSIONS });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
