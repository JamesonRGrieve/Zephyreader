// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { constantTimeEqual, decryptSecret, encryptSecret, pkceChallenge, randomToken } from './crypto';

describe('pkceChallenge', () => {
  it('matches the RFC 7636 appendix B S256 test vector', () => {
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});

describe('randomToken', () => {
  it('produces distinct URL-safe 256-bit tokens', () => {
    const a = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(a);
  });
});

describe('encryptSecret / decryptSecret', () => {
  it('round-trips without storing the plaintext', () => {
    const stored = encryptSecret('ya29.secret-access-token');
    expect(stored).not.toContain('secret-access-token');
    expect(decryptSecret(stored)).toBe('ya29.secret-access-token');
  });

  it('uses a fresh IV each time', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
  });

  it('rejects tampered ciphertext', () => {
    const [version, iv, tag, ciphertext] = encryptSecret('value').split('.');
    const flipped = `${ciphertext.startsWith('A') ? 'B' : 'A'}${ciphertext.slice(1)}`;
    expect(() => decryptSecret([version, iv, tag, flipped].join('.'))).toThrow();
  });

  it('rejects an unknown format', () => {
    expect(() => decryptSecret('plaintext-token')).toThrow('Unrecognised encrypted secret format');
  });
});

describe('constantTimeEqual', () => {
  it('compares equal and unequal (including different-length) strings', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });
});
