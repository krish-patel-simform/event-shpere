import { ok, paginated, PER_USER_HEADERS } from "../response";

const meta = { page: 1, pageSize: 10, total: 2 };

describe("PER_USER_HEADERS", () => {
  it("tells every cache not to keep the answer, and to tell apart one cookie from another", () => {
    expect(PER_USER_HEADERS).toEqual({
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
    });
  });
});

describe("paginated", () => {
  it("answers 200 with { data, meta } and no extra headers by default", async () => {
    const res = paginated(["a", "b"], meta);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: ["a", "b"], meta });
    expect(res.headers.get("Cache-Control")).toBeNull();
  });

  it("adds the headers it is given, without changing the body or the status", async () => {
    const res = paginated(["a", "b"], meta, { headers: PER_USER_HEADERS });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: ["a", "b"], meta });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Vary")).toBe("Cookie");
  });
});

describe("ok", () => {
  it("adds the headers it is given, without changing the body or the status", async () => {
    const res = ok({ hello: "world" }, { headers: PER_USER_HEADERS });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { hello: "world" } });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Vary")).toBe("Cookie");
  });
});
