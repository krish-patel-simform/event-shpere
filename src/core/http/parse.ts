import { z } from "zod";
import { ValidationError } from "./errors";

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

/** Reads and validates a JSON body. Malformed JSON is a 400, not a 500. */
export async function parseBody<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await req.json();
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
