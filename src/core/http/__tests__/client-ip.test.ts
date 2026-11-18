import { NextRequest } from "next/server";
import { getClientIp } from "../client-ip";

function requestWith(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/events", { headers });
}

describe("getClientIp", () => {
  it("returns the address in x-forwarded-for", () => {
    expect(getClientIp(requestWith({ "x-forwarded-for": "203.0.113.7" }))).toBe(
      "203.0.113.7",
    );
  });

  it("returns the FIRST address of a list: the client, not the proxies after it", () => {
    expect(
      getClientIp(
        requestWith({ "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2" }),
      ),
    ).toBe("203.0.113.7");
  });

  it("trims the spaces around the address", () => {
    expect(
      getClientIp(
        requestWith({ "x-forwarded-for": "  203.0.113.7  , 10.0.0.1" }),
      ),
    ).toBe("203.0.113.7");
  });

  it("returns an IPv6 address whole (it contains colons)", () => {
    expect(
      getClientIp(requestWith({ "x-forwarded-for": "2001:db8::1, 10.0.0.1" })),
    ).toBe("2001:db8::1");
  });

  it("falls back to 'local' when the header is missing", () => {
    expect(getClientIp(requestWith())).toBe("local");
  });

  it("falls back to 'local' when the header is empty", () => {
    expect(getClientIp(requestWith({ "x-forwarded-for": "" }))).toBe("local");
    expect(getClientIp(requestWith({ "x-forwarded-for": "   " }))).toBe(
      "local",
    );
  });

  it("works with the NextRequest a route handler receives", () => {
    const req = new NextRequest("http://localhost/api/events", {
      headers: { "x-forwarded-for": "198.51.100.4" },
    });

    expect(getClientIp(req)).toBe("198.51.100.4");
  });
});
