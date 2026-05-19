import { describe, expect, it } from "bun:test";

import { parseBackchannelLogoutClaims, resolveOidcRole } from "./oidc.service";

const now = new Date("2026-05-18T12:00:00.000Z");
const freshIssuedAt = Math.floor(
  new Date("2026-05-18T11:58:20.000Z").getTime() / 1000,
);
const staleIssuedAt = Math.floor(
  new Date("2026-05-18T11:50:00.000Z").getTime() / 1000,
);

describe("parseBackchannelLogoutClaims", () => {
  it("accepts valid backchannel logout claims", () => {
    const result = parseBackchannelLogoutClaims({
      now,
      payload: {
        events: {
          "http://schemas.openid.net/event/backchannel-logout": {},
        },
        exp: 1_715_987_200,
        iat: freshIssuedAt,
        jti: "logout-jti-1",
        sub: "oidc-sub-1",
      },
      protectedHeader: {
        alg: "RS256",
        typ: "logout+jwt",
      },
    });

    expect(result).toEqual({
      expiresAt: new Date(1_715_987_200 * 1000),
      jti: "logout-jti-1",
      sub: "oidc-sub-1",
    });
  });

  it("rejects logout claims without the backchannel event", () => {
    expect(() =>
      parseBackchannelLogoutClaims({
        now,
        payload: {
          exp: 1_715_987_200,
          iat: freshIssuedAt,
          jti: "logout-jti-1",
          sub: "oidc-sub-1",
        },
        protectedHeader: {
          alg: "RS256",
          typ: "logout+jwt",
        },
      }),
    ).toThrow("Logout token is missing backchannel logout event");
  });

  it("rejects logout claims containing a nonce", () => {
    expect(() =>
      parseBackchannelLogoutClaims({
        now,
        payload: {
          events: {
            "http://schemas.openid.net/event/backchannel-logout": {},
          },
          exp: 1_715_987_200,
          iat: freshIssuedAt,
          jti: "logout-jti-1",
          nonce: "unexpected-nonce",
          sub: "oidc-sub-1",
        },
        protectedHeader: {
          alg: "RS256",
          typ: "logout+jwt",
        },
      }),
    ).toThrow("Logout token must not contain nonce");
  });

  it("rejects logout claims with an unexpected token type", () => {
    expect(() =>
      parseBackchannelLogoutClaims({
        now,
        payload: {
          events: {
            "http://schemas.openid.net/event/backchannel-logout": {},
          },
          exp: 1_715_987_200,
          iat: freshIssuedAt,
          jti: "logout-jti-1",
          sub: "oidc-sub-1",
        },
        protectedHeader: {
          alg: "RS256",
          typ: "JWT",
        },
      }),
    ).toThrow("Unexpected logout token type");
  });

  it("rejects logout claims without required identifiers", () => {
    expect(() =>
      parseBackchannelLogoutClaims({
        now,
        payload: {
          events: {
            "http://schemas.openid.net/event/backchannel-logout": {},
          },
          exp: 1_715_987_200,
          iat: freshIssuedAt,
        },
        protectedHeader: {
          alg: "RS256",
          typ: "logout+jwt",
        },
      }),
    ).toThrow("Logout token is missing required claims");
  });

  it("rejects logout claims without an expiration", () => {
    expect(() =>
      parseBackchannelLogoutClaims({
        now,
        payload: {
          events: {
            "http://schemas.openid.net/event/backchannel-logout": {},
          },
          iat: freshIssuedAt,
          jti: "logout-jti-1",
          sub: "oidc-sub-1",
        },
        protectedHeader: {
          alg: "RS256",
          typ: "logout+jwt",
        },
      }),
    ).toThrow("Logout token is missing expiration");
  });

  it("rejects logout claims without an issued-at time", () => {
    expect(() =>
      parseBackchannelLogoutClaims({
        now,
        payload: {
          events: {
            "http://schemas.openid.net/event/backchannel-logout": {},
          },
          exp: 1_715_987_200,
          jti: "logout-jti-1",
          sub: "oidc-sub-1",
        },
        protectedHeader: {
          alg: "RS256",
          typ: "logout+jwt",
        },
      }),
    ).toThrow("Logout token is missing issued-at time");
  });

  it("rejects logout claims older than five minutes", () => {
    expect(() =>
      parseBackchannelLogoutClaims({
        now,
        payload: {
          events: {
            "http://schemas.openid.net/event/backchannel-logout": {},
          },
          exp: 1_715_987_200,
          iat: staleIssuedAt,
          jti: "logout-jti-1",
          sub: "oidc-sub-1",
        },
        protectedHeader: {
          alg: "RS256",
          typ: "logout+jwt",
        },
      }),
    ).toThrow("Logout token is too old");
  });
});

describe("resolveOidcRole", () => {
  it("defaults to user when the configured claim is missing", () => {
    expect(resolveOidcRole({ sub: "oidc-sub-1" })).toBe("USER");
  });

  it("maps a matching string claim to admin", () => {
    expect(resolveOidcRole({ groups: "admin" })).toBe("ADMIN");
  });

  it("maps a matching array claim to admin", () => {
    expect(resolveOidcRole({ groups: ["member", "admin"] })).toBe("ADMIN");
  });
});
