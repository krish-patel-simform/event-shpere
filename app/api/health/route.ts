import { ok, route } from "@/src/core/http";

// Liveness check: proves the route wrapper and envelope work end to end.
export const GET = route({ auth: "public" }, async () => ok({ status: "ok" }));
