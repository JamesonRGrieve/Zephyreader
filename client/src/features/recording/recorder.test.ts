// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mediaDevices, supportedVideoType, takeFileName } from './recorder';

describe('supportedVideoType', () => {
  it('picks the best video type this browser records, or null', () => {
    expect(supportedVideoType(() => true)).toBe('video/webm;codecs=vp9,opus');
    expect(supportedVideoType((type) => type === 'video/mp4')).toBe('video/mp4');
    expect(supportedVideoType(() => false)).toBeNull();
  });
});

describe('takeFileName', () => {
  const at = new Date('2026-11-20T21:05:33Z');

  it('names a take after its script and the minute it was made', () => {
    expect(takeFileName('Launch keynote: take 2!', 'video/webm;codecs=vp9,opus', at)).toBe(
      'Launch-keynote-take-2-2026-11-20-21-05.webm',
    );
  });

  it('downloads MP4 as .mp4, and names an untitled take "take"', () => {
    expect(takeFileName('???', 'video/mp4', at)).toBe('take-2026-11-20-21-05.mp4');
  });
});

describe('mediaDevices', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists the cameras and microphones, and nothing else', async () => {
    const device = (kind: MediaDeviceKind, label: string) =>
      ({ kind, label, deviceId: label, groupId: '' }) as MediaDeviceInfo;
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: async () => [
          device('videoinput', 'Front camera'),
          device('audioinput', 'Headset'),
          device('audiooutput', 'Speakers'),
        ],
      },
    });
    const found = await mediaDevices();
    expect(found.cameras.map((camera) => camera.label)).toEqual(['Front camera']);
    expect(found.microphones.map((microphone) => microphone.label)).toEqual(['Headset']);
  });
});
