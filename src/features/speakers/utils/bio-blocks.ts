import type { StrapiBlocks } from "../../cms";

/**
 * The bio is edited as plain text (a textarea) and stored as Strapi blocks. Users never send
 * blocks JSON themselves, so they cannot inject node types the site does not expect.
 */

/** "Hello\n\nWorld" → two paragraph nodes. Blank lines separate paragraphs. */
export function textToBlocks(text: string): StrapiBlocks {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "")
    .map((paragraph) => ({
      type: "paragraph",
      children: [{ type: "text", text: paragraph }],
    }));
}

/** All text inside a node, however deep (paragraph → text, list → item → text, ...). */
function textOf(node: unknown): string {
  if (typeof node !== "object" || node === null) return "";
  if ("text" in node && typeof node.text === "string") return node.text;
  if ("children" in node && Array.isArray(node.children)) {
    return node.children.map(textOf).join("");
  }
  return "";
}

/** Back to plain text for the edit form: one blank line between top-level blocks. */
export function blocksToText(blocks: StrapiBlocks): string {
  return blocks
    .map(textOf)
    .filter((text) => text.trim() !== "")
    .join("\n\n");
}
