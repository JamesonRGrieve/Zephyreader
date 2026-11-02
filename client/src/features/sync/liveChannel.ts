// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * One device's connection to a live-sync channel (`/v1/live/{channel}`, served by the
 * lite routes or the framework's live_sync extension alike): it streams the channel's
 * messages and sends its own. The browser's session cookie authenticates both; sends
 * carry the CSRF token like every other write.
 */
import { csrfHeaders } from '@zephyrex/auth/lib/session';
import { z } from 'zod';

export const PRESENCE = 'presence';
export const CLAIM = 'claim';
/** A remote control names itself with this, so a display never follows it. */
export const REMOTE_LABEL_PREFIX = 'Remote · ';

/** Whether a display should take the lead: a remote is leading (a remote never scrolls anything). */
export function displayShouldLead(devices: readonly { label: string | null; main: boolean }[]): boolean {
  return devices.some((device) => device.main && (device.label ?? '').startsWith(REMOTE_LABEL_PREFIX));
}

export const liveDeviceSchema = z.object({
  client_id: z.string(),
  label: z.string().nullable(),
  main: z.boolean(),
  connected: z.boolean(),
});
export type LiveDevice = z.infer<typeof liveDeviceSchema>;

const messageSchema = z.object({ type: z.string(), sender: z.string(), data: z.unknown() });
export type LiveMessage = z.infer<typeof messageSchema>;
const presenceSchema = z.object({ devices: z.array(liveDeviceSchema) });

export interface LiveChannelHandlers {
  onMessage: (message: LiveMessage) => void;
  onDevices: (devices: LiveDevice[]) => void;
  onConnection?: (connected: boolean) => void;
}

/** A per-tab device id, kept for the tab's life so a reload rejoins as the same device. */
export function deviceId(storage: Pick<Storage, 'getItem' | 'setItem'> | null, random: () => string): string {
  const key = 'zephyreader.device';
  try {
    const known = storage?.getItem(key);
    if (known !== null && known !== undefined && /^[A-Za-z0-9_-]{1,64}$/.test(known)) return known;
    const made = random()
      .replace(/[^A-Za-z0-9_-]/g, '')
      .slice(0, 32);
    storage?.setItem(key, made);
    return made;
  } catch {
    return random()
      .replace(/[^A-Za-z0-9_-]/g, '')
      .slice(0, 32);
  }
}

export class LiveChannel {
  private source: EventSource | null = null;

  constructor(
    private readonly baseUrl: string,
    readonly channel: string,
    readonly clientId: string,
    private readonly label: string,
  ) {}

  private path(suffix = ''): string {
    return `${this.baseUrl}/v1/live/${encodeURIComponent(this.channel)}${suffix}`;
  }

  open(handlers: LiveChannelHandlers): void {
    this.close();
    const query = new URLSearchParams({ client_id: this.clientId, label: this.label });
    const source = new EventSource(`${this.path('/events')}?${query.toString()}`);
    source.addEventListener('open', () => handlers.onConnection?.(true));
    source.addEventListener('error', () => handlers.onConnection?.(false));
    source.addEventListener('message', (event: MessageEvent<string>) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      const message = messageSchema.safeParse(parsed);
      if (!message.success) return;
      if (message.data.type === PRESENCE) {
        const presence = presenceSchema.safeParse(message.data.data);
        if (presence.success) handlers.onDevices(presence.data.devices);
        return;
      }
      handlers.onMessage(message.data);
    });
    this.source = source;
  }

  /** Sends `type` with `data` to this user's other devices on the channel. */
  async send(type: string, data: unknown = null): Promise<boolean> {
    const response = await fetch(this.path(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...csrfHeaders('POST') },
      body: JSON.stringify({ client_id: this.clientId, type, data }),
    });
    return response.ok;
  }

  /** Makes this device the one driving the channel. */
  async claim(): Promise<boolean> {
    return this.send(CLAIM);
  }

  close(): void {
    this.source?.close();
    this.source = null;
  }
}
