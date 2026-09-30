// SPDX-License-Identifier: AGPL-3.0-or-later
import { getCookie } from 'cookies-next/client';
import { describe, expect, it, vi } from 'vitest';
import { apiUrl, hasSession, sessionHeaders } from './apiClient';

describe('apiClient', () => {
  it('builds same-origin API paths', () => {
    expect(apiUrl('/v1/user')).toBe('/api/v1/user');
  });

  it('echoes zx_csrf as X-CSRF-Token and reports a session when it is present', () => {
    vi.mocked(getCookie).mockImplementation((name) => (name === 'zx_csrf' ? 'csrf-value' : undefined));
    expect(hasSession()).toBe(true);
    expect(sessionHeaders()).toEqual({ 'X-CSRF-Token': 'csrf-value' });
  });

  it('sends no CSRF header and reports no session when signed out', () => {
    vi.mocked(getCookie).mockReturnValue(undefined);
    expect(hasSession()).toBe(false);
    expect(sessionHeaders()).toEqual({});
  });
});
