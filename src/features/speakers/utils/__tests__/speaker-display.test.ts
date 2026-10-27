import { bioParagraphs, roleLine, speakerFullName } from "../speaker-display";

describe("speakerFullName", () => {
  it("joins first and last name", () => {
    expect(speakerFullName({ firstName: "Ananya", lastName: "Rao" })).toBe(
      "Ananya Rao",
    );
  });
});

describe("roleLine", () => {
  it("shows the job title and the company", () => {
    expect(roleLine({ jobTitle: "CTO", company: "Acme" })).toBe("CTO · Acme");
  });

  it("leaves out whichever is missing", () => {
    expect(roleLine({ jobTitle: "CTO", company: null })).toBe("CTO");
    expect(roleLine({ jobTitle: null, company: "Acme" })).toBe("Acme");
  });

  it("is null when there is neither", () => {
    expect(roleLine({ jobTitle: null, company: null })).toBeNull();
  });
});

describe("bioParagraphs", () => {
  it("turns the blocks into one plain-text paragraph each", () => {
    const bio = [
      { type: "paragraph", children: [{ type: "text", text: "First." }] },
      { type: "paragraph", children: [{ type: "text", text: "Second." }] },
    ];

    expect(bioParagraphs(bio)).toEqual(["First.", "Second."]);
  });

  it("is empty when there is no bio, or only blank blocks", () => {
    expect(bioParagraphs([])).toEqual([]);
    expect(
      bioParagraphs([
        { type: "paragraph", children: [{ type: "text", text: "  " }] },
      ]),
    ).toEqual([]);
  });
});
