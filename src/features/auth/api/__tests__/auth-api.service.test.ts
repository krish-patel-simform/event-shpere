import { AxiosError, type AxiosAdapter } from "axios";
import {
  ApiError,
  baseApiService,
} from "../../../../core/api-client/base-api.service";
import { authApiService } from "../auth-api.service";

// A fake server behind the real axios instance: the adapter is the last step before the
// network, so apiRequest's envelope parsing and error mapping stay real.
type Reply = { status: number; data?: unknown };
type Call = { method: string | undefined; url: string; body: unknown };

let calls: Call[];
let reply: Reply;

const fakeServer: AxiosAdapter = async (config) => {
  const body: unknown =
    typeof config.data === "string" ? JSON.parse(config.data) : config.data;
  calls.push({ method: config.method, url: config.url ?? "", body });
  const response = {
    data: reply.data,
    status: reply.status,
    statusText: "",
    headers: {},
    config,
  };
  if (reply.status >= 200 && reply.status < 300) return response;
  throw new AxiosError("failed", "ERR_BAD_REQUEST", config, null, response);
};

const originalAdapter = baseApiService.defaults.adapter;
beforeAll(() => {
  baseApiService.defaults.adapter = fakeServer;
});
afterAll(() => {
  baseApiService.defaults.adapter = originalAdapter;
});
beforeEach(() => {
  calls = [];
  reply = { status: 204 };
});

const user = {
  id: "0b7c2d1e-3f4a-4b5c-8d6e-7f8091a2b3c4",
  firstName: "Meera",
  lastName: "Shah",
  email: "meera@example.com",
  role: "user",
} as const;

const password = "Str0ng!Passw0rd";

/** The only request sent, as the server saw it. */
function sent(): Call {
  expect(calls).toHaveLength(1);
  return calls[0];
}

describe("authApiService.login", () => {
  it("posts the email and password and returns the signed-in user", async () => {
    reply = { status: 200, data: { data: user } };

    await expect(
      authApiService.login({ email: user.email, password }),
    ).resolves.toEqual(user);
    expect(sent()).toEqual({
      method: "post",
      url: "/auth/login",
      body: { email: user.email, password },
    });
  });

  it("drops a field the schema does not know, so nothing extra (like a hash) reaches the app", async () => {
    reply = {
      status: 200,
      data: { data: { ...user, passwordHash: "$argon2id$..." } },
    };

    const result = await authApiService.login({ email: user.email, password });

    expect(result).not.toHaveProperty("passwordHash");
  });

  it("rejects an answer that breaks the schema", async () => {
    reply = { status: 200, data: { data: { ...user, id: "not-a-uuid" } } };

    await expect(
      authApiService.login({ email: user.email, password }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("turns wrong login details into an ApiError with the server's code and message", async () => {
    reply = {
      status: 401,
      data: {
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Email or password is incorrect",
        },
      },
    };

    const error: unknown = await authApiService
      .login({ email: user.email, password })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 401,
      code: "INVALID_CREDENTIALS",
      message: "Email or password is incorrect",
    });
    // A 401 from login is final: no refresh attempt.
    expect(calls.map((call) => call.url)).toEqual(["/auth/login"]);
  });
});

describe("authApiService.getMe", () => {
  it("gets the signed-in user with their permissions", async () => {
    const me = { ...user, permissions: ["event:read"] };
    reply = { status: 200, data: { data: me } };

    await expect(authApiService.getMe()).resolves.toEqual(me);
    expect(sent()).toMatchObject({ method: "get", url: "/auth/me" });
  });

  it("rejects an answer without permissions", async () => {
    reply = { status: 200, data: { data: user } };

    await expect(authApiService.getMe()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
});

describe("authApiService.logout", () => {
  it("posts to the logout URL with no body and resolves with nothing (204)", async () => {
    await expect(authApiService.logout()).resolves.toBeUndefined();
    expect(sent()).toEqual({
      method: "post",
      url: "/auth/logout",
      body: undefined,
    });
  });
});

describe("authApiService signups", () => {
  const answer = {
    email: user.email,
    verificationEmailSent: true,
    verificationCodeExpiresInMinutes: 10,
  };
  const base = {
    firstName: "Meera",
    lastName: "Shah",
    email: user.email,
    password,
    confirmPassword: password,
  };

  it("signUpUser posts the attendee's details and returns the signup answer", async () => {
    reply = { status: 201, data: { data: answer } };
    const body = { ...base, city: "Pune" };

    await expect(authApiService.signUpUser(body)).resolves.toEqual(answer);
    expect(sent()).toEqual({
      method: "post",
      url: "/auth/signup/user",
      body,
    });
  });

  it("signUpOrganizer posts the organizer's details and returns the signup answer", async () => {
    reply = { status: 201, data: { data: answer } };
    const body = { ...base, organizationName: "Acme Events" };

    await expect(authApiService.signUpOrganizer(body)).resolves.toEqual(answer);
    expect(sent()).toEqual({
      method: "post",
      url: "/auth/signup/organizer",
      body,
    });
  });

  it("rejects a signup answer without the code's lifetime", async () => {
    reply = {
      status: 201,
      data: { data: { email: user.email, verificationEmailSent: true } },
    };

    await expect(authApiService.signUpUser(base)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("passes the field errors of a refused signup on to the form", async () => {
    reply = {
      status: 400,
      data: {
        error: {
          code: "VALIDATION_ERROR",
          message: "Check the highlighted fields",
          details: { fieldErrors: { email: ["Enter a valid email"] } },
        },
      },
    };

    await expect(
      authApiService.signUpOrganizer({ ...base, organizationName: "Acme" }),
    ).rejects.toEqual(
      expect.objectContaining({
        status: 400,
        fieldErrors: { email: ["Enter a valid email"] },
      }),
    );
  });
});

describe("authApiService: 204 actions", () => {
  const token = "link-token";

  it.each([
    {
      name: "verifyEmail",
      call: () => authApiService.verifyEmail({ token, otp: "123456" }),
      url: "/auth/verify-email",
      body: { token, otp: "123456" },
    },
    {
      name: "resendOtp",
      call: () => authApiService.resendOtp({ email: user.email }),
      url: "/auth/resend-otp",
      body: { email: user.email },
    },
    {
      name: "completeAccountSetup",
      call: () =>
        authApiService.completeAccountSetup({
          token,
          password,
          confirmPassword: password,
        }),
      url: "/auth/account-setup",
      body: { token, password, confirmPassword: password },
    },
    {
      name: "forgotPassword",
      call: () => authApiService.forgotPassword({ email: user.email }),
      url: "/auth/forgot-password",
      body: { email: user.email },
    },
    {
      name: "resetPassword",
      call: () =>
        authApiService.resetPassword({
          token,
          password,
          confirmPassword: password,
        }),
      url: "/auth/reset-password",
      body: { token, password, confirmPassword: password },
    },
  ])("$name posts its body to $url and resolves with nothing", async (c) => {
    await expect(c.call()).resolves.toBeUndefined();
    expect(sent()).toEqual({ method: "post", url: c.url, body: c.body });
  });

  it("turns an expired link into an ApiError the screen can show", async () => {
    reply = {
      status: 400,
      data: {
        error: { code: "TOKEN_INVALID", message: "This link has expired" },
      },
    };

    await expect(
      authApiService.resetPassword({
        token,
        password,
        confirmPassword: password,
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: "TOKEN_INVALID",
      message: "This link has expired",
    });
  });

  it("turns an answer that is not our error envelope into a generic error", async () => {
    reply = { status: 502, data: "<html>Bad gateway</html>" };

    await expect(
      authApiService.forgotPassword({ email: user.email }),
    ).rejects.toMatchObject({
      status: 502,
      code: "UNKNOWN",
      message: "Something went wrong",
    });
  });
});
