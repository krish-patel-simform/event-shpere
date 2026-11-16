import { ananya, meera, vikram } from "../../../speakers/__fixtures__/speakers";
import {
  cancelledKeynote,
  SPEAKER_ANANYA_ID,
  SPEAKER_ROHAN_ID,
  talk,
  workshop,
} from "../../__fixtures__/organizer-sessions";
import {
  eventSpeakerRows,
  profileStatus,
  searchEventSpeakers,
} from "../event-speakers";

describe("eventSpeakerRows", () => {
  it("lists each speaker of the event once, by name, with the sessions they present", () => {
    const rows = eventSpeakerRows([talk, workshop]);

    expect(rows.map((row) => row.name)).toEqual(["Ananya Rao", "Rohan Mehta"]);
    expect(rows[0]).toMatchObject({
      id: SPEAKER_ANANYA_ID,
      sessionTitles: [talk.title, workshop.title],
    });
    expect(rows[1]).toMatchObject({
      id: SPEAKER_ROHAN_ID,
      sessionTitles: [workshop.title],
    });
  });

  it("collects each role once", () => {
    const rows = eventSpeakerRows([
      talk,
      { ...talk, id: "other", title: "Another", speakers: talk.speakers },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.roles).toEqual(["speaker"]);
  });

  it("leaves out a cancelled session, and a speaker who is only on cancelled ones", () => {
    const rows = eventSpeakerRows([talk, cancelledKeynote]);

    expect(rows.map((row) => row.name)).toEqual(["Ananya Rao"]);
  });

  it("is empty for an event with no sessions", () => {
    expect(eventSpeakerRows([])).toEqual([]);
  });
});

describe("searchEventSpeakers", () => {
  const rows = eventSpeakerRows([talk, workshop]);

  it("matches part of the name in any case", () => {
    expect(searchEventSpeakers(rows, " ROHAN ").map((row) => row.name)).toEqual(
      ["Rohan Mehta"],
    );
  });

  it("keeps every row for a blank term", () => {
    expect(searchEventSpeakers(rows, "  ")).toHaveLength(2);
  });
});

describe("profileStatus", () => {
  it("is complete with a photo, missing the photo without one, and empty without content", () => {
    expect(profileStatus(ananya)).toBe("complete");
    expect(profileStatus(meera)).toBe("missing_photo");
    expect(profileStatus(vikram)).toBe("no_content");
  });
});
