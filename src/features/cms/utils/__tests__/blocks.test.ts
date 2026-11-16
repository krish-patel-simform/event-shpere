import { blocksToText, textToBlocks } from "../blocks";

describe("textToBlocks", () => {
  it("turns blank-line separated text into paragraph blocks", () => {
    expect(textToBlocks("One\n\nTwo")).toEqual([
      { type: "paragraph", children: [{ type: "text", text: "One" }] },
      { type: "paragraph", children: [{ type: "text", text: "Two" }] },
    ]);
  });

  it("keeps a single line break inside its paragraph", () => {
    expect(textToBlocks("Line one\nLine two")).toEqual([
      {
        type: "paragraph",
        children: [{ type: "text", text: "Line one\nLine two" }],
      },
    ]);
  });

  it("understands Windows line endings and ignores extra blank lines", () => {
    expect(textToBlocks("One\r\n\r\n\r\n  \r\nTwo")).toHaveLength(2);
  });

  it("gives no blocks for an empty or blank text", () => {
    expect(textToBlocks("")).toEqual([]);
    expect(textToBlocks("  \n\n ")).toEqual([]);
  });

  it("only ever produces paragraph and text nodes, whatever the text says", () => {
    const blocks = textToBlocks(
      '<script>alert(1)</script>\n\n{"type":"heading"}',
    );

    expect(blocks.map((block) => block.type)).toEqual([
      "paragraph",
      "paragraph",
    ]);
  });
});

describe("blocksToText", () => {
  it("reads the text back, one blank line between blocks", () => {
    expect(blocksToText(textToBlocks("One\n\nTwo"))).toBe("One\n\nTwo");
  });

  it("finds text however deep it is nested (lists, formatted runs)", () => {
    const blocks = [
      {
        type: "list",
        children: [
          { type: "list-item", children: [{ type: "text", text: "First" }] },
          { type: "list-item", children: [{ type: "text", text: "Second" }] },
        ],
      },
      { type: "paragraph", children: [{ type: "text", text: "After" }] },
    ];

    expect(blocksToText(blocks)).toBe("FirstSecond\n\nAfter");
  });

  it("skips blocks without text", () => {
    expect(blocksToText([{ type: "paragraph", children: [] }])).toBe("");
  });
});
