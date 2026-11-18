// What a request with no usable header is counted as. Fine for one developer locally; on Vercel
// the header is always set. If it were ever missing in production, everyone would share this one
// rate limit bucket.
const FALLBACK_IP = "local";

/**
 * The caller's IP, used as the rate limit key of a public route.
 *
 * `x-forwarded-for` is a list (`client, proxy1, proxy2`): each proxy appends the address it saw,
 * so the first entry is the client. On Vercel the platform sets this header itself, so a client
 * cannot choose its own value. Behind a proxy that does not overwrite it, anyone could send a
 * fake one and get a fresh limit every time: only trust it behind your own proxy.
 */
export function getClientIp(req: Pick<Request, "headers">): string {
  const first = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first || FALLBACK_IP;
}
