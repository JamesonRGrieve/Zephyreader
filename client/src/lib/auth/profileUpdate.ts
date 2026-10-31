// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * PUT /v1/user body validation (server-framework parity): `{ "user": { ... } }`
 * with snake_case fields, each a string or null. Unknown fields are ignored, as
 * the server's model does; fields the caller may not change are refused.
 */
import type { Prisma } from '@prisma/client';
import { ApiError } from '~/lib/apiErrors';

const MAX_FIELD_LENGTH = 200;

/** Self-editable profile fields: wire name → User column. */
const EDITABLE_FIELDS = {
  first_name: 'firstName',
  last_name: 'lastName',
  display_name: 'displayName',
  timezone: 'timezone',
  language: 'language',
  image_url: 'imageUrl',
} as const satisfies Record<string, keyof Prisma.UserUpdateInput>;

/**
 * Fields the server lets a user edit that this app cannot: the email is the
 * Google identity's, and accounts here have no username.
 */
const IDENTITY_FIELDS = ['email', 'username'];
/** Account state only the server sets. */
const SERVER_FIELDS = ['id', 'active', 'mfa_count', 'created_at', 'updated_at'];

function isEditableField(field: string): field is keyof typeof EDITABLE_FIELDS {
  return Object.hasOwn(EDITABLE_FIELDS, field);
}

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function fieldValue(field: string, value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') throw new ApiError(422, `${field} must be a string or null`);
  const trimmed = value.trim();
  if (trimmed.length > MAX_FIELD_LENGTH) throw new ApiError(422, `${field} is longer than ${MAX_FIELD_LENGTH} characters`);
  if (field === 'timezone' && trimmed !== '' && !isValidTimezone(trimmed)) {
    throw new ApiError(422, 'timezone is not a valid IANA time zone');
  }
  return trimmed === '' ? null : trimmed;
}

export function parseProfileUpdate(body: object): Prisma.UserUpdateInput {
  const user: unknown = Reflect.get(body, 'user');
  if (typeof user !== 'object' || user === null || Array.isArray(user)) {
    throw new ApiError(422, 'Request body must be { "user": { ... } }');
  }
  const changes: Prisma.UserUpdateInput = {};
  for (const [field, value] of Object.entries(user)) {
    if (IDENTITY_FIELDS.includes(field)) throw new ApiError(422, `${field} is managed by the sign-in provider`);
    if (SERVER_FIELDS.includes(field)) throw new ApiError(422, `${field} cannot be changed`);
    if (isEditableField(field)) changes[EDITABLE_FIELDS[field]] = fieldValue(field, value);
  }
  return changes;
}
