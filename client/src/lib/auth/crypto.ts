// SPDX-License-Identifier: AGPL-3.0-or-later
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { requireEnv } from '~/lib/env';

const CIPHER = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const RANDOM_TOKEN_BYTES = 32;
const CIPHERTEXT_VERSION = 'v1';

/** URL-safe random token (256 bits) for state, nonce, PKCE verifiers and cookie bindings. */
export function randomToken(): string {
  return randomBytes(RANDOM_TOKEN_BYTES).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}

/** RFC 7636 S256 code challenge for a PKCE code verifier. */
export function pkceChallenge(codeVerifier: string): string {
  return sha256(codeVerifier);
}

/** Constant-time comparison of two strings (e.g. stored vs presented hashes). */
export function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function encryptionKey(): Buffer {
  const key = Buffer.from(requireEnv('OAUTH_TOKEN_ENCRYPTION_KEY'), 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(`OAUTH_TOKEN_ENCRYPTION_KEY must be ${KEY_BYTES} bytes, base64-encoded`);
  }
  return key;
}

/** Encrypts an IdP token for storage: `v1.<iv>.<tag>.<ciphertext>` (base64url parts). */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(CIPHER, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [CIPHERTEXT_VERSION, iv, cipher.getAuthTag(), ciphertext]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
    .join('.');
}

export function decryptSecret(stored: string): string {
  const [version, iv, tag, ciphertext] = stored.split('.');
  if (version !== CIPHERTEXT_VERSION || !iv || !tag || !ciphertext) {
    throw new Error('Unrecognised encrypted secret format');
  }
  const decipher = createDecipheriv(CIPHER, encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}
