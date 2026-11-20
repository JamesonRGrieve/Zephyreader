// SPDX-License-Identifier: AGPL-3.0-or-later
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { deviceLabel, useThisDevice } from './thisDevice';

describe('deviceLabel', () => {
  it('names the browser and the system from real user agents', () => {
    expect(
      deviceLabel(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
      ),
    ).toBe('Edge on Windows');
    expect(deviceLabel('Mozilla/5.0 (Android 14; Mobile; rv:133.0) Gecko/133.0 Firefox/133.0')).toBe('Firefox on Android');
    expect(
      deviceLabel(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari on iOS');
    expect(
      deviceLabel(
        'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe('Chrome on Android');
    expect(
      deviceLabel('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'),
    ).toBe('Chrome on Linux');
  });

  it('says so plainly when it can tell neither', () => {
    expect(deviceLabel('curl/8.11.0')).toBe('A browser on this device');
  });
});

describe('useThisDevice', () => {
  it('gives this tab one id and a label, the same on every render', () => {
    const { result, rerender } = renderHook(() => useThisDevice());
    const first = result.current;
    expect(first?.id).toMatch(/\S/);
    expect(first?.label).toContain(' on ');
    rerender();
    expect(result.current).toBe(first);
  });
});
