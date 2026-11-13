import {
  cancelledKeynote,
  organizerSessions,
  SPEAKER_ANANYA_ID,
  SPEAKER_ROHAN_ID,
  talk,
  workshop,
} from "../../__fixtures__/organizer-sessions";
import { parseSessionSpeaker } from "../../routes";
import {
  filterSessionsBySpeaker,
  speakerNameIn,
} from "../session-speaker-filter";

describe("filterSessionsBySpeaker", () => {
  it("keeps the sessions the speaker presents, cancelled ones too", () => {
    expect(
      filterSessionsBySpeaker(organizerSessions, SPEAKER_ROHAN_ID).map(
        (session) => session.id,
      ),
    ).toEqual([cancelledKeynote.id, workshop.id]);
  });

  it("is empty for a speaker who is on none", () => {
    expect(
      filterSessionsBySpeaker(
        organizerSessions,
        "6b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4dff",
      ),
    ).toEqual([]);
  });

  it("finds one session for a speaker with one", () => {
    expect(
      filterSessionsBySpeaker([talk, cancelledKeynote], SPEAKER_ANANYA_ID),
    ).toEqual([talk]);
  });
});

describe("speakerNameIn", () => {
  it("gives the name the sessions carry, or nothing for an unknown speaker", () => {
    expect(speakerNameIn(organizerSessions, SPEAKER_ROHAN_ID)).toBe(
      "Rohan Mehta",
    );
    expect(speakerNameIn(organizerSessions, "nope")).toBeUndefined();
  });
});

describe("parseSessionSpeaker", () => {
  it("accepts an id and ignores anything else", () => {
    expect(parseSessionSpeaker(SPEAKER_ANANYA_ID)).toBe(SPEAKER_ANANYA_ID);
    expect(parseSessionSpeaker("not-an-id")).toBeUndefined();
    expect(parseSessionSpeaker([SPEAKER_ANANYA_ID])).toBeUndefined();
    expect(parseSessionSpeaker(undefined)).toBeUndefined();
  });
});
