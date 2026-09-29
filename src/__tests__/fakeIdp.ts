// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * A real (loopback HTTP) OIDC identity provider for tests: it signs genuine
 * RS256 ID tokens and enforces the token-endpoint rules a real IdP does
 * (single-use codes, client authentication, redirect_uri match, PKCE S256).
 */
import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from 'jose';
import { pkceChallenge } from '~/lib/auth/crypto';
import type { OidcProvider } from '~/lib/auth/oauth';

export interface IdpClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
}

interface PendingGrant {
  claims: IdpClaims;
  nonce: string;
  challenge: string;
  redirectUri: string;
}

const KEY_ID = 'fake-key-1';
const ID_TOKEN_TTL = '5m';
const ACCESS_TOKEN_TTL_SECONDS = 3600;

export class FakeIdp {
  static readonly ISSUER = 'https://idp.test';
  static readonly CLIENT_ID = 'fake-client';
  static readonly CLIENT_SECRET = 'fake-secret';

  private readonly grants = new Map<string, PendingGrant>();

  private constructor(
    private readonly server: Server,
    private readonly signingKey: CryptoKey,
    readonly jwks: JWTVerifyGetKey,
  ) {}

  static async start(): Promise<FakeIdp> {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: KEY_ID, alg: 'RS256' };
    const server = createServer();
    const idp = new FakeIdp(server, privateKey, createLocalJWKSet({ keys: [jwk] }));
    server.on('request', (req, res) => void idp.handleToken(req, res));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    return idp;
  }

  get tokenUrl(): string {
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}/token`;
  }

  provider(): OidcProvider {
    return {
      name: 'fake',
      clientId: FakeIdp.CLIENT_ID,
      clientSecret: FakeIdp.CLIENT_SECRET,
      authorizeUrl: `${FakeIdp.ISSUER}/authorize`,
      tokenUrl: this.tokenUrl,
      issuers: [FakeIdp.ISSUER],
      jwks: this.jwks,
      scopes: 'openid email profile',
      extraAuthorizeParams: {},
    };
  }

  /** The user approves the authorization request; returns the code the IdP redirects back with. */
  approve(authorizeUrl: string, claims: IdpClaims, options: { nonce?: string } = {}): string {
    const params = new URL(authorizeUrl).searchParams;
    const code = randomBytes(16).toString('hex');
    this.grants.set(code, {
      claims,
      nonce: options.nonce ?? params.get('nonce') ?? '',
      challenge: params.get('code_challenge') ?? '',
      redirectUri: params.get('redirect_uri') ?? '',
    });
    return code;
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  private async handleToken(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));

    const code = form.get('code') ?? '';
    const grant = this.grants.get(code);
    this.grants.delete(code);
    const valid =
      grant !== undefined &&
      form.get('grant_type') === 'authorization_code' &&
      form.get('client_id') === FakeIdp.CLIENT_ID &&
      form.get('client_secret') === FakeIdp.CLIENT_SECRET &&
      form.get('redirect_uri') === grant.redirectUri &&
      pkceChallenge(form.get('code_verifier') ?? '') === grant.challenge;
    if (!valid) {
      res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'invalid_grant' }));
      return;
    }

    const idToken = await new SignJWT({ ...grant.claims, nonce: grant.nonce })
      .setProtectedHeader({ alg: 'RS256', kid: KEY_ID })
      .setIssuer(FakeIdp.ISSUER)
      .setAudience(FakeIdp.CLIENT_ID)
      .setSubject(grant.claims.sub)
      .setIssuedAt()
      .setExpirationTime(ID_TOKEN_TTL)
      .sign(this.signingKey);
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(
      JSON.stringify({
        access_token: `access-${code}`,
        refresh_token: `refresh-${code}`,
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        id_token: idToken,
        token_type: 'Bearer',
        scope: 'openid email profile',
      }),
    );
  }
}
