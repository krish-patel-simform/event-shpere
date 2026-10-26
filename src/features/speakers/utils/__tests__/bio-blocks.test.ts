import { blocksToText, textToBlocks } from "../bio-blocks";

describe("textToBlocks", () => {
  it("makes one paragraph per blank-line-separated chunk", () => {
    expect(textToBlocks("Hello there.\n\nSecond part.")).toEqual([
      { type: "paragraph", children: [{ type: "text", text: "Hello there." }] },
      { type: "paragraph", children: [{ type: "text", text: "Second part." }] },
    ]);
  });

  it("handles Windows line endings and extra blank lines", () => {
    expect(textToBlocks("One\r\n\r\n\r\n  Two  ")).toHaveLength(2);
  });

  it("returns no blocks for empty or blank text", () => {
    expect(textToBlocks("")).toEqual([]);
    expect(textToBlocks("  \n\n  ")).toEqual([]);
  });
});

describe("blocksToText", () => {
  it("round-trips text written in the form", () => {
    const text = "I build things.\n\nI speak about Postgres.";

    expect(blocksToText(textToBlocks(text))).toBe(text);
  });

  it("reads text from nested blocks edited in the Strapi admin (lists, links)", () => {
    expect(
      blocksToText([
        {
          type: "heading",
          level: 2,
          children: [{ type: "text", text: "About" }],
        },
        {
          type: "list",
          format: "unordered",
          children: [
            { type: "list-item", children: [{ type: "text", text: "Go" }] },
            {
              type: "list-item",
              children: [
                {
                  type: "link",
                  url: "https://x.test",
                  children: [{ type: "text", text: "Rust" }],
                },
              ],
            },
          ],
        },
      ]),
    ).toBe("About\n\nGoRust");
  });

  it("is empty for no blocks", () => {
    expect(blocksToText([])).toBe("");
  });
});
