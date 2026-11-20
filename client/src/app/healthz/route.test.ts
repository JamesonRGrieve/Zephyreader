// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { config } from '~/proxy';
import { GET } from './route';

describe('GET /healthz', () => {
  it('answers 204 with no body, never cached', async () => {
    const res = GET();
    expect(res.status).toBe(204);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.text()).toBe('');
  });

  it('is outside the auth proxy, which still guards the private pages', () => {
    // Each matcher entry is a path pattern that is also a valid anchored regular expression.
    const guarded = (path: string) => config.matcher.some((pattern) => new RegExp(`^${pattern}$`).test(path));
    expect(guarded('/healthz')).toBe(false);
    expect(guarded('/scripts')).toBe(true);
    expect(guarded('/settings')).toBe(true);
  });
});
