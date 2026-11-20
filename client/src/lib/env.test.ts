// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requireEnv } from './env';

describe('requireEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the variable when it is set', () => {
    vi.stubEnv('ZEPHYREADER_TEST_SETTING', 'on');
    expect(requireEnv('ZEPHYREADER_TEST_SETTING')).toBe('on');
  });

  it('fails loudly, naming the variable, when it is unset or empty', () => {
    expect(() => requireEnv('ZEPHYREADER_TEST_MISSING')).toThrow('ZEPHYREADER_TEST_MISSING is not set');
    vi.stubEnv('ZEPHYREADER_TEST_SETTING', '');
    expect(() => requireEnv('ZEPHYREADER_TEST_SETTING')).toThrow('ZEPHYREADER_TEST_SETTING is not set');
  });
});
