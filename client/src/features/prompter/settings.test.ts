// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { colours, DEFAULT_SETTINGS, mirrorTransform, readSettings } from './settings';

describe('settings', () => {
  it('keeps one pace, in words a minute, for scrolling and for time estimates', () => {
    expect(DEFAULT_SETTINGS.speed).toBe(150);
    expect(readSettings({ readingWpm: 200 })).not.toHaveProperty('readingWpm');
  });

  it('reads stored settings leniently: defaults for missing, invalid or unknown values', () => {
    const read = readSettings({ fontSize: 9999, theme: 'neon', speed: 120, mystery: true });
    expect(read.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
    expect(read.theme).toBe('dark');
    expect(read.speed).toBe(120);
    expect('mystery' in read).toBe(false);
    expect(readSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('draws custom colours only for the custom theme, and mirrors either way', () => {
    expect(colours({ ...DEFAULT_SETTINGS, theme: 'high-contrast' })).toEqual({ text: '#ffe600', background: '#000000' });
    expect(colours({ ...DEFAULT_SETTINGS, theme: 'custom', textColour: '#00ff00', backgroundColour: '#101010' })).toEqual({
      text: '#00ff00',
      background: '#101010',
    });
    expect(mirrorTransform({ ...DEFAULT_SETTINGS, mirrorHorizontal: true })).toBe('scale(-1, 1)');
  });
});
