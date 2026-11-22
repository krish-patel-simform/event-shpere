import {
  RATE_LIMIT_POLICIES,
  type IpRateLimitPolicyName,
  type RateLimitPolicyName,
  type UserRateLimitPolicyName,
} from "../rate-limit-policies";

const entries = Object.entries(RATE_LIMIT_POLICIES) as [
  RateLimitPolicyName,
  (typeof RATE_LIMIT_POLICIES)[RateLimitPolicyName],
][];

const keyedBy = (kind: "ip" | "user") =>
  entries.filter(([, policy]) => policy.keyedBy === kind).map(([name]) => name);

describe("RATE_LIMIT_POLICIES", () => {
  it.each(entries)(
    "%s allows a positive whole number of requests in a positive window",
    (_name, policy) => {
      expect(Number.isInteger(policy.limit)).toBe(true);
      expect(policy.limit).toBeGreaterThan(0);
      expect(Number.isInteger(policy.windowSeconds)).toBe(true);
      expect(policy.windowSeconds).toBeGreaterThan(0);
      expect(["open", "closed"]).toContain(policy.failMode);
    },
  );

  it("splits the policies into IP ones and user ones", () => {
    // These lists only compile when the names really are of that kind.
    const ipPolicies: IpRateLimitPolicyName[] = [
      "global-ip",
      "auth-ip",
      "refresh-ip",
      "public-read-ip",
    ];
    const userPolicies: UserRateLimitPolicyName[] = [
      "user-read",
      "user-write",
      "user-upload",
    ];

    expect(keyedBy("ip").sort()).toEqual([...ipPolicies].sort());
    expect(keyedBy("user").sort()).toEqual([...userPolicies].sort());
  });

  it("a user policy is not accepted where an IP policy is expected (and the other way round)", () => {
    // @ts-expect-error a signed-in policy is not an IP policy
    const wrongIp: IpRateLimitPolicyName = "user-write";
    // @ts-expect-error an IP policy is not a signed-in policy
    const wrongUser: UserRateLimitPolicyName = "auth-ip";

    expect(RATE_LIMIT_POLICIES[wrongIp].keyedBy).toBe("user");
    expect(RATE_LIMIT_POLICIES[wrongUser].keyedBy).toBe("ip");
  });

  it("has the four defaults route() picks, each keyed the way route() keys it", () => {
    // route-handler.ts: public routes count by IP, signed-in routes by user id.
    expect(RATE_LIMIT_POLICIES["public-read-ip"].keyedBy).toBe("ip");
    expect(RATE_LIMIT_POLICIES["auth-ip"].keyedBy).toBe("ip");
    expect(RATE_LIMIT_POLICIES["user-read"].keyedBy).toBe("user");
    expect(RATE_LIMIT_POLICIES["user-write"].keyedBy).toBe("user");
  });

  it("allows more reads than writes, for the public and for signed-in users", () => {
    const perSecond = (name: RateLimitPolicyName) =>
      RATE_LIMIT_POLICIES[name].limit / RATE_LIMIT_POLICIES[name].windowSeconds;

    expect(perSecond("public-read-ip")).toBeGreaterThan(perSecond("auth-ip"));
    expect(perSecond("user-read")).toBeGreaterThan(perSecond("user-write"));
  });

  it("fails closed for logins and writes, so a Redis outage never lets password guesses through", () => {
    expect(RATE_LIMIT_POLICIES["auth-ip"].failMode).toBe("closed");
    expect(RATE_LIMIT_POLICIES["user-write"].failMode).toBe("closed");
    expect(RATE_LIMIT_POLICIES["user-upload"].failMode).toBe("closed");
  });

  it("fails open for reads, the session refresh and the global guard, so an outage does not lock everyone out", () => {
    expect(RATE_LIMIT_POLICIES["global-ip"].failMode).toBe("open");
    expect(RATE_LIMIT_POLICIES["refresh-ip"].failMode).toBe("open");
    expect(RATE_LIMIT_POLICIES["public-read-ip"].failMode).toBe("open");
    expect(RATE_LIMIT_POLICIES["user-read"].failMode).toBe("open");
  });

  it("the global guard (proxy, every request of an IP) is looser than any single IP policy", () => {
    const global = RATE_LIMIT_POLICIES["global-ip"];

    for (const name of keyedBy("ip")) {
      if (name === "global-ip") continue;
      const policy = RATE_LIMIT_POLICIES[name];
      expect(global.limit / global.windowSeconds).toBeGreaterThan(
        policy.limit / policy.windowSeconds,
      );
    }
  });
});
