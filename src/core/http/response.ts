// Success envelopes: `{ data }`, or `{ data, meta }` for lists. Every route returns one of these.

export type PageMeta = { page: number; pageSize: number; total: number };

/**
 * For a public GET whose answer changes with the cookie (an admin sees more than a guest). The
 * URL is the same for both, so a cache that goes by the URL could hand one person's answer to the
 * other: `private, no-store` tells every cache not to keep it, and `Vary: Cookie` is the safety
 * net if one keeps it anyway (one copy per cookie). Pass it as `init.headers`.
 */
export const PER_USER_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
} as const;

export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ data }, { status: 200, ...init });
}

/** `meta` may carry more than the paging fields (e.g. a total of a different kind). */
export function paginated<T, M extends PageMeta = PageMeta>(
  data: T[],
  meta: M,
  init?: ResponseInit,
): Response {
  return Response.json({ data, meta }, { status: 200, ...init });
}

/** 201. Pass `location` (the new resource's URL) so clients know where it lives. */
export function created<T>(data: T, location?: string): Response {
  return Response.json(
    { data },
    { status: 201, headers: location ? { Location: location } : undefined },
  );
}

/** 204: success with no body (e.g. DELETE). */
export function noContent(): Response {
  return new Response(null, { status: 204 });
}

export type ErrorBody = {
  error: { code: string; message: string; details?: unknown };
};

export function errorResponse(
  status: number,
  error: ErrorBody["error"],
): Response {
  return Response.json({ error } satisfies ErrorBody, { status });
}
