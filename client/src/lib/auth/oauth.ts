// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * OAuth 2.0 / OpenID Connect login (authorization code + PKCE), following the
 * OAuth 2.0 Security BCP (RFC 9700) and OIDC Core:
 *
 * - `state` is an opaque single-use CSRF value, stored hashed with the PKCE
 *   verifier and OIDC nonce, bound to (provider, redirect_uri) and to the browser
 *   via an HttpOnly binding cookie (login-CSRF protection).
 * - The code is exchanged server-side (confidential client) with the verifier.
 * - The ID token is verified against the IdP's JWKS (signature, iss, aud, exp,
 *   nonce); identity is keyed on (provider, sub), never on email.
 * - A new user is provisioned on first sign-in, and an existing account is
 *   linked by email, only when the IdP asserts `email_verified`.
 * - IdP access/refresh tokens are encrypted at rest.
 *
 * Mirrors server-framework's oauth_consumer contract (/v1/auth/oauth/*).
 */
import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { ApiError } from '~/lib/apiErrors';
import { constantTimeEqual, encryptSecret, pkceChallenge, randomToken, sha256 } from '~/lib/auth/crypto';
import { issueSession, type IssuedSession } from '~/lib/auth/session';
import { requireEnv } from '~/lib/env';
import { prisma } from '~/lib/prisma';
import appConfig from '~/zephyrex.config';

const STATE_TTL_MS = 10 * 60 * 1000;
export const OAUTH_GRANT_TYPE = 'oauth_consumer';

export interface OidcProvider {
  name: string;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  issuers: string[];
  jwks: JWTVerifyGetKey;
  scopes: string;
  extraAuthorizeParams: Record<string, string>;
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  idToken: string | null;
  scopes: string | null;
}

interface OidcIdentity {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  givenName: string | null;
  familyName: string | null;
  name: string | null;
  picture: string | null;
}

interface TokenEndpointResponse {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  id_token?: unknown;
  scope?: unknown;
}

const GOOGLE_ISSUER = 'https://accounts.google.com';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.readonly';
const DISCOVERY_PATH = '/.well-known/openid-configuration';
const DISCOVERY_TIMEOUT_MS = 10_000;

interface Endpoints {
  authorizeUrl: string;
  tokenUrl: string;
  jwks: JWTVerifyGetKey;
}

let googleEndpoints: Promise<Endpoints> | null = null;

/** An OpenID issuer's endpoints, read from its discovery document. */
async function discover(issuer: string): Promise<Endpoints> {
  const response = await fetch(`${issuer.replace(/\/$/, '')}${DISCOVERY_PATH}`, {
    signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
  });
  if (!response.ok) throw new ApiError(502, 'The sign-in provider could not be reached');
  const body: unknown = await response.json();
  const field = (name: string): string => {
    const value: unknown = typeof body === 'object' && body !== null ? Reflect.get(body, name) : undefined;
    if (typeof value !== 'string') throw new ApiError(502, 'The sign-in provider sent an invalid discovery document');
    return value;
  };
  return {
    authorizeUrl: field('authorization_endpoint'),
    tokenUrl: field('token_endpoint'),
    jwks: createRemoteJWKSet(new URL(field('jwks_uri'))),
  };
}

/**
 * Google as an OIDC provider; the Drive read scope lets the app list and export Docs.
 * `GOOGLE_ISSUER` names another OpenID issuer to stand in for Google (as the framework's
 * Google provider's `issuer` setting does), whose endpoints are discovered; the default is
 * Google itself, at its published endpoints.
 */
export async function googleProvider(): Promise<OidcProvider> {
  const issuer = process.env.GOOGLE_ISSUER || GOOGLE_ISSUER;
  googleEndpoints ??=
    issuer === GOOGLE_ISSUER
      ? Promise.resolve({
          authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
          tokenUrl: 'https://oauth2.googleapis.com/token',
          jwks: createRemoteJWKSet(new URL(GOOGLE_JWKS_URL)),
        })
      : discover(issuer);
  const endpoints = await googleEndpoints.catch((error: unknown) => {
    googleEndpoints = null;
    throw error;
  });
  return {
    name: 'google',
    clientId: requireEnv('GOOGLE_CLIENT_ID'),
    clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
    ...endpoints,
    // Google issues either form of its issuer identifier.
    issuers: issuer === GOOGLE_ISSUER ? [GOOGLE_ISSUER, 'accounts.google.com'] : [issuer],
    scopes: GOOGLE_SCOPES,
    // Offline access with consent yields a refresh token for Drive calls.
    extraAuthorizeParams: { access_type: 'offline', prompt: 'consent' },
  };
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function parseTokenResponse(body: TokenEndpointResponse): TokenSet {
  const accessToken = stringOrNull(body.access_token);
  if (!accessToken) throw new ApiError(400, 'OAuth code exchange failed');
  return {
    accessToken,
    refreshToken: stringOrNull(body.refresh_token),
    expiresAt: typeof body.expires_in === 'number' ? new Date(Date.now() + body.expires_in * 1000) : null,
    idToken: stringOrNull(body.id_token),
    scopes: stringOrNull(body.scope),
  };
}

/** Posts a form-encoded grant to the provider's token endpoint. */
export async function requestTokens(provider: OidcProvider, grant: Record<string, string>): Promise<TokenSet> {
  const response = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ client_id: provider.clientId, client_secret: provider.clientSecret, ...grant }),
  });
  if (!response.ok) {
    console.warn('OAuth token endpoint rejected a %s grant (status %d)', grant.grant_type, response.status);
    throw new ApiError(400, 'OAuth code exchange failed');
  }
  return parseTokenResponse((await response.json()) as TokenEndpointResponse);
}

export class OAuthLogin {
  constructor(
    private readonly providers: Record<string, () => OidcProvider | Promise<OidcProvider>>,
    private readonly allowedRedirectUris: () => string[],
    private readonly allowSignup: () => boolean,
  ) {}

  private async provider(name: string): Promise<OidcProvider> {
    const factory = Object.hasOwn(this.providers, name) ? this.providers[name] : undefined;
    if (!factory) throw new ApiError(400, `Unknown OAuth provider: ${name}`);
    return factory();
  }

  private redirectUri(provider: string, requested: string | undefined): string {
    const allowed = this.allowedRedirectUris();
    const target = requested ?? allowed.find((uri) => uri.endsWith(`/${provider}`)) ?? allowed[0];
    // Exact-match allowlist (RFC 9700 §4.1.3): no prefix or pattern matching.
    if (!target || !allowed.includes(target)) throw new ApiError(400, 'redirect_uri not in allowlist');
    return target;
  }

  /** Starts a login; returns the IdP URL, the state, and the browser-binding secret for its cookie. */
  async beginAuthorize(
    providerName: string,
    requestedRedirectUri?: string,
  ): Promise<{ authorizeUrl: string; state: string; binding: string }> {
    const provider = await this.provider(providerName);
    const redirectUri = this.redirectUri(provider.name, requestedRedirectUri);
    const state = randomToken();
    const binding = randomToken();
    const codeVerifier = randomToken();
    const nonce = randomToken();

    await prisma.oAuthState.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await prisma.oAuthState.create({
      data: {
        stateHash: sha256(state),
        bindingHash: sha256(binding),
        provider: provider.name,
        redirectUri,
        codeVerifier,
        nonce,
        expiresAt: new Date(Date.now() + STATE_TTL_MS),
      },
    });

    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: provider.scopes,
      state,
      nonce,
      code_challenge: pkceChallenge(codeVerifier),
      code_challenge_method: 'S256',
      ...provider.extraAuthorizeParams,
    });
    return { authorizeUrl: `${provider.authorizeUrl}?${params.toString()}`, state, binding };
  }

  /** Completes a login begun by `beginAuthorize` and issues a session. */
  async completeCallback(input: {
    provider: string;
    code: string;
    state: string;
    binding: string | undefined;
    redirectUri?: string;
  }): Promise<IssuedSession> {
    const provider = await this.provider(input.provider);
    const redirectUri = this.redirectUri(provider.name, input.redirectUri);
    const pending = await this.consumeState(input.state);
    const valid =
      pending !== null &&
      pending.expiresAt > new Date() &&
      pending.provider === provider.name &&
      pending.redirectUri === redirectUri &&
      input.binding !== undefined &&
      constantTimeEqual(sha256(input.binding), pending.bindingHash);
    if (!valid) throw new ApiError(400, 'Invalid or expired OAuth state');

    const tokens = await requestTokens(provider, {
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: redirectUri,
      code_verifier: pending.codeVerifier,
    });
    if (!tokens.idToken) throw new ApiError(400, 'IdP returned no ID token');
    const identity = await this.verifyIdToken(provider, tokens.idToken, pending.nonce);
    return this.signIn(provider.name, identity, tokens);
  }

  /** Single-use: the state row is deleted as it is read, so a replay finds nothing. */
  private async consumeState(state: string) {
    try {
      return await prisma.oAuthState.delete({ where: { stateHash: sha256(state) } });
    } catch {
      return null;
    }
  }

  private async verifyIdToken(provider: OidcProvider, idToken: string, nonce: string | null): Promise<OidcIdentity> {
    try {
      const { payload } = await jwtVerify(idToken, provider.jwks, {
        issuer: provider.issuers,
        audience: provider.clientId,
        requiredClaims: ['sub', 'exp', 'iat'],
      });
      if (nonce !== null && payload.nonce !== nonce) throw new ApiError(400, 'ID token nonce mismatch');
      return {
        sub: String(payload.sub),
        email: stringOrNull(payload.email)?.toLowerCase().trim() ?? null,
        emailVerified: payload.email_verified === true,
        givenName: stringOrNull(payload.given_name),
        familyName: stringOrNull(payload.family_name),
        name: stringOrNull(payload.name),
        picture: stringOrNull(payload.picture),
      };
    } catch (error) {
      if (error instanceof errors.JOSEError) throw new ApiError(400, 'Invalid ID token');
      throw error;
    }
  }

  private async signIn(provider: string, identity: OidcIdentity, tokens: TokenSet): Promise<IssuedSession> {
    const storedTokens = {
      email: identity.email,
      accessToken: encryptSecret(tokens.accessToken),
      tokenExpiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
      // Google only returns a refresh token on consent; keep the stored one otherwise.
      ...(tokens.refreshToken ? { refreshToken: encryptSecret(tokens.refreshToken) } : {}),
    };

    const link = await prisma.oAuthLink.findUnique({
      where: { provider_providerUserId: { provider, providerUserId: identity.sub } },
      include: { user: true },
    });
    if (link) {
      await prisma.oAuthLink.update({ where: { id: link.id }, data: storedTokens });
      return this.issueFor(link.user);
    }

    if (!identity.email || !identity.emailVerified) {
      throw new ApiError(400, 'The identity provider did not confirm ownership of this email address');
    }
    const existing = await prisma.user.findUnique({ where: { email: identity.email } });
    if (!existing && !this.allowSignup()) throw new ApiError(403, 'Sign-up is disabled');

    const user =
      existing ??
      (await prisma.user.create({
        data: {
          email: identity.email,
          firstName: identity.givenName,
          lastName: identity.familyName,
          displayName: identity.name,
          imageUrl: identity.picture,
        },
      }));
    await prisma.oAuthLink.create({
      data: { userId: user.id, provider, providerUserId: identity.sub, ...storedTokens },
    });
    return this.issueFor(user);
  }

  private issueFor(user: { id: string; email: string; timezone: string | null; active: boolean }): Promise<IssuedSession> {
    if (!user.active) throw new ApiError(403, 'User account is disabled');
    return issueSession(user, OAUTH_GRANT_TYPE);
  }
}

const DEFAULT_AUTH_PATH = '/user';

/** Exact-match allowlist; by default the framework's close page, `${APP_URI}${authPath}/close/google`. */
function configuredRedirectUris(): string[] {
  const configured = process.env.OAUTH_REDIRECT_URIS;
  if (configured) return configured.split(',').map((uri) => uri.trim());
  return [`${requireEnv('APP_URI')}${appConfig.auth?.authPath ?? DEFAULT_AUTH_PATH}/close/google`];
}

export const oauthLogin = new OAuthLogin(
  { google: googleProvider },
  configuredRedirectUris,
  () => process.env.OAUTH_ALLOW_SIGNUP !== 'false',
);
