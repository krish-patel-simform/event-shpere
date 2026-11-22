import {
  actor,
  cancelledRegistration,
  NOW,
  publishedEvent,
  setupRegistrationService,
  ticketRow,
  userId,
} from "../../__fixtures__/registration-service";
import {
  myRegistrationListQuerySchema,
  myTicketListResponseSchema,
} from "../../schemas/registrations.schemas";

// Empty factory: the DB client and env are never loaded.
jest.mock("../registration.repository", () => ({}));

const defaultQuery = myRegistrationListQuerySchema.parse({});

describe("registrationService.listMyRegistrations", () => {
  it("asks the repository for the signed-in user's page and turns page into limit and offset", async () => {
    const { service, repo } = setupRegistrationService();

    await service.listMyRegistrations(
      { page: 3, pageSize: 10, status: "registered", when: "past" },
      actor,
    );

    expect(repo.listOwnRegistrations).toHaveBeenCalledWith({
      userId,
      status: "registered",
      when: "past",
      now: NOW,
      limit: 10,
      offset: 20,
    });
  });

  it("only ever asks for the signed-in user, whatever the query holds", async () => {
    const { service, repo } = setupRegistrationService();

    await service.listMyRegistrations(
      {
        ...defaultQuery,
        // The schema strips unknown keys, but even a stray one must not reach the repository.
        ...({ userId: "someone-else" } as object),
      },
      actor,
    );

    expect(repo.listOwnRegistrations).toHaveBeenCalledTimes(1);
    expect(repo.listOwnRegistrations.mock.calls[0][0].userId).toBe(userId);
  });

  it("answers the page's meta with the total the repository counted", async () => {
    const { service, repo } = setupRegistrationService();
    repo.listOwnRegistrations.mockResolvedValue({
      rows: [ticketRow],
      total: 41,
    });

    const { meta } = await service.listMyRegistrations(
      { ...defaultQuery, page: 2, pageSize: 5 },
      actor,
    );

    expect(meta).toEqual({ page: 2, pageSize: 5, total: 41 });
  });

  it("answers an empty page for a user with no registrations", async () => {
    const { service } = setupRegistrationService();

    await expect(
      service.listMyRegistrations(defaultQuery, actor),
    ).resolves.toEqual({
      items: [],
      meta: { page: 1, pageSize: 10, total: 0 },
    });
  });

  describe("each ticket card", () => {
    it("holds the ticket, the event fields and the booked-session count", async () => {
      const { service, repo } = setupRegistrationService();
      repo.listOwnRegistrations.mockResolvedValue({
        rows: [ticketRow],
        total: 1,
      });

      const { items } = await service.listMyRegistrations(defaultQuery, actor);

      expect(items).toEqual([
        {
          registration: {
            id: ticketRow.registration.id,
            eventId: publishedEvent.id,
            status: "registered",
            ticketCode: ticketRow.registration.ticketCode,
            amount: 0,
            currency: "INR",
            reason: "free",
            registeredAt: "2026-11-01T08:00:00.000Z",
          },
          event: {
            id: publishedEvent.id,
            slug: "fintech-product-forum",
            title: "Fintech Product Forum",
            status: "published",
            startAt: "2026-12-12T04:00:00.000Z",
            endAt: "2026-12-12T12:00:00.000Z",
            timezone: "Asia/Kolkata",
            registrationClosesAt: null,
            venueName: "Grand Hall",
            venueCity: "Pune",
          },
          bookedSessionCount: 2,
        },
      ]);
    });

    it("sends when registration closes (cancelling stops then), as an ISO string", async () => {
      const { service, repo } = setupRegistrationService();
      repo.listOwnRegistrations.mockResolvedValue({
        rows: [
          {
            ...ticketRow,
            event: {
              ...ticketRow.event,
              registrationClosesAt: new Date("2026-12-10T12:30:00.000Z"),
            },
          },
        ],
        total: 1,
      });

      const { items } = await service.listMyRegistrations(defaultQuery, actor);

      expect(items[0].event.registrationClosesAt).toBe(
        "2026-12-10T12:30:00.000Z",
      );
    });

    it("matches the response schema and leaks no user id, capacity or internal date", async () => {
      const { service, repo } = setupRegistrationService();
      repo.listOwnRegistrations.mockResolvedValue({
        rows: [ticketRow],
        total: 1,
      });

      const { items } = await service.listMyRegistrations(defaultQuery, actor);

      expect(() => myTicketListResponseSchema.parse(items)).not.toThrow();
      const [card] = items;
      expect(card.registration).not.toHaveProperty("userId");
      expect(card.registration).not.toHaveProperty("cancelledAt");
      expect(card.registration).not.toHaveProperty("updatedAt");
      expect(card.event).not.toHaveProperty("capacity");
      expect(card.event).not.toHaveProperty("organizerId");
      expect(card.event).not.toHaveProperty("ticketPrice");
    });

    it("lists a cancelled ticket as cancelled, with the event's own status for a cancelled event", async () => {
      const { service, repo } = setupRegistrationService();
      repo.listOwnRegistrations.mockResolvedValue({
        rows: [
          {
            ...ticketRow,
            registration: cancelledRegistration,
            event: { ...ticketRow.event, status: "cancelled" },
            bookedSessionCount: 0,
          },
        ],
        total: 1,
      });

      const { items } = await service.listMyRegistrations(defaultQuery, actor);

      expect(items[0].registration.status).toBe("cancelled");
      expect(items[0].event.status).toBe("cancelled");
      expect(items[0].bookedSessionCount).toBe(0);
    });

    it("keeps a missing venue as null", async () => {
      const { service, repo } = setupRegistrationService();
      repo.listOwnRegistrations.mockResolvedValue({
        rows: [{ ...ticketRow, venueName: null, venueCity: null }],
        total: 1,
      });

      const { items } = await service.listMyRegistrations(defaultQuery, actor);

      expect(items[0].event).toMatchObject({
        venueName: null,
        venueCity: null,
      });
    });

    it("shows a ticket on a paid event as complimentary: it cost nothing", async () => {
      const { service, repo } = setupRegistrationService();
      repo.listOwnRegistrations.mockResolvedValue({
        rows: [
          { ...ticketRow, event: { ...ticketRow.event, ticketPrice: 150_000 } },
        ],
        total: 1,
      });

      const { items } = await service.listMyRegistrations(defaultQuery, actor);

      expect(items[0].registration).toMatchObject({
        amount: 0,
        reason: "complimentary_speaker",
      });
    });
  });
});
