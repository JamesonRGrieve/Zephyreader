// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('joins class names and drops the false, null and undefined ones', () => {
    expect(cn('px-2', false, null, undefined, 'text-sm', { hidden: false, block: true })).toBe('px-2 text-sm block');
  });

  it('lets a later Tailwind class win over an earlier one of the same kind', () => {
    expect(cn('px-2 text-sm', 'px-4')).toBe('text-sm px-4');
  });
});
