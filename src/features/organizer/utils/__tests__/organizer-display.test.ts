import {
  daysWaiting,
  defaultSort,
  ORGANIZER_TABS,
  organizerStatus,
  OVERDUE_AFTER_DAYS,
  SORT_OPTIONS,
  STATUS_BADGES,
  TAB_DESCRIPTIONS,
  tabVerification,
  waitingLabel,
} from "../organizer-display";
import { organizerVerificationFilters } from "../../schemas/organizer.schemas";

describe("daysWaiting", () => {
  it("counts whole days between the application and the reference time", () => {
    expect(daysWaiting("2026-10-12T09:00:00Z", "2026-10-26T12:00:00Z")).toBe(
      14,
    );
  });

  it("does not round a partial day up", () => {
    expect(daysWaiting("2026-10-25T13:00:00Z", "2026-10-26T12:00:00Z")).toBe(0);
  });

  it("is never negative, even if the application is dated after the reference", () => {
    expect(daysWaiting("2026-10-27T09:00:00Z", "2026-10-26T12:00:00Z")).toBe(0);
  });
});

describe("waitingLabel", () => {
  it.each([
    [0, "Applied today"],
    [1, "1 day waiting"],
    [6, "6 days waiting"],
  ])("%i days → %s", (days, label) => {
    expect(waitingLabel(days)).toBe(label);
  });
});

describe("ORGANIZER_TABS", () => {
  it("has 'all' first, then one tab per list the API can give, waiting list first", () => {
    expect(ORGANIZER_TABS.map((tab) => tab.key)).toEqual([
      "all",
      ...organizerVerificationFilters,
    ]);
  });

  it("describes every tab", () => {
    for (const { key } of ORGANIZER_TABS) {
      expect(TAB_DESCRIPTIONS[key]).not.toBe("");
    }
  });
});

describe("tabVerification", () => {
  it.each(["pending", "verified", "rejected"] as const)(
    "the %s tab asks for that list",
    (tab) => {
      expect(tabVerification(tab)).toBe(tab);
    },
  );

  it("the 'all' tab asks for no verification filter", () => {
    expect(tabVerification("all")).toBeUndefined();
  });
});

describe("organizerStatus", () => {
  it("is approved when verified, rejected when rejected, otherwise awaiting a decision", () => {
    expect(
      organizerStatus({ verifiedAt: "2026-03-02T10:00:00Z", rejectedAt: null }),
    ).toBe("verified");
    expect(
      organizerStatus({ verifiedAt: null, rejectedAt: "2026-08-22T10:00:00Z" }),
    ).toBe("rejected");
    expect(organizerStatus({ verifiedAt: null, rejectedAt: null })).toBe(
      "pending",
    );
  });

  it("has a badge for every status", () => {
    expect(STATUS_BADGES.pending.label).toBe("Awaiting approval");
    expect(STATUS_BADGES.verified.tone).toBe("success");
    expect(STATUS_BADGES.rejected.tone).toBe("danger");
  });
});

describe("defaultSort", () => {
  it("shows the waiting list oldest first (a queue) and the others newest first", () => {
    expect(defaultSort("pending")).toBe("oldest");
    expect(defaultSort("verified")).toBe("newest");
    expect(defaultSort("rejected")).toBe("newest");
    expect(defaultSort("all")).toBe("newest");
  });

  it("is always one of the choices the tab offers", () => {
    for (const { key } of ORGANIZER_TABS) {
      expect(SORT_OPTIONS[key].map((option) => option.value)).toContain(
        defaultSort(key),
      );
    }
  });
});

describe("SORT_OPTIONS", () => {
  it("offers both directions on every tab, named after that list's date", () => {
    expect(SORT_OPTIONS.verified.map((option) => option.label)).toEqual([
      "Recently approved",
      "Earliest approved",
    ]);
    for (const { key } of ORGANIZER_TABS) {
      expect(SORT_OPTIONS[key].map((option) => option.value).sort()).toEqual([
        "newest",
        "oldest",
      ]);
    }
  });
});

describe("OVERDUE_AFTER_DAYS", () => {
  it("is the point from which the design shows the wait in red (9 days, not 8)", () => {
    expect(8 > OVERDUE_AFTER_DAYS).toBe(false);
    expect(9 > OVERDUE_AFTER_DAYS).toBe(true);
  });
});
