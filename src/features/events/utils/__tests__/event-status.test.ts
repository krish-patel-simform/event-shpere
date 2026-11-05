import { toDisplayStatus } from "../event-status";

const now = new Date("2026-11-02T10:00:00.000Z");
const before = new Date("2026-11-02T09:59:59.999Z");
const after = new Date("2026-11-02T10:00:00.001Z");

describe("toDisplayStatus", () => {
  it("keeps a draft a draft, even when its date has passed", () => {
    expect(toDisplayStatus("draft", before, now)).toBe("draft");
    expect(toDisplayStatus("draft", after, now)).toBe("draft");
  });

  it("keeps a cancelled event cancelled, whatever its date", () => {
    expect(toDisplayStatus("cancelled", before, now)).toBe("cancelled");
    expect(toDisplayStatus("cancelled", after, now)).toBe("cancelled");
  });

  it("calls a published event published until its end has passed", () => {
    expect(toDisplayStatus("published", after, now)).toBe("published");
  });

  it("calls a published event completed once its end has passed", () => {
    expect(toDisplayStatus("published", before, now)).toBe("completed");
  });

  it("is still published at the very moment it ends: completed starts after", () => {
    // The list's "published" tab is end_at >= now and "completed" is end_at < now.
    expect(toDisplayStatus("published", now, now)).toBe("published");
  });
});
