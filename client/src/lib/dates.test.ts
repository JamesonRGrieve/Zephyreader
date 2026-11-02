// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { formatDay } from './dates';

describe('formatDay', () => {
  const day = new Date(2026, 10, 2, 12);

  it('names the month, so the day and month cannot be swapped', () => {
    expect(formatDay(day, 'en-US')).toBe('Nov 2, 2026');
    expect(formatDay(day, 'en-GB')).toBe('2 Nov 2026');
  });
});
