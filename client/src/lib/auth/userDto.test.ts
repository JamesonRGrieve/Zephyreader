// SPDX-License-Identifier: AGPL-3.0-or-later
import type { User } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { toUserDto, userEntityTag } from './userDto';

const USER: User = {
  id: 'user-ada',
  email: 'ada@example.test',
  firstName: 'Ada',
  lastName: 'Lovelace',
  displayName: 'Ada L.',
  imageUrl: null,
  timezone: 'Europe/London',
  language: 'en',
  active: true,
  createdAt: new Date('2026-11-01T09:00:00.123Z'),
  updatedAt: new Date('2026-11-02T10:30:00.456Z'),
};

describe('toUserDto', () => {
  it('answers in server-framework’s shape: snake_case, microsecond timestamps', () => {
    expect(toUserDto(USER)).toEqual({
      id: 'user-ada',
      created_at: '2026-11-01T09:00:00.123000',
      created_by_user_id: null,
      updated_at: '2026-11-02T10:30:00.456000',
      updated_by_user_id: null,
      image_url: null,
      email: 'ada@example.test',
      username: null,
      display_name: 'Ada L.',
      first_name: 'Ada',
      last_name: 'Lovelace',
      mfa_count: 0,
      active: true,
      timezone: 'Europe/London',
      language: 'en',
    });
  });

  it('never carries a credential field', () => {
    const keys = Object.keys(toUserDto(USER)).join(' ');
    expect(keys).not.toMatch(/password|secret|token|hash/);
  });
});

describe('userEntityTag', () => {
  it('is the quoted updated_at the DTO carries', () => {
    expect(userEntityTag(toUserDto(USER))).toBe('"2026-11-02T10:30:00.456000"');
  });
});
