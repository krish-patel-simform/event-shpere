import { AxiosError, type AxiosAdapter } from "axios";
import { z } from "zod";
import { ApiError, apiRequest, baseApiService } from "../base-api.service";

type Reply = { status: number; data?: unknown };
type Call = { method: string | undefined; url: string; body: unknown };

const unauthorized: Reply = {
  status: 401,
  data: { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
};
const refreshed: Reply = { status: 204 };
const meSchema = z.object({ id: z.string() });

// A fake server: the axios adapter is the last step before the network, so replacing it keeps
// every interceptor real while the replies are scripted per test.
let calls: Call[];
let reply: (url: string, attempt: number) => Reply;

const fakeServer: AxiosAdapter = async (config) => {
  const url = config.url ?? "";
  const body: unknown =
    typeof config.data === "string" ? JSON.parse(config.data) : config.data;
  calls.push({ method: config.method, url, body });
  // The refresh takes a moment, so parallel requests really do overlap with it.
  if (url === "/auth/refresh") await new Promise((r) => setTimeout(r, 5));

  const attempt = calls.filter((call) => call.url === url).length;
  const { status, data } = reply(url, attempt);
  const response = { data, status, statusText: "", headers: {}, config };
  if (status >= 200 && status < 300) return response;
  throw new AxiosError("failed", "ERR_BAD_REQUEST", config, null, response);
};

const urls = () => calls.map((call) => call.url);

const originalAdapter = baseApiService.defaults.adapter;
beforeAll(() => {
  baseApiService.defaults.adapter = fakeServer;
});
afterAll(() => {
  baseApiService.defaults.adapter = originalAdapter;
});
beforeEach(() => {
  calls = [];
  reply = () => ({ status: 200, data: { data: { id: "u1" } } });
});

const getMe = () => apiRequest({ method: "GET", url: "/auth/me" }, meSchema);

describe("response interceptor: refresh on 401", () => {
  it("a 401 refreshes the session, then sends the same request again and returns its data", async () => {
    reply = (url, attempt) => {
      if (url === "/auth/refresh") return refreshed;
      return attempt === 1
        ? unauthorized
        : { status: 200, data: { data: { id: "u1" } } };
    };

    await expect(getMe()).resolves.toEqual({ id: "u1" });
    expect(urls()).toEqual(["/auth/me", "/auth/refresh", "/auth/me"]);
    expect(calls[1].method).toBe("post");
  });

  it("re-sends a request with a body unchanged", async () => {
    reply = (url, attempt) => {
      if (url === "/auth/refresh") return refreshed;
      return attempt === 1 ? unauthorized : { status: 204 };
    };

    await apiRequest({
      method: "POST",
      url: "/things",
      data: { name: "Gala" },
    });

    expect(urls()).toEqual(["/things", "/auth/refresh", "/things"]);
    expect(calls[2].body).toEqual({ name: "Gala" });
  });

  it("when the refresh fails, the original 401 is reported and the request is not re-sent", async () => {
    reply = (url) => (url === "/auth/refresh" ? unauthorized : unauthorized);

    await expect(getMe()).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      code: "UNAUTHENTICATED",
    });
    expect(urls()).toEqual(["/auth/me", "/auth/refresh"]);
  });

  it("when the refresh cannot be reached (network down), the original 401 is reported", async () => {
    const adapter = baseApiService.defaults.adapter;
    baseApiService.defaults.adapter = async (config) => {
      if (config.url === "/auth/refresh") {
        throw new AxiosError("Network Error", "ERR_NETWORK", config);
      }
      return fakeServer(config);
    };
    reply = () => unauthorized;

    await expect(getMe()).rejects.toMatchObject({ status: 401 });

    baseApiService.defaults.adapter = adapter;
  });

  it("a 401 on the re-sent request is final: one refresh at most, no loop", async () => {
    reply = (url) => (url === "/auth/refresh" ? refreshed : unauthorized);

    await expect(getMe()).rejects.toMatchObject({ status: 401 });
    expect(urls()).toEqual(["/auth/me", "/auth/refresh", "/auth/me"]);
  });

  it("wrong login details (401 from /auth/login) never trigger a refresh", async () => {
    reply = () => ({
      status: 401,
      data: {
        error: {
          code: "UNAUTHENTICATED",
          message: "Invalid email or password",
        },
      },
    });

    await expect(
      apiRequest({ method: "POST", url: "/auth/login", data: {} }),
    ).rejects.toMatchObject({
      status: 401,
      message: "Invalid email or password",
    });
    expect(urls()).toEqual(["/auth/login"]);
  });

  it.each([403, 404, 429, 500])(
    "a %i is passed on without a refresh",
    async (status) => {
      reply = () => ({
        status,
        data: { error: { code: "SOME_CODE", message: "Nope" } },
      });

      await expect(getMe()).rejects.toMatchObject({
        status,
        code: "SOME_CODE",
      });
      expect(urls()).toEqual(["/auth/me"]);
    },
  );

  it("requests that fail together share one refresh, and each is re-sent", async () => {
    const seen = new Set<string>();
    reply = (url) => {
      if (url === "/auth/refresh") return refreshed;
      // Each endpoint answers 401 on its first call and 200 after.
      if (!seen.has(url)) {
        seen.add(url);
        return unauthorized;
      }
      return { status: 200, data: { data: { id: url } } };
    };

    const results = await Promise.all([
      apiRequest({ method: "GET", url: "/a" }, meSchema),
      apiRequest({ method: "GET", url: "/b" }, meSchema),
      apiRequest({ method: "GET", url: "/c" }, meSchema),
    ]);

    expect(results).toEqual([{ id: "/a" }, { id: "/b" }, { id: "/c" }]);
    expect(urls().filter((url) => url === "/auth/refresh")).toHaveLength(1);
    expect(urls()).toHaveLength(7); // 3 first tries + 1 refresh + 3 re-sends
  });

  it("a later 401 starts a new refresh (the shared one is cleared once it settles)", async () => {
    let meCalls = 0;
    reply = (url) => {
      if (url === "/auth/refresh") return refreshed;
      meCalls += 1;
      // Calls 1 and 3 are 401s: the first and the second expiry.
      return meCalls % 2 === 1
        ? unauthorized
        : { status: 200, data: { data: { id: "u1" } } };
    };

    await getMe();
    await getMe();

    expect(urls().filter((url) => url === "/auth/refresh")).toHaveLength(2);
  });

  it("errors stay typed: the caller gets an ApiError", async () => {
    reply = () => ({
      status: 409,
      data: { error: { code: "EMAIL_TAKEN", message: "Taken" } },
    });

    await expect(getMe()).rejects.toBeInstanceOf(ApiError);
  });
});
