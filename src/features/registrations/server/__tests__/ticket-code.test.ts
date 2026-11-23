import { generateTicketCode } from "../ticket-code";

// The prefix, then 6 characters with no 0, 1, I or O.
const FORMAT = /^ESEVT[2-9A-HJ-NP-Z]{6}$/;

describe("generateTicketCode", () => {
  it("makes a code in the agreed format", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateTicketCode()).toMatch(FORMAT);
    }
  });

  it("never uses the look-alike characters 0, 1, I or O", () => {
    const random = Array.from({ length: 500 }, generateTicketCode)
      .map((code) => code.slice("ESEVT".length))
      .join("");

    expect(random).not.toMatch(/[01IO]/);
  });

  it("fits the 32-character column", () => {
    expect(generateTicketCode().length).toBeLessThanOrEqual(32);
  });

  it("gives a different code almost every time", () => {
    const codes = new Set(Array.from({ length: 1000 }, generateTicketCode));

    // 1000 draws from about a billion codes: a clash here would mean the generator is broken.
    expect(codes.size).toBe(1000);
  });
});
