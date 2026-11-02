// SPDX-License-Identifier: AGPL-3.0-or-later
import { type NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse, recordError } from '~/lib/apiErrors';
import { authenticate } from '~/lib/auth/session';
import { hub, KEEPALIVE_MS, MAX_LABEL_LENGTH, validName, type LiveSink } from '~/lib/liveSync';

const encoder = new TextEncoder();

/** GET /v1/live/{channel}/events?client_id=&label=: join the channel and stream its messages. */
export async function GET(request: NextRequest, context: { params: Promise<{ channel: string }> }): Promise<Response> {
  try {
    const user = await authenticate(request);
    const channel = validName((await context.params).channel, 'channel');
    const clientId = validName(request.nextUrl.searchParams.get('client_id'), 'client_id');
    const label = request.nextUrl.searchParams.get('label');
    if (label !== null && label.length > MAX_LABEL_LENGTH) {
      throw recordError(422, `label may be at most ${MAX_LABEL_LENGTH} characters`);
    }
    let keepalive: ReturnType<typeof setInterval> | null = null;
    let closed = false;
    let sink: LiveSink | null = null;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const close = (): void => {
          if (closed) return;
          closed = true;
          if (keepalive !== null) clearInterval(keepalive);
          if (sink !== null) hub.leave(user.id, channel, clientId, sink);
          controller.close();
        };
        controller.enqueue(encoder.encode(': connected\n\n'));
        sink = {
          push(frame) {
            if (closed) return true;
            controller.enqueue(encoder.encode(frame));
            return (controller.desiredSize ?? 1) > 0;
          },
          close,
        };
        hub.join(user.id, channel, clientId, label, sink);
        keepalive = setInterval(() => controller.enqueue(encoder.encode(': keepalive\n\n')), KEEPALIVE_MS);
        request.signal.addEventListener('abort', close);
      },
      cancel() {
        closed = true;
        if (keepalive !== null) clearInterval(keepalive);
        if (sink !== null) hub.leave(user.id, channel, clientId, sink);
      },
    });
    return new Response(stream, {
      // As the framework's streams (zephyrex.lib.EventStream): no proxy compresses, buffers or caches it.
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' },
    });
  } catch (error) {
    return apiErrorResponse(error) satisfies NextResponse;
  }
}
