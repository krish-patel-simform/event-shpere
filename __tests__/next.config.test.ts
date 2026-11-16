import type { NextConfig } from "next";

type Header = { key: string; value: string };

/**
 * next.config.ts reads NODE_ENV and STRAPI_URL when it is loaded, so each test loads a fresh
 * copy with the environment it needs.
 */
async function loadConfig(
  env: Record<string, string | undefined> = {},
): Promise<NextConfig> {
  jest.replaceProperty(process, "env", { ...process.env, ...env });
  let config: NextConfig | undefined;
  await jest.isolateModulesAsync(async () => {
    config = (await import("../next.config")).default;
  });
  if (!config) throw new Error("next.config did not load");
  return config;
}

/** The headers sent on every path. */
async function headersOf(config: NextConfig): Promise<Map<string, string>> {
  const rules = (await config.headers?.()) ?? [];
  const everyPath = rules.find((rule) => rule.source === "/:path*");
  if (!everyPath) throw new Error("no header rule for every path");
  return new Map(
    (everyPath.headers as Header[]).map(({ key, value }) => [key, value]),
  );
}

/** "a b; c d" → { a: "b", c: "d" }: one entry per CSP directive. */
function directives(csp: string): Record<string, string> {
  return Object.fromEntries(
    csp.split(";").map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name, values.join(" ")];
    }),
  );
}

afterEach(() => jest.restoreAllMocks());

describe("next.config security headers", () => {
  it("does not announce the framework (no X-Powered-By)", async () => {
    expect((await loadConfig()).poweredByHeader).toBe(false);
  });

  it("sends the security headers on every path, pages and API alike", async () => {
    const headers = await headersOf(await loadConfig());

    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headers.get("Strict-Transport-Security")).toBe("max-age=31536000");
  });

  it("keeps HSTS free of includeSubDomains and preload, which are hard to undo", async () => {
    const headers = await headersOf(await loadConfig());

    expect(headers.get("Strict-Transport-Security")).not.toMatch(
      /includeSubDomains|preload/,
    );
  });

  it("sends the CSP as report-only for now, so it cannot break a page", async () => {
    const headers = await headersOf(await loadConfig());

    expect(headers.has("Content-Security-Policy-Report-Only")).toBe(true);
    expect(headers.has("Content-Security-Policy")).toBe(false);
  });

  it("the CSP blocks plugins, base tag tricks, foreign form targets and framing", async () => {
    const csp = directives(
      (await headersOf(await loadConfig())).get(
        "Content-Security-Policy-Report-Only",
      ) ?? "",
    );

    expect(csp["default-src"]).toBe("'self'");
    expect(csp["object-src"]).toBe("'none'");
    expect(csp["base-uri"]).toBe("'self'");
    expect(csp["form-action"]).toBe("'self'");
    expect(csp["frame-ancestors"]).toBe("'none'");
  });

  it("allows images and calls to the CMS host, by origin only (no path)", async () => {
    const csp = directives(
      (
        await headersOf(
          await loadConfig({ STRAPI_URL: "https://cms.example.com/api" }),
        )
      ).get("Content-Security-Policy-Report-Only") ?? "",
    );

    expect(csp["img-src"]).toContain("https://cms.example.com");
    expect(csp["connect-src"]).toContain("https://cms.example.com");
    expect(csp["img-src"]).not.toContain("/api");
  });

  it("falls back to the local CMS address when STRAPI_URL is not set", async () => {
    const csp = directives(
      (await headersOf(await loadConfig({ STRAPI_URL: undefined }))).get(
        "Content-Security-Policy-Report-Only",
      ) ?? "",
    );

    expect(csp["img-src"]).toContain("http://localhost:1337");
  });

  it("outside development there is no 'unsafe-eval' and no websocket allowance", async () => {
    const csp = directives(
      (await headersOf(await loadConfig({ NODE_ENV: "production" }))).get(
        "Content-Security-Policy-Report-Only",
      ) ?? "",
    );

    expect(csp["script-src"]).not.toContain("'unsafe-eval'");
    expect(csp["connect-src"]).not.toContain("ws:");
  });

  it("in development it allows 'unsafe-eval' (React's dev tooling) and ws: (hot reload)", async () => {
    const csp = directives(
      (await headersOf(await loadConfig({ NODE_ENV: "development" }))).get(
        "Content-Security-Policy-Report-Only",
      ) ?? "",
    );

    expect(csp["script-src"]).toContain("'unsafe-eval'");
    expect(csp["connect-src"]).toContain("ws:");
  });
});
