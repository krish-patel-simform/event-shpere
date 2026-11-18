import { NextResponse, type NextRequest } from "next/server";
import { globalRateLimit } from "@/src/core/http/global-rate-limit";

// Runs before every /api route (Next 16 "proxy", the old middleware). It uses the Node.js
// runtime by default, so it can talk to Redis. The logic lives in src/core/http so it can be
// tested; this file only connects it to Next.
export async function proxy(request: NextRequest) {
  return (await globalRateLimit(request)) ?? NextResponse.next();
}

// Only API requests: pages and static files are not counted.
export const config = {
  matcher: "/api/:path*",
};
