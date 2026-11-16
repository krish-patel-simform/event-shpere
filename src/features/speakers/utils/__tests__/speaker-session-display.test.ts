import type { SpeakerSessionDto } from "../../schemas/speaker-sessions.schemas";
import {
  countLabel,
  eventBadge,
  eventMeta,
  sessionBadge,
  sessionDetails,
  sessionWhen,
} from "../speaker-session-display";

const now = new Date("2026-11-12T10:00:00.000Z");
const daysFromNow = (days: number) =>
  new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

const session: SpeakerSessionDto = {
  id: "a0000000-0000-4000-8000-000000000001",
  title: "Design Tokens at Scale",
  type: "talk",
  mode: "in_person",
  startAt: "2026-11-14T05:30:00.000Z",
  endAt: "2026-11-14T06:15:00.000Z",
  hallName: "Hall A",
  price: 0,
  requiresRegistration: true,
  seatsLeft: 54,
};

describe("eventBadge", () => {
  it("says Live now in the now section and nothing for a past event", () => {
    expect(eventBadge("now", daysFromNow(-1), now)).toEqual({
      text: "Live now",
      tone: "success",
    });
    expect(eventBadge("past", daysFromNow(-30), now)).toBeNull();
  });

  it("says how far away an upcoming event is, amber within a week", () => {
    expect(eventBadge("upcoming", daysFromNow(0.5), now)).toEqual({
      text: "In under a day",
      tone: "warning",
    });
    expect(eventBadge("upcoming", daysFromNow(2), now)).toEqual({
      text: "In 2 days",
      tone: "warning",
    });
    expect(eventBadge("upcoming", daysFromNow(10), now)).toEqual({
      text: "In 10 days",
      tone: "brand",
    });
    expect(eventBadge("upcoming", daysFromNow(21), now)).toEqual({
      text: "In 3 weeks",
      tone: "brand",
    });
    expect(eventBadge("upcoming", daysFromNow(90), now)).toEqual({
      text: "In 3 months",
      tone: "brand",
    });
  });

  it("says a multi-day event is under way when it started but the session is still to come", () => {
    expect(eventBadge("upcoming", daysFromNow(-1), now)?.text).toBe(
      "Event under way",
    );
  });
});

describe("sessionBadge", () => {
  it("says Live now in the now section", () => {
    expect(sessionBadge("now", session)).toEqual({
      text: "Live now",
      tone: "success",
    });
  });

  it("shows the seats left, amber when few, Full at 0", () => {
    expect(sessionBadge("upcoming", { seatsLeft: 54 })).toEqual({
      text: "54 seats left",
      tone: "success",
    });
    expect(sessionBadge("upcoming", { seatsLeft: 1 })).toEqual({
      text: "1 seat left",
      tone: "warning",
    });
    expect(sessionBadge("upcoming", { seatsLeft: 0 })).toEqual({
      text: "Full",
      tone: "neutral",
    });
  });

  it("has no badge when no booking is needed, or for a past session", () => {
    expect(sessionBadge("upcoming", { seatsLeft: null })).toBeNull();
    expect(sessionBadge("past", { seatsLeft: 10 })).toBeNull();
  });
});

describe("eventMeta", () => {
  const event = {
    slug: "design-systems-day",
    title: "Design Systems Engineering Day",
    startAt: "2026-11-14T03:30:00.000Z",
    endAt: "2026-11-14T12:30:00.000Z",
    timezone: "Asia/Kolkata",
    venue: { name: "Tech Park Auditorium", city: "Pune" },
    ticketPrice: 0,
  };

  it("joins the dates, the venue and the price", () => {
    expect(eventMeta(event)).toBe(
      "Sat 14 Nov 2026 · Tech Park Auditorium, Pune · Free",
    );
  });

  it("says Online for an event with no venue, and shows a paid price", () => {
    expect(eventMeta({ ...event, venue: null, ticketPrice: 150000 })).toBe(
      "Sat 14 Nov 2026 · Online · ₹1,500",
    );
  });
});

describe("sessionWhen", () => {
  it("shows the date and time in the event's zone", () => {
    expect(sessionWhen(session, "Asia/Kolkata")).toEqual({
      date: "Sat 14 Nov 2026",
      time: "11:00 – 11:45 IST",
    });
  });
});

describe("sessionDetails", () => {
  it("names the hall and the type", () => {
    expect(sessionDetails(session)).toBe("Hall A · Talk");
  });

  it("says Online when there is no hall, and adds the mode and an extra price", () => {
    expect(
      sessionDetails({
        ...session,
        hallName: null,
        mode: "online",
        type: "workshop",
        price: 50000,
      }),
    ).toBe("Online · Workshop · Online · ₹500 extra");
    expect(sessionDetails({ ...session, mode: "hybrid" })).toBe(
      "Hall A · Talk · Hybrid",
    );
  });
});

describe("countLabel", () => {
  it("counts sessions and events", () => {
    expect(countLabel(4, 2)).toBe("4 sessions · 2 events");
    expect(countLabel(1, 1)).toBe("1 session · 1 event");
  });
});
