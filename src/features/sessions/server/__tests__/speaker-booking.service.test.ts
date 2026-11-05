import { ConflictError } from "../../../../core/http/errors";
import { createSpeakerBookingService } from "../speaker-booking.service";

// An empty factory: the DB client and env are never loaded.
jest.mock("../speaker-booking.repository", () => ({}));

const annaId = "4a5b6c7d-8e9f-4a0b-9c1d-2e3f4a5b6c7d";
const benId = "5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d8e";
const startAt = new Date("2026-12-12T04:30:00.000Z");
const endAt = new Date("2026-12-12T06:30:00.000Z");

const annaBusy = {
  speakerId: annaId,
  name: "Anna Rao",
  startAt: new Date("2026-12-12T05:00:00.000Z"),
  endAt: new Date("2026-12-12T07:00:00.000Z"),
};
const benBusy = {
  speakerId: benId,
  name: "Ben Lee",
  startAt: new Date("2026-12-12T04:00:00.000Z"),
  endAt: new Date("2026-12-12T05:00:00.000Z"),
};

function setup() {
  const repository = {
    findOverlappingSessions: jest.fn().mockResolvedValue([]),
  };
  return {
    repository,
    service: createSpeakerBookingService({ repository }),
  };
}

describe("speakerBookingService.assertSpeakersFree", () => {
  it("lets the session through when no speaker is booked at that time", async () => {
    const { service, repository } = setup();

    await expect(
      service.assertSpeakersFree({ speakerIds: [annaId], startAt, endAt }),
    ).resolves.toBeUndefined();
    expect(repository.findOverlappingSessions).toHaveBeenCalledWith({
      speakerIds: [annaId],
      startAt,
      endAt,
    });
  });

  it("passes the session being edited on, so it does not clash with itself", async () => {
    const { service, repository } = setup();

    await service.assertSpeakersFree({
      speakerIds: [annaId],
      startAt,
      endAt,
      exceptSessionId: "own-session",
    });

    expect(repository.findOverlappingSessions).toHaveBeenCalledWith(
      expect.objectContaining({ exceptSessionId: "own-session" }),
    );
  });

  it("answers 409 SPEAKER_BUSY naming the busy speaker", async () => {
    const { service, repository } = setup();
    repository.findOverlappingSessions.mockResolvedValue([annaBusy]);

    const error = await service
      .assertSpeakersFree({ speakerIds: [annaId, benId], startAt, endAt })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ status: 409, code: "SPEAKER_BUSY" });
    expect((error as ConflictError).message).toContain(
      "Anna Rao is already booked",
    );
    expect((error as ConflictError).message).not.toContain("Ben Lee");
  });

  it("names every busy speaker once, even when one is busy in two sessions", async () => {
    const { service, repository } = setup();
    repository.findOverlappingSessions.mockResolvedValue([
      benBusy,
      annaBusy,
      { ...annaBusy, startAt: new Date("2026-12-12T06:00:00.000Z") },
    ]);

    const error = await service
      .assertSpeakersFree({ speakerIds: [annaId, benId], startAt, endAt })
      .catch((e: unknown) => e);

    expect((error as ConflictError).message).toContain(
      "Ben Lee and Anna Rao are already booked",
    );
  });

  it("says WHO and WHEN, in ISO times, and nothing about the other session", async () => {
    const { service, repository } = setup();
    repository.findOverlappingSessions.mockResolvedValue([
      { ...annaBusy, sessionId: "secret-session-id", title: "Secret talk" },
    ]);

    const error = await service
      .assertSpeakersFree({ speakerIds: [annaId], startAt, endAt })
      .catch((e: unknown) => e);

    expect(error).toMatchObject({
      details: {
        conflicts: [
          {
            speakerId: annaId,
            startAt: "2026-12-12T05:00:00.000Z",
            endAt: "2026-12-12T07:00:00.000Z",
          },
        ],
      },
    });
    expect(JSON.stringify(error)).not.toContain("secret-session-id");
    expect(JSON.stringify(error)).not.toContain("Secret talk");
  });
});
