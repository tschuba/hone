import crypto from "node:crypto";

import { config } from "@hone/shared";
import type { JWTHeaderParameters, JWTPayload } from "jose";
import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  type Configuration,
  authorizationCodeGrant,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  discovery,
  randomPKCECodeVerifier,
  randomState,
} from "openid-client";

type OidcCallbackResult = {
  email?: string;
  role: "ADMIN" | "USER";
  sub: string;
};

type OidcBackchannelLogoutResult = {
  expiresAt: Date;
  jti: string;
  sub: string;
};

type OidcStartResult = {
  authorizationUrl: string;
  codeVerifier: string;
  nonce: string;
  state: string;
};

const MAX_LOGOUT_TOKEN_AGE_SECONDS = 5 * 60;
const OIDC_ADMIN_VALUE = process.env.OIDC_ADMIN_VALUE ?? "admin";
const OIDC_ROLE_CLAIM = process.env.OIDC_ROLE_CLAIM ?? "groups";

export function resolveOidcRole(claims: Record<string, unknown>) {
  const configuredClaim = claims[OIDC_ROLE_CLAIM];

  if (typeof configuredClaim === "string") {
    return configuredClaim === OIDC_ADMIN_VALUE ? "ADMIN" : "USER";
  }

  if (Array.isArray(configuredClaim)) {
    return configuredClaim.some((value) => value === OIDC_ADMIN_VALUE)
      ? "ADMIN"
      : "USER";
  }

  return "USER";
}

export function parseBackchannelLogoutClaims(input: {
  now?: Date;
  payload: JWTPayload;
  protectedHeader: JWTHeaderParameters;
}): OidcBackchannelLogoutResult {
  const now = input.now ?? new Date();
  const { payload, protectedHeader } = input;
  const events = payload.events;
  const isBackchannelLogout =
    typeof events === "object" &&
    events !== null &&
    "http://schemas.openid.net/event/backchannel-logout" in events;

  if (!isBackchannelLogout) {
    throw new Error("Logout token is missing backchannel logout event");
  }

  if (typeof payload.nonce === "string") {
    throw new Error("Logout token must not contain nonce");
  }

  if (protectedHeader.typ && protectedHeader.typ !== "logout+jwt") {
    throw new Error("Unexpected logout token type");
  }

  if (typeof payload.jti !== "string" || typeof payload.sub !== "string") {
    throw new Error("Logout token is missing required claims");
  }

  if (typeof payload.exp !== "number") {
    throw new Error("Logout token is missing expiration");
  }

  if (typeof payload.iat !== "number") {
    throw new Error("Logout token is missing issued-at time");
  }

  if (
    payload.iat * 1000 <
    now.getTime() - MAX_LOGOUT_TOKEN_AGE_SECONDS * 1000
  ) {
    throw new Error("Logout token is too old");
  }

  return {
    expiresAt: new Date(payload.exp * 1000),
    jti: payload.jti,
    sub: payload.sub,
  };
}

export class OidcService {
  private oidcConfigPromise: Promise<Configuration> | null = null;
  private jwksPromise: ReturnType<typeof createRemoteJWKSet> | null = null;

  private async getConfiguration() {
    if (
      !config.OIDC_ISSUER ||
      !config.OIDC_CLIENT_ID ||
      !config.OIDC_CLIENT_SECRET
    ) {
      throw new Error("OIDC is not configured");
    }

    this.oidcConfigPromise ??= discovery(
      new URL(config.OIDC_ISSUER),
      config.OIDC_CLIENT_ID,
      config.OIDC_CLIENT_SECRET,
    );

    return this.oidcConfigPromise;
  }

  async createAuthorizationRequest(): Promise<OidcStartResult> {
    const oidcConfig = await this.getConfiguration();
    const state = randomState();
    const codeVerifier = randomPKCECodeVerifier();
    const nonce = crypto.randomBytes(16).toString("hex");
    const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);
    const authorizationUrl = buildAuthorizationUrl(oidcConfig, {
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      nonce,
      redirect_uri: `${config.APP_URL}/api/v1/auth/oidc/callback`,
      response_type: "code",
      scope: "openid email profile",
      state,
    });

    return {
      authorizationUrl: authorizationUrl.toString(),
      codeVerifier,
      nonce,
      state,
    };
  }

  async handleCallback(input: {
    code: string;
    codeVerifier: string;
    nonce: string;
    state: string;
  }): Promise<OidcCallbackResult> {
    const oidcConfig = await this.getConfiguration();
    const tokens = await authorizationCodeGrant(
      oidcConfig,
      new URL(
        `${config.APP_URL}/api/v1/auth/oidc/callback?code=${encodeURIComponent(input.code)}&state=${encodeURIComponent(input.state)}`,
      ),
      {
        expectedNonce: input.nonce,
        expectedState: input.state,
        pkceCodeVerifier: input.codeVerifier,
      },
    );
    const claims = tokens.claims();

    if (!claims?.sub) {
      throw new Error("OIDC callback is missing subject claims");
    }

    const claimRecord = claims as Record<string, unknown>;

    return {
      email: typeof claims.email === "string" ? claims.email : undefined,
      role: resolveOidcRole(claimRecord),
      sub: claims.sub,
    };
  }

  async handleBackchannelLogout(
    logoutToken: string,
  ): Promise<OidcBackchannelLogoutResult> {
    const oidcConfig = await this.getConfiguration();
    const metadata = oidcConfig.serverMetadata();

    if (!metadata.issuer || !metadata.jwks_uri) {
      throw new Error("OIDC server metadata is incomplete");
    }

    this.jwksPromise ??= createRemoteJWKSet(new URL(metadata.jwks_uri));

    const { payload, protectedHeader } = await jwtVerify(
      logoutToken,
      this.jwksPromise,
      {
        audience: config.OIDC_CLIENT_ID,
        issuer: metadata.issuer,
      },
    );

    return parseBackchannelLogoutClaims({ payload, protectedHeader });
  }
}
