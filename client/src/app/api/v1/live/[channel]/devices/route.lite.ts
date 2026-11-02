// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse, type NextRequest } from 'next/server';
import { apiErrorResponse } from '~/lib/apiErrors';
import { authenticate } from '~/lib/auth/session';
import { hub, validName } from '~/lib/liveSync';

/** GET /v1/live/{channel}/devices: your devices on the channel, and which is main. */
export async function GET(request: NextRequest, context: { params: Promise<{ channel: string }> }): Promise<NextResponse> {
  try {
    const user = await authenticate(request);
    const channel = validName((await context.params).channel, 'channel');
    return NextResponse.json({ devices: hub.devices(user.id, channel) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
