import type { AdminUser } from "../../types/admin-users";
import { ADMIN_USERS_SAMPLE } from "../admin-users.sample";
import {
  formatLastActive,
  matchesTab,
  matchesUserSearch,
  roleBadge,
  sortUsers,
  statusBadge,
  userFullName,
} from "../user-display";

const ASOF = "2026-10-26T12:00:00Z";
const [ananya, kavya, rahul, admin, meera, fatima, dev, vikram] =
  ADMIN_USERS_SAMPLE.users;

describe("roleBadge", () => {
  it.each([
    [{ role: "user", organizerStatus: null }, "Attendee", "brand"],
    [{ role: "speaker", organizerStatus: null }, "Speaker", "success"],
    [{ role: "admin", organizerStatus: null }, "Administrator", "surface"],
    [
      { role: "organizer", organizerStatus: "verified" },
      "Organizer",
      "neutral",
    ],
    [
      { role: "organizer", organizerStatus: "pending" },
      "Organizer pending",
      "warning",
    ],
    [
      { role: "organizer", organizerStatus: "rejected" },
      "Organizer rejected",
      "danger",
    ],
  ] as const)("%j → %s", (user, label, tone) => {
    expect(roleBadge(user)).toEqual({ label, tone });
  });
});

describe("statusBadge", () => {
  it("labels each account status", () => {
    expect(statusBadge("active").label).toBe("Active");
    expect(statusBadge("suspended")).toEqual({
      label: "Suspended",
      tone: "danger",
    });
    expect(statusBadge("pending").label).toBe("Pending");
  });
});

describe("formatLastActive", () => {
  it.each([
    [null, "Never"],
    ["2026-10-26T11:30:00Z", "Just now"],
    ["2026-10-26T11:00:00Z", "1 hour ago"],
    ["2026-10-26T09:00:00Z", "3 hours ago"],
    ["2026-10-25T23:00:00Z", "Yesterday"],
    ["2026-10-25T01:00:00Z", "Yesterday"],
    ["2026-10-20T09:00:00Z", "20 Oct 2026"],
  ])("%s → %s", (lastActiveAt, text) => {
    expect(formatLastActive(lastActiveAt, ASOF)).toBe(text);
  });

  it("calls a time after the reference 'Just now' rather than printing a negative", () => {
    expect(formatLastActive("2026-10-26T12:05:00Z", ASOF)).toBe("Just now");
  });
});

describe("userFullName", () => {
  it("joins first and last name", () => {
    expect(userFullName(ananya)).toBe("Ananya Rao");
  });
});

describe("matchesTab", () => {
  it("'all' matches everyone", () => {
    expect(
      ADMIN_USERS_SAMPLE.users.every((user) => matchesTab(user, "all")),
    ).toBe(true);
  });

  it("role tabs match the user's single role", () => {
    expect(matchesTab(rahul, "user")).toBe(true);
    expect(matchesTab(rahul, "speaker")).toBe(false);
    expect(matchesTab(kavya, "organizer")).toBe(true);
    expect(matchesTab(admin, "admin")).toBe(true);
  });

  it("'unverified' matches accounts whose email is not confirmed", () => {
    expect(matchesTab(fatima, "unverified")).toBe(true);
    expect(matchesTab(vikram, "unverified")).toBe(true);
    expect(matchesTab(rahul, "unverified")).toBe(false);
  });

  it("'suspended' matches suspended accounts only", () => {
    expect(matchesTab(dev, "suspended")).toBe(true);
    expect(matchesTab(rahul, "suspended")).toBe(false);
  });
});

describe("matchesUserSearch", () => {
  it("matches name or email, ignoring case and surrounding spaces", () => {
    expect(matchesUserSearch(meera, "  MEERA j ")).toBe(true);
    expect(matchesUserSearch(meera, "joshi@example")).toBe(true);
  });

  it("an empty search matches everyone; an unknown one matches no one", () => {
    expect(matchesUserSearch(meera, "   ")).toBe(true);
    expect(matchesUserSearch(meera, "nobody")).toBe(false);
  });
});

describe("sortUsers", () => {
  const names = (users: AdminUser[]) => users.map(userFullName);

  it("newest joined first", () => {
    expect(
      names(sortUsers(ADMIN_USERS_SAMPLE.users, "newest")).slice(0, 2),
    ).toEqual(["Vikram Mehta", "Ananya Rao"]);
  });

  it("name A–Z", () => {
    expect(names(sortUsers(ADMIN_USERS_SAMPLE.users, "name"))[0]).toBe(
      "Admin User",
    );
    expect(names(sortUsers(ADMIN_USERS_SAMPLE.users, "name")).at(-1)).toBe(
      "Vikram Mehta",
    );
  });

  it("most recently active first, and people who never logged in last", () => {
    const sorted = sortUsers(ADMIN_USERS_SAMPLE.users, "seen");

    expect(userFullName(sorted[0])).toBe("Admin User");
    expect(sorted.slice(-2).map((user) => user.lastActiveAt)).toEqual([
      null,
      null,
    ]);
  });

  it("does not change the array it is given", () => {
    const before = [...ADMIN_USERS_SAMPLE.users];

    sortUsers(ADMIN_USERS_SAMPLE.users, "name");

    expect(ADMIN_USERS_SAMPLE.users).toEqual(before);
  });
});
