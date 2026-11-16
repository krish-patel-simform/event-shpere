import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// The CMS host: its pictures load as plain <img> and the browser may call it. Same default as
// STRAPI_URL in src/config/env.ts (that file is server-only, so it is not imported here).
const strapiOrigin = new URL(process.env.STRAPI_URL ?? "http://localhost:1337")
  .origin;

// Report-only for now: the browser logs what it WOULD block, and blocks nothing. Read the
// "Content Security Policy" messages in the browser console on every page, add the hosts that
// are missing (Sentry, Stripe, Vercel Blob once they are installed), then rename the header
// below to "Content-Security-Policy" to enforce it.
// 'unsafe-inline' scripts: needed for the inline theme script in app/layout.tsx. A nonce would
// remove it, but nonces need dynamic rendering, which cacheComponents avoids.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: ${strapiOrigin}`,
  `connect-src 'self' ${strapiOrigin}${isDev ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  // Trust the declared file type; never guess it from the content.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Never shown inside another site's iframe. Needed next to frame-ancestors, which a
  // report-only CSP ignores.
  { key: "X-Frame-Options", value: "DENY" },
  // Other sites only get the origin, never the path or query. The pages whose URL carries a
  // token (verify-email, set-password, reset-password) send no referrer at all, set in their
  // metadata.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // HTTPS only for a year. No includeSubDomains or preload: both are hard to undo.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  /* config options here */
  // Do not tell everyone which framework this is (the X-Powered-By header).
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
