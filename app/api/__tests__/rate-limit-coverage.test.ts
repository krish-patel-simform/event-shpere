import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// Every route names its own rate limit, so a reader sees it in the route file. route() still has
// a default for a route that forgets, but that is only a safety net: this test is what makes
// "forgot" a failing build instead of a silent default.
const API_DIR = path.join(__dirname, "..");

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      return name === "__tests__" ? [] : routeFiles(full);
    }
    return name === "route.ts" ? [full] : [];
  });
}

// `export const GET = route(` or `route<{ id: string }>(`, then the options object's `{`.
const DECLARATION = /export const (GET|POST|PATCH|PUT|DELETE) = route\b/g;
const OPTIONS_START =
  /export const (GET|POST|PATCH|PUT|DELETE) = route(?:<[^(]*>)?\(\s*\{/g;

/** The text of the `{ ... }` that starts at `open`, by counting braces. */
function braceBlock(source: string, open: number): string {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}" && --depth === 0) return source.slice(open, i + 1);
  }
  throw new Error("Unbalanced braces in a route file");
}

type Handler = { file: string; method: string; options: string };

function handlersOf(file: string): { handlers: Handler[]; declared: number } {
  const source = readFileSync(file, "utf8");
  const handlers = [...source.matchAll(OPTIONS_START)].map((match) => ({
    file: path.relative(API_DIR, file),
    method: match[1],
    options: braceBlock(source, match.index + match[0].length - 1),
  }));
  return { handlers, declared: [...source.matchAll(DECLARATION)].length };
}

const parsed = routeFiles(API_DIR).map(handlersOf);
const handlers = parsed.flatMap((p) => p.handlers);

describe("rate limit coverage of the API routes", () => {
  it("finds every route handler, so a pattern that misses one cannot pass silently", () => {
    const declared = parsed.reduce((sum, p) => sum + p.declared, 0);

    expect(handlers.length).toBeGreaterThan(50);
    expect(handlers).toHaveLength(declared);
  });

  it("makes every handler name its own rateLimit", () => {
    const missing = handlers
      .filter((handler) => !/\brateLimit\s*:/.test(handler.options))
      .map((handler) => `${handler.file} ${handler.method}`);

    expect(missing).toEqual([]);
  });
});
