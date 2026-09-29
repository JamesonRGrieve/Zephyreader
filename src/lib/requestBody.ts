// SPDX-License-Identifier: AGPL-3.0-or-later
import { ApiError } from '~/lib/apiErrors';

/** Parses a JSON request body into an object, or fails with the server-framework 422. */
export async function readJsonObject(request: Request): Promise<object> {
  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ApiError(422, 'Request body must be a JSON object');
  }
  return body;
}

export function requiredString(body: object, key: string): string {
  const value: unknown = Reflect.get(body, key);
  if (typeof value !== 'string' || value === '') throw new ApiError(422, `${key} is required`);
  return value;
}

export function optionalString(body: object, key: string): string | undefined {
  const value: unknown = Reflect.get(body, key);
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new ApiError(422, `${key} must be a string`);
  return value;
}
