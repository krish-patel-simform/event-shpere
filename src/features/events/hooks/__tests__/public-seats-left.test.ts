import { QueryClient } from "@tanstack/react-query";
import { adjustPublicSeatsLeft } from "../../../registrations";
import {
  publicEventDetailSchema,
  type PublicEventDetailDto,
} from "../../schemas/event-public.schemas";
import { eventQueryKeys } from "../event-cache";

// The registrations feature moves "seats left" on this feature's cached public page after the
// user registers or cancels. It cannot import this feature's types (this feature imports it), so
// this test checks the contract from this side: the real page shape is found by its `id`, only
// `seatsLeft` changes, and the result is still a valid public page.

const EVENT_ID = "5d6e7f80-9a1b-4c2d-8e3f-4a5b6c7d8e9f";

const page: PublicEventDetailDto = {
  id: EVENT_ID,
  slug: "summit",
  title: "Summit",
  status: "published",
  startAt: "2026-12-03T03:30:00.000Z",
  endAt: "2026-12-05T12:30:00.000Z",
  timezone: "Asia/Kolkata",
  venue: null,
  ticketPrice: 0,
  seatsLeft: 120,
  registrationOpensAt: null,
  registrationClosesAt: null,
  content: null,
  sessions: [],
};

describe("seats left on the cached public event page", () => {
  it("moves by one for this event and stays a valid public page", () => {
    const client = new QueryClient();
    const key = eventQueryKeys.publicDetail("summit");
    client.setQueryData(key, page);

    adjustPublicSeatsLeft(client, EVENT_ID, -1);

    const after = client.getQueryData<PublicEventDetailDto>(key);
    expect(after).toEqual({ ...page, seatsLeft: 119 });
    expect(publicEventDetailSchema.safeParse(after).success).toBe(true);

    adjustPublicSeatsLeft(client, EVENT_ID, 1);
    expect(client.getQueryData<PublicEventDetailDto>(key)?.seatsLeft).toBe(120);
  });

  it("does not touch the page of another event", () => {
    const client = new QueryClient();
    const key = eventQueryKeys.publicDetail("summit");
    client.setQueryData(key, page);

    adjustPublicSeatsLeft(client, "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d", -1);

    expect(client.getQueryData<PublicEventDetailDto>(key)?.seatsLeft).toBe(120);
  });
});
