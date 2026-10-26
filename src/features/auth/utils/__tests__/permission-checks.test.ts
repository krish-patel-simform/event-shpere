import {
  hasAllPermissionCodes,
  hasAnyPermissionCode,
  hasPermissionCode,
} from "../permission-checks";

const granted = new Set(["EVENT_CREATE", "EVENT_MANAGE_OWN"]);

describe("hasPermissionCode", () => {
  it("is true only for a granted code", () => {
    expect(hasPermissionCode(granted, "EVENT_CREATE")).toBe(true);
    expect(hasPermissionCode(granted, "USER_VIEW")).toBe(false);
  });

  it("is false for everything when nothing is granted (still loading or signed out)", () => {
    expect(hasPermissionCode(new Set(), "EVENT_CREATE")).toBe(false);
  });
});

describe("hasAnyPermissionCode", () => {
  it("is true when at least one code is granted", () => {
    expect(hasAnyPermissionCode(granted, ["USER_VIEW", "EVENT_CREATE"])).toBe(
      true,
    );
  });

  it("is false when none is granted", () => {
    expect(hasAnyPermissionCode(granted, ["USER_VIEW", "POLL_VOTE"])).toBe(
      false,
    );
  });

  it("is false for an empty list", () => {
    expect(hasAnyPermissionCode(granted, [])).toBe(false);
  });
});

describe("hasAllPermissionCodes", () => {
  it("is true when every code is granted", () => {
    expect(
      hasAllPermissionCodes(granted, ["EVENT_CREATE", "EVENT_MANAGE_OWN"]),
    ).toBe(true);
  });

  it("is false when one code is missing", () => {
    expect(hasAllPermissionCodes(granted, ["EVENT_CREATE", "USER_VIEW"])).toBe(
      false,
    );
  });

  it("is true for an empty list, like the server's assertPermission", () => {
    expect(hasAllPermissionCodes(granted, [])).toBe(true);
  });
});
