// SPDX-License-Identifier: AGPL-3.0-or-later

/** Reads a required environment variable, failing loudly (as a 500) when it is unset. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set in environment variables`);
  }
  return value;
}
