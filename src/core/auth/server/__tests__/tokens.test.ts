import jwt from "jsonwebtoken";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  createAccessToken,
  createRefreshToken,
  REFRESH_TOKEN_TTL_SECONDS,
  verifyAccessToken,
  verifyRefreshToken,
} from "../tokens";

const SECRET = "test-secret-test-secret-test-secret-1234";

// The real signing code runs; only the env (the secret) is faked.
jest.mock("../../../../config/env", () => ({
  env: { AUTH_JWT_SECRET: "test-secret-test-secret-test-secret-1234" },
}));

const userId = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";
const sessionId = "0b7c2d1e-3f4a-4b5c-8d6e-7f8091a2b3c4";
const claims = { userId, sessionId };

/**
 * A token signed outside our code, the way an attacker or a misconfigured service would.
 * Every option defaults to what the real code uses, so each test changes exactly one thing.
 */
function forge(
  payload: Record<string, unknown>,
  options: {
    secret?: string;
    issuer?: string;
    audience?: string;
    expiresIn?: number;
  } = {},
) {
  return jwt.sign(payload, options.secret ?? SECRET, {
    algorithm: "HS256",
    issuer: options.issuer ?? "event-sphere",
    audience: options.audience ?? "event-sphere-api",
    subject: userId,
    expiresIn: options.expiresIn ?? 60,
  });
}

const base64url = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

describe("refresh token", () => {
  it("has a random jti, so two tokens for one session in the same second differ", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-11-13T10:00:00Z"));
    try {
      const first = createRefreshToken(claims);
      const second = createRefreshToken(claims);

      expect(first.token).not.toBe(second.token);
      expect(first.tokenHash).not.toBe(second.tokenHash);
      const jtiOf = (token: string) => jwt.decode(token, { json: true })?.jti;
      expect(jtiOf(first.token)).toEqual(expect.any(String));
      expect(jtiOf(first.token)).not.toBe(jtiOf(second.token));
    } finally {
      jest.useRealTimers();
    }
  });

  it("still verifies, and still carries only the user and the session", () => {
    const { token } = createRefreshToken(claims);

    expect(verifyRefreshToken(token)).toEqual(claims);
  });

  it("is not accepted as an access token's claims, and an access token is not a refresh token", () => {
    const access = createAccessToken({ ...claims, role: "organizer" });

    expect(verifyRefreshToken(access.token)).toBeNull();
  });

  it("expires after its TTL (7 days), not a second later", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-11-13T10:00:00Z"));
    try {
      const { token, expiresAt } = createRefreshToken(claims);
      expect(expiresAt.getTime() - Date.now()).toBe(
        REFRESH_TOKEN_TTL_SECONDS * 1000,
      );

      jest.setSystemTime(Date.now() + (REFRESH_TOKEN_TTL_SECONDS - 1) * 1000);
      expect(verifyRefreshToken(token)).toEqual(claims);

      jest.setSystemTime(Date.now() + 2 * 1000);
      expect(verifyRefreshToken(token)).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("access token", () => {
  it("round-trips the user, the session and the role", () => {
    const { token } = createAccessToken({ ...claims, role: "organizer" });

    expect(verifyAccessToken(token)).toEqual({ ...claims, role: "organizer" });
  });

  it("is not accepted as a refresh token's claims, and a refresh token is not an access token", () => {
    const refresh = createRefreshToken(claims);

    expect(verifyAccessToken(refresh.token)).toBeNull();
  });

  it("expires after its TTL (15 minutes)", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-11-13T10:00:00Z"));
    try {
      const { token } = createAccessToken({ ...claims, role: "organizer" });

      jest.setSystemTime(Date.now() + (ACCESS_TOKEN_TTL_SECONDS + 1) * 1000);

      expect(verifyAccessToken(token)).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it("refuses a role that does not exist, even when the signature is valid", () => {
    const token = forge({ typ: "access", sid: sessionId, role: "superuser" });

    expect(verifyAccessToken(token)).toBeNull();
  });
});

describe("verification never trusts a token it did not sign itself", () => {
  const refreshPayload = { typ: "refresh", sid: sessionId };

  it("accepts the forge helper's own token, so the refusals below are meaningful", () => {
    expect(verifyRefreshToken(forge(refreshPayload))).toEqual(claims);
  });

  it("refuses a token signed with another secret", () => {
    const token = forge(refreshPayload, {
      secret: "another-secret-another-secret-1234567",
    });

    expect(verifyRefreshToken(token)).toBeNull();
  });

  it("refuses a token whose signature was changed", () => {
    const [header, payload, signature] = forge(refreshPayload).split(".");
    const flipped = (signature[0] === "A" ? "B" : "A") + signature.slice(1);

    expect(verifyRefreshToken(`${header}.${payload}.${flipped}`)).toBeNull();
  });

  it("refuses a token whose payload was changed (another session id) under the old signature", () => {
    const [header, , signature] = forge(refreshPayload).split(".");
    const otherPayload = base64url({
      ...refreshPayload,
      sid: "11111111-1111-4111-8111-111111111111",
      sub: userId,
      iss: "event-sphere",
      aud: "event-sphere-api",
      exp: Math.floor(Date.now() / 1000) + 60,
    });

    expect(
      verifyRefreshToken(`${header}.${otherPayload}.${signature}`),
    ).toBeNull();
  });

  it('refuses an unsigned token (alg "none")', () => {
    const unsigned = [
      base64url({ alg: "none", typ: "JWT" }),
      base64url({
        ...refreshPayload,
        sub: userId,
        iss: "event-sphere",
        aud: "event-sphere-api",
        exp: Math.floor(Date.now() / 1000) + 60,
      }),
      "",
    ].join(".");

    expect(verifyRefreshToken(unsigned)).toBeNull();
  });

  it("refuses another issuer or another audience", () => {
    expect(
      verifyRefreshToken(forge(refreshPayload, { issuer: "someone-else" })),
    ).toBeNull();
    expect(
      verifyRefreshToken(forge(refreshPayload, { audience: "another-api" })),
    ).toBeNull();
  });

  it("refuses a valid signature over claims of the wrong shape (session id not a uuid)", () => {
    expect(
      verifyRefreshToken(forge({ typ: "refresh", sid: "not-a-uuid" })),
    ).toBeNull();
  });

  it("refuses text that is not a JWT at all", () => {
    expect(verifyRefreshToken("")).toBeNull();
    expect(verifyRefreshToken("garbage")).toBeNull();
    expect(verifyAccessToken("a.b.c")).toBeNull();
  });
});
