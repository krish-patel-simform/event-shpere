import { z } from "zod";
import { createByteLimit } from "./byte-limit";
import { PayloadTooLargeError, ValidationError } from "./errors";

// Parse untrusted request input. A failure is the client's fault, so it becomes a 400
// ValidationError. (A plain ZodError reaching the wrapper means a *server* bug, e.g. a
// response that does not match its schema, and is treated as a 500.)

export function parseInput<S extends z.ZodType>(
  schema: S,
  input: unknown,
): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError("Invalid request", z.flattenError(result.error));
  }
  return result.data;
}

/**
 * The most a JSON body may be. Every form in the app is far below it; the largest, an event's
 * content, is about 200 KB even with multi-byte text. Image uploads are multipart and have
 * their own limits, so they never come through here.
 */
export const JSON_BODY_MAX_BYTES = 256 * 1024;

/**
 * Reads the body as text, but never more than `maxBytes` of it: a huge body is refused before it
 * is buffered, because Zod can only check it after it has been read and parsed.
 */
async function readBodyText(req: Request, maxBytes: number): Promise<string> {
  // Cheap early refusal. The header can be missing (chunked) or lie, so it is not enough alone.
  if (Number(req.headers.get("content-length")) > maxBytes) {
    throw new PayloadTooLargeError();
  }
  if (!req.body) return "";

  // The real guard: the stream is cut off as soon as it passes the limit.
  const limit = createByteLimit(maxBytes);
  try {
    return await new Response(req.body.pipeThrough(limit.stream)).text();
  } catch {
    if (limit.exceeded()) throw new PayloadTooLargeError();
    throw new ValidationError("Request body must be valid JSON");
  }
}

/**
 * Reads and validates a JSON body. Malformed JSON is a 400, not a 500; a body over
 * JSON_BODY_MAX_BYTES is a 413.
 */
export async function parseBody<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<z.infer<S>> {
  const text = await readBodyText(req, JSON_BODY_MAX_BYTES);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
  return parseInput(schema, body);
}

/** Validates the query string. Use z.coerce in the schema: every value arrives as a string. */
export function parseQuery<S extends z.ZodType>(
  req: Request,
  schema: S,
): z.infer<S> {
  const params = new URL(req.url).searchParams;
  return parseInput(schema, Object.fromEntries(params));
}
