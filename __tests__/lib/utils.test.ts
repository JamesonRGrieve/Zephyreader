import { cn } from '@/lib/utils';

describe('cn', () => {
  it('merges class names and filters falsy values', () => {
    const result = cn('px-4', false && 'hidden', 'text-sm', undefined, 'text-center');
    expect(result).toBe('px-4 text-sm text-center');
  });
});
