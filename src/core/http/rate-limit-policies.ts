/**
 * Every "N requests per window" limit in the app, by name. The only place a limit number
 * changes. Fixed rules (daily quotas, cooldowns, login failures) are not here: they have
 * their own constants next to the feature that owns them.
 */
export type RateLimitPolicy = {
  /** Most requests allowed in one window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
  /**
   * When Redis is down: "open" lets the request through (reads, the global guard), "closed"
   * fails it (auth, writes), because letting password guesses through unchecked is worse.
   */
  failMode: "open" | "closed";
  /**
   * What the limit counts by: the caller's IP (public routes, the only identity they have) or
   * the verified user id (signed-in routes). route() uses it to refuse a policy of the wrong
   * kind at compile time.
   */
  keyedBy: "ip" | "user";
};

export const RATE_LIMIT_POLICIES = {
  "global-ip": {
    limit: 600,
    windowSeconds: 60,
    failMode: "open",
    keyedBy: "ip",
  },
  // One budget for ALL public writes of an IP (login, signup, password reset...). 20, not 10:
  // a venue's Wi-Fi is one IP. Accounts are protected by the per-email login failure counter.
  "auth-ip": {
    limit: 20,
    windowSeconds: 60,
    failMode: "closed",
    keyedBy: "ip",
  },
  // Open: a refresh needs the secret refresh cookie, so it is no guessing target, and a Redis
  // outage must not stop everyone from renewing their session. The limit only stops loop bugs.
  "refresh-ip": {
    limit: 30,
    windowSeconds: 60,
    failMode: "open",
    keyedBy: "ip",
  },
  "public-read-ip": {
    limit: 120,
    windowSeconds: 60,
    failMode: "open",
    keyedBy: "ip",
  },
  "user-read": {
    limit: 120,
    windowSeconds: 60,
    failMode: "open",
    keyedBy: "user",
  },
  "user-write": {
    limit: 30,
    windowSeconds: 60,
    failMode: "closed",
    keyedBy: "user",
  },
  "user-upload": {
    limit: 10,
    windowSeconds: 60,
    failMode: "closed",
    keyedBy: "user",
  },
} as const satisfies Record<string, RateLimitPolicy>;

/** "auth-ip" | "user-write" | ...: a typo in a policy name is a compile error. */
export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;

type PolicyNameKeyedBy<K extends RateLimitPolicy["keyedBy"]> = {
  [
    N in RateLimitPolicyName
  ]: (typeof RATE_LIMIT_POLICIES)[N]["keyedBy"] extends K ? N : never;
}[RateLimitPolicyName];

/** The policies that count by IP: the only ones a public route accepts. */
export type IpRateLimitPolicyName = PolicyNameKeyedBy<"ip">;
/** The policies that count by user id: the only ones a signed-in route accepts. */
export type UserRateLimitPolicyName = PolicyNameKeyedBy<"user">;
