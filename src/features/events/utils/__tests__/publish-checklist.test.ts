import {
  getPublishChecklist,
  type PublishChecklistInput,
} from "../publish-checklist";

const ready: PublishChecklistInput = {
  hasVenue: true,
  hallCount: 2,
  content: { hasDescription: true, hasBanner: true },
  sessions: { total: 3, scheduled: 3, cancelled: 0 },
};

const check = (overrides: Partial<PublishChecklistInput>) =>
  getPublishChecklist({ ...ready, ...overrides });

describe("getPublishChecklist", () => {
  it("can publish when everything is in place", () => {
    const result = check({});

    expect(result.canPublish).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.summary).toBeNull();
    expect(result.items.every((item) => item.ok)).toBe(true);
    expect(result.items.map((item) => item.key)).toEqual([
      "details",
      "content",
      "halls",
      "sessions",
    ]);
  });

  it("reports the missing content and unscheduled sessions of a fresh draft", () => {
    const result = check({
      content: { hasDescription: false, hasBanner: false },
      sessions: { total: 2, scheduled: 0, cancelled: 0 },
    });

    expect(result.canPublish).toBe(false);
    expect(result.summary).toBe("Missing: content, 2 unscheduled sessions");
    expect(result.items.find((i) => i.key === "content")?.description).toBe(
      "The description is missing. A banner placeholder will be used.",
    );
    expect(result.items.find((i) => i.key === "sessions")?.description).toBe(
      "2 sessions are not scheduled yet.",
    );
  });

  it("does not mention the banner placeholder when there is a banner", () => {
    const result = check({
      content: { hasDescription: false, hasBanner: true },
    });

    expect(result.items.find((i) => i.key === "content")?.description).toBe(
      "The description is missing.",
    );
  });

  it("cannot publish when the page content could not be checked", () => {
    const result = check({ content: null });

    expect(result.canPublish).toBe(false);
    expect(result.missing).toEqual(["content"]);
    expect(result.items.find((i) => i.key === "content")?.description).toMatch(
      /could not be checked/,
    );
  });

  it("needs a venue", () => {
    const result = check({ hasVenue: false });

    expect(result.canPublish).toBe(false);
    expect(result.missing).toEqual(["event details"]);
  });

  it("needs a hall at the venue", () => {
    const result = check({ hallCount: 0 });

    expect(result.missing).toEqual(["halls"]);
    expect(result.items.find((i) => i.key === "halls")?.description).toMatch(
      /no halls/,
    );
  });

  it("needs at least one session", () => {
    const result = check({
      sessions: { total: 0, scheduled: 0, cancelled: 0 },
    });

    expect(result.missing).toEqual(["sessions"]);
    expect(result.items.find((i) => i.key === "sessions")?.description).toBe(
      "Add at least one session.",
    );
  });

  it("says one unscheduled session in the singular", () => {
    const result = check({
      sessions: { total: 3, scheduled: 2, cancelled: 0 },
    });

    expect(result.summary).toBe("Missing: 1 unscheduled session");
    expect(result.items.find((i) => i.key === "sessions")?.description).toBe(
      "1 session is not scheduled yet.",
    );
  });

  it("does not wait for cancelled sessions to be scheduled", () => {
    const result = check({
      sessions: { total: 3, scheduled: 2, cancelled: 1 },
    });

    expect(result.canPublish).toBe(true);
  });

  it("lists every missing thing together, in order", () => {
    const result = check({
      hasVenue: false,
      hallCount: 0,
      content: { hasDescription: false, hasBanner: false },
      sessions: { total: 0, scheduled: 0, cancelled: 0 },
    });

    expect(result.summary).toBe(
      "Missing: event details, content, halls, sessions",
    );
  });
});
