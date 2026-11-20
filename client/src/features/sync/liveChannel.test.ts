// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { deviceId, displayShouldLead, REMOTE_LABEL_PREFIX } from './liveChannel';

const device = (label: string | null, main: boolean) => ({ label, main });

describe('displayShouldLead', () => {
  it('takes the lead only from a remote, never from another display', () => {
    expect(displayShouldLead([device(`${REMOTE_LABEL_PREFIX}Pixel`, true), device('Chrome on macOS', false)])).toBe(true);
    expect(displayShouldLead([device('Chrome on macOS', true), device(`${REMOTE_LABEL_PREFIX}Pixel`, false)])).toBe(false);
    expect(displayShouldLead([device(null, true)])).toBe(false);
    expect(displayShouldLead([])).toBe(false);
  });
});

/** A session storage of its own, so each test starts empty. */
function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
}

describe('deviceId', () => {
  it('makes an id once and keeps it for the tab, so a reload rejoins as the same device', () => {
    const storage = memoryStorage();
    // A UUID's first 32 characters: plenty to tell a user's tabs apart, and within the id limit.
    const first = deviceId(storage, () => '1b4e28ba-2fa1-11d2-883f-0016d3cca427');
    expect(first).toBe('1b4e28ba-2fa1-11d2-883f-0016d3cc');
    expect(deviceId(storage, () => 'another')).toBe(first);
  });

  it('keeps only safe characters, at most 32 of them', () => {
    const storage = memoryStorage();
    expect(deviceId(storage, () => 'a b/c?d'.repeat(10))).toBe('abcdabcdabcdabcdabcdabcdabcdabcd');
  });

  it('replaces a stored value that is not a safe id', () => {
    const storage = memoryStorage();
    storage.values.set('zephyreader.device', '<script>');
    expect(deviceId(storage, () => 'fresh-id')).toBe('fresh-id');
  });

  it('still gives an id with no storage, or storage that refuses', () => {
    expect(deviceId(null, () => 'no-storage')).toBe('no-storage');
    const refusing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => undefined,
    };
    expect(deviceId(refusing, () => 'refused')).toBe('refused');
  });
});
