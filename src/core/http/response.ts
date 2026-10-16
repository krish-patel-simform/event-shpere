// Success envelopes: `{ data }`, or `{ data, meta }` for lists. Every route returns one of these.

export type PageMeta = { page: number; pageSize: number; total: number };

export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ data }, { status: 200, ...init });
}

export function paginated<T>(data: T[], meta: PageMeta): Response {
  return Response.json({ data, meta }, { status: 200 });
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
