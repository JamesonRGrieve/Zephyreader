// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse, type NextRequest } from 'next/server';
import { apiErrorResponse, recordError } from '~/lib/apiErrors';
import { authenticate } from '~/lib/auth/session';
import { CLAIM_TYPE, hub, validName, validPost } from '~/lib/liveSync';
import { readJsonObject } from '~/lib/requestBody';

/** POST /v1/live/{channel} {client_id, type, data}: to your other devices; `claim` takes control. */
export async function POST(request: NextRequest, context: { params: Promise<{ channel: string }> }): Promise<NextResponse> {
  try {
    const user = await authenticate(request);
    const channel = validName((await context.params).channel, 'channel');
    const post = validPost(await readJsonObject(request));
    if (!hub.isConnected(user.id, channel, post.clientId)) {
      throw recordError(409, 'Join the channel before sending to it');
    }
    if (post.type === CLAIM_TYPE) {
      hub.claim(user.id, channel, post.clientId);
    } else {
      hub.publish(user.id, channel, { type: post.type, sender: post.clientId, data: post.data });
    }
    return NextResponse.json({ delivered: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
