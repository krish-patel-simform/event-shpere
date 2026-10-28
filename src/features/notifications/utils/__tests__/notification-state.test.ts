import {
  allNotifications,
  coSpeakerAccepted,
  organizerApplication,
  securitySignIn,
  sessionConfirmed,
  userSuspended,
} from "../../__fixtures__/notifications";
import { notificationCategories } from "../../types/notification";
import {
  categoriesPresent,
  countUnread,
  filterNotifications,
  isUnread,
  markAllAsRead,
  markAsRead,
  visibleNotifications,
} from "../notification-state";

const AT = "2026-10-27T13:00:00Z";
const ids = (list: { id: string }[]) => list.map((item) => item.id);

describe("countUnread / isUnread", () => {
  it("counts the notifications without a read time", () => {
    expect(isUnread(sessionConfirmed)).toBe(true);
    expect(isUnread(coSpeakerAccepted)).toBe(false);
    expect(countUnread(allNotifications)).toBe(2);
    expect(countUnread([])).toBe(0);
  });
});

describe("markAsRead", () => {
  it("sets the read time on that notification only", () => {
    const next = markAsRead(allNotifications, sessionConfirmed.id, AT);
    expect(next.find((n) => n.id === sessionConfirmed.id)?.readAt).toBe(AT);
    expect(
      next.find((n) => n.id === organizerApplication.id)?.readAt,
    ).toBeNull();
    expect(countUnread(next)).toBe(1);
  });

  it("does not change the list it was given", () => {
    markAsRead(allNotifications, sessionConfirmed.id, AT);
    expect(sessionConfirmed.readAt).toBeNull();
    expect(countUnread(allNotifications)).toBe(2);
  });

  it("keeps the first read time of one that was already read", () => {
    const next = markAsRead(allNotifications, coSpeakerAccepted.id, AT);
    expect(next.find((n) => n.id === coSpeakerAccepted.id)?.readAt).toBe(
      coSpeakerAccepted.readAt,
    );
  });

  it("ignores an unknown id", () => {
    expect(markAsRead(allNotifications, "nope", AT)).toEqual(allNotifications);
  });
});

describe("markAllAsRead", () => {
  it("reads every unread one and leaves earlier read times alone", () => {
    const next = markAllAsRead(allNotifications, AT);
    expect(countUnread(next)).toBe(0);
    expect(next.find((n) => n.id === coSpeakerAccepted.id)?.readAt).toBe(
      coSpeakerAccepted.readAt,
    );
    expect(next.find((n) => n.id === sessionConfirmed.id)?.readAt).toBe(AT);
  });
});

describe("filterNotifications", () => {
  it("all keeps everything", () => {
    expect(filterNotifications(allNotifications, "all")).toHaveLength(5);
  });

  it("unread keeps only the unread ones", () => {
    expect(ids(filterNotifications(allNotifications, "unread")).sort()).toEqual(
      [organizerApplication.id, sessionConfirmed.id].sort(),
    );
  });

  it("a topic keeps the notifications of that category", () => {
    expect(
      ids(filterNotifications(allNotifications, "sessions")).sort(),
    ).toEqual([sessionConfirmed.id, coSpeakerAccepted.id].sort());
    expect(ids(filterNotifications(allNotifications, "system"))).toEqual([
      securitySignIn.id,
    ]);
  });
});

describe("visibleNotifications", () => {
  it("hides platform-wide notifications from someone who cannot act on them", () => {
    const personal = visibleNotifications(allNotifications, false);
    expect(ids(personal)).not.toContain(organizerApplication.id);
    expect(ids(personal)).not.toContain(userSuspended.id);
    expect(personal).toHaveLength(3);
  });

  it("shows everything to someone who can", () => {
    expect(visibleNotifications(allNotifications, true)).toHaveLength(5);
  });
});

describe("categoriesPresent", () => {
  it("lists the categories in the list, in the given order", () => {
    expect(categoriesPresent(allNotifications, notificationCategories)).toEqual(
      ["sessions", "approvals", "users", "system"],
    );
  });

  it("is empty for an empty list", () => {
    expect(categoriesPresent([], notificationCategories)).toEqual([]);
  });
});
