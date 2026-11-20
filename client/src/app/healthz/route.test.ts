// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /healthz', () => {
  it('answers 204 with no body, never cached', async () => {
    const res = GET();
    expect(res.status).toBe(204);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.text()).toBe('');
  });
});
