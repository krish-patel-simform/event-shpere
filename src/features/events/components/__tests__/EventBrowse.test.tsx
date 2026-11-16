/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { renderWithClient } from "../../__fixtures__/render";
import { eventApiService } from "../../api/event-api.service";
import { publicEventHref } from "../../routes";
import type { PublicEventListItemDto } from "../../schemas/event-public.schemas";
import { EventBrowse } from "../EventBrowse";

jest.mock("../../api/event-api.service", () => ({
  eventApiService: { listPublic: jest.fn() },
}));
const api = jest.mocked(eventApiService);

const event = (
  overrides: Partial<PublicEventListItemDto> = {},
): PublicEventListItemDto => ({
  slug: "product-engineering-summit-2026",
  title: "Product Engineering Summit 2026",
  startAt: "2026-12-03T03:30:00.000Z",
  endAt: "2026-12-05T12:30:00.000Z",
  timezone: "Asia/Kolkata",
  venue: { name: "Convention Centre", city: "Pune", state: "Maharashtra" },
  ticketPrice: 0,
  seatsLeft: 120,
  tagline: null,
  coverImage: null,
  ...overrides,
});

const SAMPLE: PublicEventListItemDto[] = [
  event(),
  event({
    slug: "design-systems-engineering-day",
    title: "Design Systems Engineering Day",
    startAt: "2026-11-14T03:30:00.000Z",
    endAt: "2026-11-14T12:00:00.000Z",
    ticketPrice: 150000,
    seatsLeft: 12,
    tagline: "A day on tokens and components",
  }),
  event({
    slug: "cloud-native-meetup",
    title: "Cloud Native Engineering Meetup",
    seatsLeft: 0,
    venue: null,
  }),
];

const page = (items: PublicEventListItemDto[], total = items.length) => ({
  items,
  meta: { page: 1, pageSize: 12, total },
});

const lastParams = () => api.listPublic.mock.calls.at(-1)?.[0];

beforeEach(() => {
  jest.resetAllMocks();
  api.listPublic.mockResolvedValue(page(SAMPLE));
});

describe("EventBrowse", () => {
  it("shows a skeleton while the first page loads", () => {
    api.listPublic.mockReturnValue(new Promise(() => {}));
    renderWithClient(<EventBrowse />);

    expect(
      screen.getByRole("status", { name: "Loading events" }),
    ).toBeInTheDocument();
  });

  it("asks for the upcoming events, soonest first, with no search or price", async () => {
    renderWithClient(<EventBrowse />);
    await screen.findByText("Product Engineering Summit 2026");

    expect(lastParams()).toEqual({
      search: "",
      price: undefined,
      when: "upcoming",
      sort: "soonest",
      page: 1,
      pageSize: 12,
    });
  });

  it("shows each event with its link, dates, place, price and seats", async () => {
    renderWithClient(<EventBrowse />);
    await screen.findByText("Product Engineering Summit 2026");

    const cards = screen.getAllByRole("listitem");
    const summit = within(cards[0]);
    expect(
      summit.getByRole("link", { name: "Product Engineering Summit 2026" }),
    ).toHaveAttribute(
      "href",
      publicEventHref("product-engineering-summit-2026"),
    );
    expect(summit.getByText("Convention Centre, Pune")).toBeInTheDocument();
    expect(summit.getByText("Thu 3 – Sat 5 Dec 2026")).toBeInTheDocument();
    expect(summit.getByText("Free")).toBeInTheDocument();
    expect(summit.getByText("120 seats left")).toBeInTheDocument();

    const design = within(cards[1]);
    expect(design.getByText("₹1,500")).toBeInTheDocument();
    expect(design.getByText("12 seats left")).toBeInTheDocument();
    expect(
      design.getByText("A day on tokens and components"),
    ).toBeInTheDocument();

    const meetup = within(cards[2]);
    expect(meetup.getByText("Sold out")).toBeInTheDocument();
    expect(meetup.getByText("Venue to be announced")).toBeInTheDocument();
  });

  it("says how many events there are", async () => {
    renderWithClient(<EventBrowse />);

    expect(
      await screen.findByRole("heading", { name: /3 events/ }),
    ).toBeInTheDocument();
  });

  it("marks what the API backs as Live and the rest as Static", async () => {
    renderWithClient(<EventBrowse />);
    await screen.findByText("Product Engineering Summit 2026");
    const filters = within(
      screen.getByRole("complementary", { name: "Filters" }),
    );

    const group = (name: string) =>
      within(filters.getByRole("group", { name }));
    expect(group("Date Live").getByText("Live")).toBeInTheDocument();
    expect(group("Price Live").getByText("Live")).toBeInTheDocument();
    expect(group("City Static").getByText("Static")).toBeInTheDocument();
    expect(
      group("Availability Static").getByText("Static"),
    ).toBeInTheDocument();
    // A control with no API behind it cannot be used.
    expect(filters.getByRole("checkbox", { name: "Pune" })).toBeDisabled();
    expect(
      filters.getByRole("checkbox", { name: "Hide sold-out events" }),
    ).toBeDisabled();
  });
});

describe("EventBrowse: filtering is the server's job", () => {
  it("searches by title when Search is pressed, not on every key", async () => {
    const user = userEvent.setup();
    renderWithClient(<EventBrowse />);
    await screen.findByText("Product Engineering Summit 2026");
    const calls = api.listPublic.mock.calls.length;

    await user.type(screen.getByRole("searchbox"), "design");
    expect(api.listPublic).toHaveBeenCalledTimes(calls);

    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(lastParams()?.search).toBe("design"));
  });

  it("asks for free events only", async () => {
    const user = userEvent.setup();
    renderWithClient(<EventBrowse />);
    await screen.findByText("Product Engineering Summit 2026");

    await user.click(screen.getByRole("radio", { name: "Free" }));

    await waitFor(() => expect(lastParams()?.price).toBe("free"));
  });

  it("leaves the price out again for Any price", async () => {
    const user = userEvent.setup();
    renderWithClient(<EventBrowse />);
    await screen.findByText("Product Engineering Summit 2026");

    await user.click(screen.getByRole("radio", { name: "Paid" }));
    await waitFor(() => expect(lastParams()?.price).toBe("paid"));
    await user.click(screen.getByRole("radio", { name: "Any price" }));

    await waitFor(() => expect(lastParams()?.price).toBeUndefined());
  });

  it("asks for past events", async () => {
    const user = userEvent.setup();
    renderWithClient(<EventBrowse />);
    await screen.findByText("Product Engineering Summit 2026");

    await user.click(screen.getByRole("radio", { name: "Past events" }));

    await waitFor(() => expect(lastParams()?.when).toBe("past"));
  });

  it("asks for another sort order", async () => {
    const user = userEvent.setup();
    renderWithClient(<EventBrowse />);
    await screen.findByText("Product Engineering Summit 2026");

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Sort events" }),
      "price_asc",
    );

    await waitFor(() => expect(lastParams()?.sort).toBe("price_asc"));
  });

  it("shows the skeleton, never the previous rows, while another query loads", async () => {
    const user = userEvent.setup();
    renderWithClient(<EventBrowse />);
    await screen.findByText("Product Engineering Summit 2026");
    api.listPublic.mockReturnValue(new Promise(() => {}));

    await user.click(screen.getByRole("radio", { name: "Free" }));

    expect(
      await screen.findByRole("status", { name: "Loading events" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Product Engineering Summit 2026"),
    ).not.toBeInTheDocument();
  });

  it("starts again from the first page when a filter changes", async () => {
    const user = userEvent.setup();
    api.listPublic.mockResolvedValue(page(SAMPLE, 30));
    renderWithClient(<EventBrowse />);
    await screen.findByText("Product Engineering Summit 2026");

    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(lastParams()?.page).toBe(2));
    await user.click(screen.getByRole("radio", { name: "Paid" }));

    await waitFor(() =>
      expect(lastParams()).toMatchObject({ page: 1, price: "paid" }),
    );
  });

  it("pages through the list", async () => {
    const user = userEvent.setup();
    api.listPublic.mockResolvedValue(page(SAMPLE, 30));
    renderWithClient(<EventBrowse />);
    await screen.findByText("Product Engineering Summit 2026");

    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(lastParams()?.page).toBe(2));
  });
});

describe("EventBrowse: empty, error", () => {
  it("says there are no events yet when nothing is published", async () => {
    api.listPublic.mockResolvedValue(page([]));
    renderWithClient(<EventBrowse />);

    expect(await screen.findByText("No events yet.")).toBeInTheDocument();
  });

  it("says nothing matches, and clears the search and filters", async () => {
    const user = userEvent.setup();
    renderWithClient(<EventBrowse />);
    await screen.findByText("Product Engineering Summit 2026");
    api.listPublic.mockResolvedValue(page([]));

    await user.click(screen.getByRole("radio", { name: "Paid" }));
    expect(await screen.findByText("No events match.")).toBeInTheDocument();

    api.listPublic.mockResolvedValue(page(SAMPLE));
    await user.click(
      screen.getByRole("button", { name: "Clear search and filters" }),
    );

    await screen.findByText("Product Engineering Summit 2026");
    expect(lastParams()).toMatchObject({ price: undefined, when: "upcoming" });
    expect(screen.getByRole("radio", { name: "Any price" })).toBeChecked();
  });

  it("shows an error with the server's message and a way to try again", async () => {
    const user = userEvent.setup();
    api.listPublic.mockRejectedValueOnce(
      new ApiError(503, "UNAVAILABLE", "Try again in a moment"),
    );
    renderWithClient(<EventBrowse />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't load the events",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Try again in a moment",
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));

    await screen.findByText("Product Engineering Summit 2026");
    expect(api.listPublic).toHaveBeenCalledTimes(2);
  });
});
