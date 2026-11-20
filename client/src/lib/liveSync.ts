// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Live sync for the lite variant: the same contract as server-framework's live_sync
 * extension (zephyrex/extensions/live_sync), held in this one Node process.
 *
 * A signed-in user's windows and devices join a named channel; a message one posts
 * reaches the others on it as server-sent events (`{type, sender, data}`), and every
 * join, leave and claim of control is announced as a `presence` message listing the
 * devices. The first device to join is main; `claim` makes the sender main; when main
 * leaves, control passes to the longest-connected device left. Channels are private
 * to their user.
 */
import { recordError, validationError } from '~/lib/apiErrors';

export const NAME_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const MESSAGE_TYPE_PATTERN = /^[a-z][a-z0-9_.-]{0,63}$/;
export const MAX_LABEL_LENGTH = 120;
export const MAX_MESSAGE_BYTES = 64 * 1024;
export const CLAIM_TYPE = 'claim';
export const PRESENCE_TYPE = 'presence';
const RESERVED_TYPES = new Set([PRESENCE_TYPE]);
/** How often an idle stream sends a comment, so proxies keep it open. */
export const KEEPALIVE_MS = 15_000;
/** Undelivered messages one device may queue before it is dropped as too slow. */
export const DEVICE_QUEUE_SIZE = 256;

export interface LiveDevice {
  client_id: string;
  label: string | null;
  main: boolean;
  connected: boolean;
}

export interface LiveMessage {
  type: string;
  sender: string;
  data: unknown;
}

/** One open stream: frames are pushed to it; `close` ends it. */
export interface LiveSink {
  push(frame: string): boolean;
  close(): void;
}

interface Subscriber {
  clientId: string;
  label: string | null;
  joinedAt: number;
  sink: LiveSink;
  queued: number;
}

interface Channel {
  devices: Map<string, Subscriber>;
  main: string | null;
}

export function validName(value: string | null, what: string): string {
  if (value === null || !NAME_PATTERN.test(value)) {
    throw recordError(422, `${what} must be 1-64 letters, digits, '-' or '_'`);
  }
  return value;
}

/** A device's post, validated as the framework's LivePost model validates it. */
export function validPost(body: object): { clientId: string; type: string; data: unknown } {
  const clientId: unknown = Reflect.get(body, 'client_id');
  const type: unknown = Reflect.get(body, 'type');
  const data: unknown = Reflect.get(body, 'data') ?? null;
  if (typeof clientId !== 'string' || !NAME_PATTERN.test(clientId)) {
    throw validationError("client_id must be 1-64 letters, digits, '-' or '_'", 'client_id');
  }
  if (typeof type !== 'string' || !MESSAGE_TYPE_PATTERN.test(type)) {
    throw validationError('type must be a lowercase name of at most 64 characters', 'type');
  }
  if (RESERVED_TYPES.has(type)) throw validationError(`'${type}' is a server message type`, 'type');
  if (JSON.stringify(data).length > MAX_MESSAGE_BYTES) {
    throw recordError(413, `A message's data may be at most ${MAX_MESSAGE_BYTES} bytes`);
  }
  return { clientId, type, data };
}

export function frame(message: LiveMessage): string {
  return `data: ${JSON.stringify(message)}\n\n`;
}

export class LiveHub {
  private readonly channels = new Map<string, Channel>();

  private key(userId: string, channel: string): string {
    return `${userId}\u0000${channel}`;
  }

  private channel(userId: string, channel: string): Channel | undefined {
    return this.channels.get(this.key(userId, channel));
  }

  devices(userId: string, channel: string): LiveDevice[] {
    const found = this.channel(userId, channel);
    if (found === undefined) return [];
    return [...found.devices.values()]
      .sort((a, b) => a.clientId.localeCompare(b.clientId))
      .map((device) => ({
        client_id: device.clientId,
        label: device.label,
        main: found.main === device.clientId,
        connected: true,
      }));
  }

  isConnected(userId: string, channel: string, clientId: string): boolean {
    return this.channel(userId, channel)?.devices.has(clientId) ?? false;
  }

  /**
   * Opens the device's stream. A device that joins again (it reconnected, or reloaded)
   * replaces its old stream, which is closed, keeping its place and its lead.
   */
  join(userId: string, channel: string, clientId: string, label: string | null, sink: LiveSink): void {
    const key = this.key(userId, channel);
    const found = this.channels.get(key) ?? { devices: new Map<string, Subscriber>(), main: null };
    const replaced = found.devices.get(clientId);
    found.devices.set(clientId, { clientId, label, joinedAt: replaced?.joinedAt ?? Date.now(), sink, queued: 0 });
    replaced?.sink.close();
    found.main ??= clientId;
    this.channels.set(key, found);
    this.announce(userId, channel);
  }

  /** Forgets the device's stream; with `sink`, only if that stream is still the device's. */
  leave(userId: string, channel: string, clientId: string, sink?: LiveSink): void {
    const key = this.key(userId, channel);
    const found = this.channels.get(key);
    const current = found?.devices.get(clientId);
    if (found === undefined || current === undefined || (sink !== undefined && current.sink !== sink)) return;
    found.devices.delete(clientId);
    if (found.devices.size === 0) {
      this.channels.delete(key);
      return;
    }
    if (found.main === clientId) {
      const longest = [...found.devices.values()].sort((a, b) => a.joinedAt - b.joinedAt)[0];
      found.main = longest.clientId;
    }
    this.announce(userId, channel);
  }

  claim(userId: string, channel: string, clientId: string): void {
    const found = this.channel(userId, channel);
    if (found === undefined || !found.devices.has(clientId)) return;
    found.main = clientId;
    this.announce(userId, channel);
  }

  /** Sends `message` to every device on the channel but its sender. */
  publish(userId: string, channel: string, message: LiveMessage): void {
    const found = this.channel(userId, channel);
    if (found === undefined) return;
    const text = frame(message);
    for (const device of [...found.devices.values()]) {
      if (device.clientId === message.sender) continue;
      if (!device.sink.push(text)) {
        device.queued += 1;
        if (device.queued > DEVICE_QUEUE_SIZE) {
          this.leave(userId, channel, device.clientId, device.sink);
          device.sink.close();
        }
      } else {
        device.queued = 0;
      }
    }
  }

  private announce(userId: string, channel: string): void {
    this.publish(userId, channel, {
      type: PRESENCE_TYPE,
      sender: '',
      data: { devices: this.devices(userId, channel) },
    });
  }
}

// One hub per server process, kept across dev-server module reloads.
const globalHub = globalThis as typeof globalThis & { zephyreaderLiveHub?: LiveHub };
globalHub.zephyreaderLiveHub ??= new LiveHub();
export const hub: LiveHub = globalHub.zephyreaderLiveHub;
