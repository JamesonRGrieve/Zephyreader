// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse, type NextRequest } from 'next/server';
import verifyJWT from '../user/AuthProvider';

interface UserSession {
  clientID: string;
  isMain: boolean;
  sendMessage: (data: unknown) => void;
  disconnect: (reason: string) => void;
  heartbeat: Date;
}

const HEARTBEAT_TIMEOUT_SECONDS = 60;

// In-memory registry of live SSE sessions, keyed by user id. One user may drive
// several windows; exactly one is the "main" whose scroll position is mirrored
// to the followers.
const clients: Record<string, UserSession[]> = {};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await verifyJWT(request);
  const newClientID = request.nextUrl.searchParams.get('clientID') ?? '';
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const sessions = (clients[user.id] ??= []);
      if (sessions.some((client) => client.clientID === newClientID)) {
        console.error(`Client ${newClientID} already exists for user ${user.email}.`);
        return;
      }

      const toBeMain = !sessions.some((client) => client.isMain);
      const newClient: UserSession = {
        clientID: newClientID,
        isMain: toBeMain,
        sendMessage: (data) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)),
        disconnect: (reason) => {
          const list = clients[user.id] ?? [];
          const index = list.findIndex((session) => session.clientID === newClientID);
          if (index !== -1) list.splice(index, 1);
          try {
            controller.close();
          } catch {
            // Controller already closed by the runtime.
          }
          // Promote a new main window if the one that left was in control.
          if (list.length > 0 && !list.some((client) => client.isMain)) {
            const newMain = list[0];
            newMain.isMain = true;
            newMain.sendMessage({ main: newMain.clientID });
          }
        },
        heartbeat: new Date(),
      };

      sessions.push(newClient);
      const mainClient = sessions.find((client) => client.isMain);
      if (mainClient) newClient.sendMessage({ main: mainClient.clientID });
    },
    cancel() {
      const session = (clients[user.id] ?? []).find((client) => client.clientID === newClientID);
      session?.disconnect('client disconnected');
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await verifyJWT(request);
  const data = await request.json();
  const sessions = clients[user.id] ?? [];

  const mainClient = sessions.find((client) => client.isMain);
  const thisClient = sessions.find((client) => client.clientID === data.clientID);
  const now = new Date();

  const isFromMain = mainClient !== undefined && mainClient === thisClient;
  const carriesPayload = Object.keys(data).length > 1 || Object.keys(data)[0] !== 'clientID';

  if ((isFromMain && carriesPayload) || data.main) {
    if (data.main) {
      const promoted = sessions.find((client) => client.clientID === data.main);
      const current = sessions.find((client) => client.isMain);
      if (current) current.isMain = false;
      if (promoted) promoted.isMain = true;
    }
    for (const client of sessions) {
      client.sendMessage(data);
    }
  } else if (thisClient) {
    thisClient.heartbeat = now;
  }

  // Reap sessions whose heartbeat has gone stale.
  for (const client of [...sessions]) {
    if ((now.getTime() - client.heartbeat.getTime()) / 1000 >= HEARTBEAT_TIMEOUT_SECONDS) {
      client.disconnect('Heartbeat timeout.');
    }
  }

  return NextResponse.json({ success: true });
}
