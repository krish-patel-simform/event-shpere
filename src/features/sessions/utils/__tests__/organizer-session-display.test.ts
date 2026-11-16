import {
  cancelledKeynote,
  talk,
  workshop,
} from "../../__fixtures__/organizer-sessions";
import {
  sessionDay,
  sessionPlace,
  sessionPrice,
  sessionTimes,
  SESSION_MODE_LABELS,
  SESSION_STATUS_META,
  SESSION_TYPE_LABELS,
  speakerNames,
} from "../organizer-session-display";

jest.mock("../../../events", () => ({
  ...jest.requireActual("../../../events/utils/event-display"),
}));

describe("labels", () => {
  it("names every type, mode and status in words", () => {
    expect(SESSION_TYPE_LABELS.keynote).toBe("Keynote");
    expect(SESSION_MODE_LABELS.in_person).toBe("In person");
    expect(SESSION_STATUS_META.scheduled).toEqual({
      label: "Scheduled",
      tone: "success",
    });
    expect(SESSION_STATUS_META.cancelled.tone).toBe("danger");
  });
});

describe("sessionDay and sessionTimes", () => {
  it("show the slot in the event's zone, not UTC", () => {
    // 04:30 UTC is 10:00 in India.
    expect(sessionDay(talk, "Asia/Kolkata")).toBe("Sat 12 Dec 2026");
    expect(sessionTimes(talk, "Asia/Kolkata")).toBe("10:00 – 11:00 IST");
  });

  it("move to the previous day when the zone is behind UTC", () => {
    expect(sessionDay(talk, "America/New_York")).toBe("Fri 11 Dec 2026");
  });

  it("are null while the session has no slot", () => {
    const unplaced = { ...talk, startAt: null, endAt: null };

    expect(sessionDay(unplaced, "Asia/Kolkata")).toBeNull();
    expect(sessionTimes(unplaced, "Asia/Kolkata")).toBeNull();
  });
});

describe("sessionPlace", () => {
  it("is the hall for an in-person session", () => {
    expect(sessionPlace(talk)).toBe("Hall A");
  });

  it("adds online to the hall of a hybrid session", () => {
    expect(sessionPlace(workshop)).toBe("Hall B + online");
  });

  it("says Online when there is no hall", () => {
    expect(sessionPlace(cancelledKeynote)).toBe("Online");
  });
});

describe("speakerNames", () => {
  it("lists the names in display order, whatever order they arrive in", () => {
    expect(speakerNames(workshop)).toBe("Ananya Rao, Rohan Mehta");
  });

  it("does not reorder the session's own list", () => {
    speakerNames(workshop);

    expect(workshop.speakers[0]?.name).toBe("Rohan Mehta");
  });
});

describe("sessionPrice", () => {
  it("says Included when it costs nothing extra", () => {
    expect(sessionPrice(talk)).toBe("Included");
  });

  it("shows paise as rupees", () => {
    expect(sessionPrice(workshop)).toBe("₹499.50");
  });
});
