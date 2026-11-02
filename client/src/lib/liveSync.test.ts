// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The lite live-sync hub, held to the framework live_sync extension's behaviour
 * (zephyrex/extensions/live_sync/BLL_LiveSync_test.py): the first device is main,
 * messages skip their sender, claiming moves control, leaving hands it on, channels
 * are private to their user, a device that falls behind is dropped, and posts are
 * validated like the framework's LivePost.
 */
import { describe, expect, it } from 'vitest';
import { ApiError } from '~/lib/apiErrors';
import { DEVICE_QUEUE_SIZE, LiveHub, type LiveMessage, type LiveSink, validName, validPost } from './liveSync';

class Device implements LiveSink {
  readonly frames: string[] = [];
  closed = false;

  constructor(private readonly accepting = true) {}

  push(frame: string): boolean {
    this.frames.push(frame);
    return this.accepting;
  }

  close(): void {
    this.closed = true;
  }

  messages(): LiveMessage[] {
    return this.frames.map((frame) => JSON.parse(frame.slice('data: '.length)) as LiveMessage);
  }

  last(): LiveMessage {
    return this.messages().at(-1) as LiveMessage;
  }

  mains(): Record<string, boolean> {
    const presence = this.messages()
      .filter((message) => message.type === 'presence')
      .at(-1) as LiveMessage;
    const { devices } = presence.data as { devices: { client_id: string; main: boolean }[] };
    return Object.fromEntries(devices.map((device) => [device.client_id, device.main]));
  }
}

describe('LiveHub', () => {
  it('makes the first device main and skips the sender', () => {
    const hub = new LiveHub();
    const laptop = new Device();
    const phone = new Device();
    hub.join('ada', 'prompter', 'laptop', 'Laptop', laptop);
    expect(laptop.mains()).toEqual({ laptop: true });
    hub.join('ada', 'prompter', 'phone', null, phone);
    expect(phone.mains()).toEqual({ laptop: true, phone: false });

    const before = laptop.frames.length;
    hub.publish('ada', 'prompter', { type: 'scroll', sender: 'laptop', data: { y: 120 } });
    expect(phone.last()).toEqual({ type: 'scroll', sender: 'laptop', data: { y: 120 } });
    expect(laptop.frames.length).toBe(before);
  });

  it('moves control on a claim and hands it on when main leaves', () => {
    const hub = new LiveHub();
    const display = new Device();
    hub.join('ada', 'prompter', 'display', null, display);
    hub.join('ada', 'prompter', 'remote', null, new Device());
    hub.claim('ada', 'prompter', 'remote');
    expect(display.mains()).toEqual({ display: false, remote: true });
    expect(hub.devices('ada', 'prompter')).toEqual([
      { client_id: 'display', label: null, main: false, connected: true },
      { client_id: 'remote', label: null, main: true, connected: true },
    ]);
    hub.leave('ada', 'prompter', 'remote');
    expect(display.mains()).toEqual({ display: true });
  });

  it('keeps channels private to their user', () => {
    const hub = new LiveHub();
    const mine = new Device();
    hub.join('ada', 'shared', 'a-laptop', null, mine);
    hub.join('bob', 'shared', 'b-laptop', null, new Device());
    hub.publish('bob', 'shared', { type: 'scroll', sender: 'b-laptop', data: 1 });
    expect(mine.messages().map((message) => message.type)).toEqual(['presence']);
  });

  it('lets a device that rejoins replace its old stream, keeping its lead (as the framework does)', () => {
    const hub = new LiveHub();
    const first = new Device();
    hub.join('ada', 'prompter', 'tablet', null, first);
    hub.join('ada', 'prompter', 'phone', null, new Device());
    const again = new Device();
    hub.join('ada', 'prompter', 'tablet', null, again);
    expect(first.closed).toBe(true);
    // The old stream's cleanup leaves the new one in place.
    hub.leave('ada', 'prompter', 'tablet', first);
    expect(hub.devices('ada', 'prompter')).toEqual([
      { client_id: 'phone', label: null, main: false, connected: true },
      { client_id: 'tablet', label: null, main: true, connected: true },
    ]);
  });

  it('drops a device that falls behind instead of buffering forever', () => {
    const hub = new LiveHub();
    const slow = new Device(false);
    hub.join('ada', 'prompter', 'slow', null, slow);
    for (let index = 0; index <= DEVICE_QUEUE_SIZE; index += 1) {
      hub.publish('ada', 'prompter', { type: 'scroll', sender: 'fast', data: index });
    }
    expect(slow.closed).toBe(true);
    expect(hub.isConnected('ada', 'prompter', 'slow')).toBe(false);
  });
});

describe('validation', () => {
  it('refuses reserved types, bad names and oversized data like the framework', () => {
    expect(() => validPost({ client_id: 'x', type: 'presence' })).toThrow(ApiError);
    expect(() => validPost({ client_id: 'not ok!', type: 'scroll' })).toThrow(ApiError);
    expect(() => validPost({ client_id: 'x', type: 'Scroll' })).toThrow(ApiError);
    expect(() => validPost({ client_id: 'x', type: 'scroll', data: 'x'.repeat(70_000) })).toThrow(ApiError);
    expect(validPost({ client_id: 'x', type: 'scroll', data: { y: 1 } })).toEqual({
      clientId: 'x',
      type: 'scroll',
      data: { y: 1 },
    });
    expect(() => validName('bad name', 'channel')).toThrow(ApiError);
    expect(() => validName(null, 'client_id')).toThrow(ApiError);
  });
});
