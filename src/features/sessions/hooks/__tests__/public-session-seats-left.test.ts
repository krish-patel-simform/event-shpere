import { QueryClient } from "@tanstack/react-query";
import {
  adjustPublicSessionSeatsLeft,
  PUBLIC_SESSION_DETAILS_KEY,
} from "../../../registrations";
import {
  publicSessionDetailSchema,
  type PublicSessionDetailDto,
} from "../../schemas/session-public.schemas";
import { sessionQueryKeys } from "../session-cache";

// The registrations feature moves "seats left" on this feature's cached public session page after
// the user books or cancels a seat. It cannot import this feature (this feature imports it), so
// the contract is checked from this side: the same root key, the real page shape found by its
// `id`, only `seatsLeft` changing, and the result still a valid public page.

const SESSION_ID = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01";

const page: PublicSessionDetailDto = {
  id: SESSION_ID,
  title: "Offline-first Event Apps",
  type: "talk",
  mode: "in_person",
  startAt: "2026-12-04T04:30:00.000Z",
  endAt: "2026-12-04T05:30:00.000Z",
  hallName: "Hall B",
  hallCapacity: 120,
  seatsLeft: 32,
  venue: null,
  price: 0,
  requiresRegistration: true,
  speakers: [],
  event: {
    id: "5d6e7f80-9a1b-4c2d-8e3f-4a5b6c7d8e9f",
    slug: "summit",
    title: "Summit",
    status: "published",
    timezone: "Asia/Kolkata",
    startAt: "2026-12-03T03:30:00.000Z",
    registrationClosesAt: null,
  },
  content: null,
};

describe("seats left on the cached public session page", () => {
  it("uses the same root key as the registrations feature", () => {
    expect(PUBLIC_SESSION_DETAILS_KEY).toEqual(sessionQueryKeys.publicDetails);
  });

  it("moves by one for this session and stays a valid public page", () => {
    const client = new QueryClient();
    const key = sessionQueryKeys.publicDetail("summit", SESSION_ID);
    client.setQueryData(key, page);

    adjustPublicSessionSeatsLeft(client, SESSION_ID, -1);

    const after = client.getQueryData<PublicSessionDetailDto>(key);
    expect(after).toEqual({ ...page, seatsLeft: 31 });
    expect(publicSessionDetailSchema.safeParse(after).success).toBe(true);
  });

  it("matches the session by its id, not by the event's id", () => {
    const client = new QueryClient();
    const key = sessionQueryKeys.publicDetail("summit", SESSION_ID);
    client.setQueryData(key, page);

    adjustPublicSessionSeatsLeft(client, page.event.id, -1);

    expect(client.getQueryData<PublicSessionDetailDto>(key)?.seatsLeft).toBe(
      32,
    );
  });
});
