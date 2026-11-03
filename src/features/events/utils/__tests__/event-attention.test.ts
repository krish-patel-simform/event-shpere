import type { EventOverviewData } from "../../types/event-manage.types";
import { getAttentionItems, unscheduledCount } from "../event-attention";
import {
  FINTECH_ID,
  findSampleOverview,
  SUMMIT_ID,
} from "../../__fixtures__/event-manage";

function overview(id: string): EventOverviewData {
  const found = findSampleOverview(id);
  if (!found) throw new Error(`no sample overview ${id}`);
  return found;
}

describe("unscheduledCount", () => {
  it("is the sessions that are neither scheduled nor cancelled", () => {
    expect(unscheduledCount(overview(SUMMIT_ID))).toBe(2);
    expect(unscheduledCount(overview(FINTECH_ID))).toBe(2);
  });
});

describe("getAttentionItems", () => {
  it("lists unscheduled sessions, full sessions and the published note, in that order", () => {
    const items = getAttentionItems(overview(SUMMIT_ID));

    expect(items.map((item) => item.key)).toEqual([
      "unscheduled",
      "full-9d0e1f2a-3b4c-4d5e-8f60-718293a4b5c6",
      "published",
    ]);
    expect(items[0]).toMatchObject({
      tone: "warning",
      title: "2 sessions are not scheduled",
    });
    expect(items[1].title).toBe(
      "“Hands-on: Type-safe APIs with TypeScript and Zod” is full",
    );
    expect(items[1].description).toContain("60 of 60 seats booked");
    expect(items[2].tone).toBe("success");
    // The month comes from Intl, which spells September "Sep" or "Sept" by Node version.
    expect(items[2].description).toMatch(
      /^Registration is open · published 12 Sept? 2026\.$/,
    );
  });

  it("leaves out unscheduled sessions when there are none", () => {
    const base = overview(SUMMIT_ID);
    const items = getAttentionItems({
      ...base,
      event: {
        ...base.event,
        sessions: { total: 24, scheduled: 24, cancelled: 0 },
      },
    });

    expect(items.map((item) => item.key)).not.toContain("unscheduled");
  });

  it("says one session in the singular", () => {
    const base = overview(SUMMIT_ID);
    const items = getAttentionItems({
      ...base,
      event: {
        ...base.event,
        sessions: { total: 24, scheduled: 23, cancelled: 0 },
      },
    });

    expect(items[0].title).toBe("1 session is not scheduled");
  });

  it("has nothing to say about a draft", () => {
    expect(getAttentionItems(overview(FINTECH_ID))).toEqual([]);
  });
});
