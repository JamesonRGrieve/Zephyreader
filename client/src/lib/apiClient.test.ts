// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { apiUrl } from './apiClient';

describe('apiClient', () => {
  it('builds same-origin API paths', () => {
    expect(apiUrl('/v1/user')).toBe('/api/v1/user');
  });
});
