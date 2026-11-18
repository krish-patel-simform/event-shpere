import { ok, route } from "@/src/core/http";

// Liveness check: proves the route wrapper and envelope work end to end. Never rate limited:
// monitoring must always get an answer, and it must not need Redis to say "alive".
export const GET = route({ auth: "public", rateLimit: "none" }, async () =>
  ok({ status: "ok" }),
);
