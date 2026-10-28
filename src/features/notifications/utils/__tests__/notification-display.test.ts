import {
  allNotifications,
  NOW,
  sessionConfirmed,
} from "../../__fixtures__/notifications";
import { notificationSchema } from "../../schemas/notification.schema";
import {
  formatNotificationTime,
  groupByDay,
  groupKeyOf,
} from "../notification-display";
import {
  NOTIFICATION_PREFERENCES_SAMPLE,
  NOTIFICATIONS_SAMPLE,
  NOTIFICATIONS_SAMPLE_NOW,
} from "../notifications.sample";
import { NOTIFICATION_TYPE_META } from "../notification-types";

describe("groupKeyOf", () => {
  it.each([
    ["2026-10-27T00:00:00Z", "today"],
    ["2026-10-26T23:59:00Z", "yesterday"],
    ["2026-10-21T08:00:00Z", "this-week"],
    ["2026-10-20T08:00:00Z", "earlier"],
    // A time slightly in the future (clock skew) is still today.
    ["2026-10-27T12:05:00Z", "today"],
  ])("%s is %s", (iso, key) => {
    expect(groupKeyOf(iso, NOW)).toBe(key);
  });
});

describe("groupByDay", () => {
  it("makes the day sections in order, newest first inside each", () => {
    const groups = groupByDay(allNotifications, NOW);
    expect(groups.map((group) => group.label)).toEqual([
      "Today",
      "Yesterday",
      "Earlier this week",
      "Earlier",
    ]);
    expect(groups[0].items.map((item) => item.type)).toEqual([
      "session_confirmed",
      "organizer_application",
    ]);
  });

  it("leaves out a section with nothing in it", () => {
    const groups = groupByDay([sessionConfirmed], NOW);
    expect(groups.map((group) => group.key)).toEqual(["today"]);
  });

  it("returns no sections for an empty list", () => {
    expect(groupByDay([], NOW)).toEqual([]);
  });

  it("does not reorder the list it was given", () => {
    const before = allNotifications.map((item) => item.id);
    groupByDay(allNotifications, NOW);
    expect(allNotifications.map((item) => item.id)).toEqual(before);
  });
});

describe("formatNotificationTime", () => {
  it.each([
    ["2026-10-27T11:59:30Z", "Just now"],
    ["2026-10-27T11:59:00Z", "1 minute ago"],
    ["2026-10-27T11:15:00Z", "45 minutes ago"],
    ["2026-10-27T10:00:00Z", "2 hours ago"],
    ["2026-10-27T11:00:00Z", "1 hour ago"],
    ["2026-10-26T16:20:00Z", "Yesterday at 16:20"],
    ["2026-10-14T09:12:00Z", "14 Oct 2026 at 09:12"],
  ])("%s reads %s", (iso, text) => {
    expect(formatNotificationTime(iso, NOW)).toBe(text);
  });
});

describe("the sample data", () => {
  it("matches the notification schema", () => {
    for (const notification of NOTIFICATIONS_SAMPLE) {
      expect(notificationSchema.safeParse(notification).success).toBe(true);
    }
  });

  it("has a display entry for every notification type it uses", () => {
    for (const notification of NOTIFICATIONS_SAMPLE) {
      expect(NOTIFICATION_TYPE_META[notification.type]).toBeDefined();
    }
  });

  it("has unique ids and fills every day section", () => {
    const ids = NOTIFICATIONS_SAMPLE.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      groupByDay(NOTIFICATIONS_SAMPLE, NOTIFICATIONS_SAMPLE_NOW).map(
        (group) => group.key,
      ),
    ).toEqual(["today", "yesterday", "this-week", "earlier"]);
  });

  it("has preferences for both audiences", () => {
    const audiences = NOTIFICATION_PREFERENCES_SAMPLE.map((p) => p.audience);
    expect(audiences).toContain("personal");
    expect(audiences).toContain("platform");
  });
});
