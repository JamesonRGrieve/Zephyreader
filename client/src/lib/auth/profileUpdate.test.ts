// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { ApiError } from '~/lib/apiErrors';
import { parseProfileUpdate } from './profileUpdate';

const rejects = (body: object, status: number, detail: RegExp) => {
  const error = (() => {
    try {
      parseProfileUpdate(body);
    } catch (e) {
      return e;
    }
    return undefined;
  })();
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ status });
  expect((error as ApiError).detail).toMatch(detail);
};

describe('parseProfileUpdate', () => {
  it('maps the snake_case editable fields onto the User columns', () => {
    expect(
      parseProfileUpdate({
        user: {
          first_name: ' Ada ',
          last_name: 'Lovelace',
          display_name: 'Ada',
          timezone: 'Europe/London',
          language: 'en',
          image_url: null,
        },
      }),
    ).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      displayName: 'Ada',
      timezone: 'Europe/London',
      language: 'en',
      imageUrl: null,
    });
  });

  it('stores an empty string as null and ignores unknown fields', () => {
    expect(parseProfileUpdate({ user: { display_name: '  ', favourite_colour: 'teal' } })).toEqual({ displayName: null });
  });

  it('requires the { user } envelope', () => {
    rejects({ first_name: 'Ada' }, 422, /"user"/);
    rejects({ user: ['x'] }, 422, /"user"/);
  });

  it('refuses identity and server-owned fields', () => {
    rejects({ user: { email: 'x@example.com' } }, 422, /managed by the sign-in provider/);
    rejects({ user: { username: 'ada' } }, 422, /managed by the sign-in provider/);
    rejects({ user: { active: false } }, 422, /cannot be changed/);
    rejects({ user: { mfa_count: 3 } }, 422, /cannot be changed/);
  });

  it('validates types, length and the time zone', () => {
    rejects({ user: { first_name: 42 } }, 422, /string or null/);
    rejects({ user: { last_name: 'x'.repeat(201) } }, 422, /longer than 200/);
    rejects({ user: { timezone: 'Mars/Olympus_Mons' } }, 422, /IANA time zone/);
  });
});
