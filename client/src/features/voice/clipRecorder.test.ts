// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { CLIP_TYPES, supportedClipType } from './clipRecorder';

describe('supportedClipType', () => {
  it('picks the best type this browser records', () => {
    expect(supportedClipType(() => true)).toBe('audio/webm;codecs=opus');
    // Safari records only MP4 audio.
    expect(supportedClipType((type) => type === 'audio/mp4')).toBe('audio/mp4');
  });

  it('gives null when the browser records none of them', () => {
    expect(supportedClipType(() => false)).toBeNull();
  });

  it('only ever offers types the server accepts, best first', () => {
    expect(CLIP_TYPES[0]).toBe('audio/webm;codecs=opus');
    expect(CLIP_TYPES.every((type) => type.startsWith('audio/'))).toBe(true);
  });
});
