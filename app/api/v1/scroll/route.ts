import { NextRequest, NextResponse } from 'next/server';
import verifyJWT from '../user/AuthProvider';

interface UserSession {
  isMain: boolean;
  clientID: string;
  sendMessage: (data: any) => void;
  heartbeat: Date;
}

type ClientRegistry = Record<string, UserSession[]>;

const clients: ClientRegistry = {};

export async function GET(request: NextRequest) {
  const user = await verifyJWT(request);
  const clientID = request.nextUrl.searchParams.get('clientID');
  if (!clientID) {
    return NextResponse.json({ error: 'Missing clientID' }, { status: 400 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const toBeMain = !clients[user.id] || !clients[user.id].find((client) => client.isMain);
      if (clients[user.id]?.some((client) => client.clientID === clientID)) {
        console.error('This client already exists!!!');
        return;
      }

      const newClient: UserSession = {
        clientID,
        isMain: toBeMain,
        sendMessage: (data: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        },
        heartbeat: new Date(),
      };

      if (!clients[user.id]) {
        clients[user.id] = [];
      }

      clients[user.id].push(newClient);
      const mainClient = clients[user.id].find((client) => client.isMain);
      if (mainClient) {
        newClient.sendMessage({ main: mainClient.clientID });
      }
    },
    cancel(reason) {
      const userClients = clients[user.id] ?? [];
      const index = userClients.findIndex((session) => session.clientID === clientID);
      if (index !== -1) {
        userClients.splice(index, 1);
      }

      if (userClients.length && userClients.findIndex((client) => client.isMain) === -1) {
        const newMain = userClients[0];
        newMain.isMain = true;
        newMain.sendMessage({ main: newMain.clientID });
      }
    },
  });

  console.log(`New connection established for user ${user.email}, total: ${clients[user.id].length}.`);
  console.log(`Total active connections: ${Object.values(clients).flat().length}`);

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

export async function POST(request: Request | NextRequest) {
  const user = await verifyJWT(request);
  const data = await request.json();
  const userClients = clients[user.id] ?? [];
  if (!userClients.length) {
    return NextResponse.json({ error: 'No active clients registered for user.' }, { status: 404 });
  }

  const mainClient = userClients.find((client) => client.isMain);
  const thisClient = userClients.find((client) => client.clientID === data.clientID);
  const now = new Date();

  if (!thisClient) {
    return NextResponse.json({ error: 'Client not registered' }, { status: 404 });
  }

  const hasPayloadBeyondHeartbeat = Object.keys(data).some((key) => key !== 'clientID');
  if ((mainClient && mainClient.clientID === thisClient.clientID && hasPayloadBeyondHeartbeat) || data.main) {
    if (data.main) {
      const newMain = userClients.find((client) => client.clientID === data.main);
      if (newMain && mainClient) {
        mainClient.isMain = false;
        newMain.isMain = true;
      }
    }
    for (const client of userClients) {
      client.sendMessage(data);
    }
  } else {
    thisClient.heartbeat = now;
  }

  for (const client of userClients) {
    if ((now.getTime() - client.heartbeat.getTime()) / 1000 >= 60) {
      client.sendMessage({ main: null });
    }
  }
  return NextResponse.json({ success: true });
}
