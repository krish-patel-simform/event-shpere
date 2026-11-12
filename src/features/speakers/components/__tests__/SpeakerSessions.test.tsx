/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { speakersApiService } from "../../api/speakers-api.service";
import type {
  SpeakerSessionGroupDto,
  SpeakerSessionTimeline,
} from "../../schemas/speaker-sessions.schemas";
import { SpeakerSessions } from "../SpeakerSessions";

jest.mock("../../api/speakers-api.service", () => ({
  speakersApiService: { listSessions: jest.fn() },
}));
const api = jest.mocked(speakersApiService);

const slug = "ananya-rao-3f9a1c";
const DAY_MS = 24 * 60 * 60 * 1000;
const inDays = (days: number, hours = 0) =>
  new Date(Date.now() + days * DAY_MS + hours * 60 * 60 * 1000).toISOString();

const group = (
  title: string,
  eventSlug: string,
  sessions: { id: string; title: string; seatsLeft: number | null }[],
  startAt = inDays(2),
): SpeakerSessionGroupDto => ({
  event: {
    slug: eventSlug,
    title,
    startAt,
    endAt: inDays(3),
    timezone: "Asia/Kolkata",
    venue: { name: "Tech Park Auditorium", city: "Pune" },
    ticketPrice: 0,
  },
  sessions: sessions.map((session) => ({
    id: session.id,
    title: session.title,
    type: "talk",
    mode: "in_person",
    startAt,
    endAt: inDays(2, 1),
    hallName: "Hall A",
    price: 0,
    requiresRegistration: session.seatsLeft !== null,
    seatsLeft: session.seatsLeft,
  })),
});

const sessionA = "a0000000-0000-4000-8000-000000000001";
const sessionB = "b0000000-0000-4000-8000-000000000002";
const sessionC = "c0000000-0000-4000-8000-000000000003";

const meta = (total: number, totalSessions: number, page = 1) => ({
  page,
  pageSize: 5,
  total,
  totalSessions,
});

const upcomingGroups = [
  group("Design Systems Engineering Day", "design-systems-day", [
    { id: sessionA, title: "Design Tokens at Scale", seatsLeft: 54 },
  ]),
  group("Product Engineering Summit 2026", "product-summit", [
    { id: sessionB, title: "Scaling Next.js Applications", seatsLeft: 0 },
    { id: sessionC, title: "Panel: The Future of Tooling", seatsLeft: null },
  ]),
];

/** Answers each category with its own rows; a category not listed is empty. */
function serve(
  byTimeline: Partial<
    Record<
      SpeakerSessionTimeline,
      { items: SpeakerSessionGroupDto[]; total: number; sessions: number }
    >
  >,
) {
  api.listSessions.mockImplementation(async (_slug, { timeline, page = 1 }) => {
    const found = byTimeline[timeline];
    return {
      items: found?.items ?? [],
      meta: meta(found?.total ?? 0, found?.sessions ?? 0, page),
    };
  });
}

function renderCard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SpeakerSessions slug={slug} />
    </QueryClientProvider>,
  );
}

const section = (name: string) => screen.getByRole("region", { name });

/** A section once its request has answered (the skeleton is gone). */
async function loadedSection(name: string) {
  const found = await screen.findByRole("region", { name });
  await waitFor(() =>
    expect(within(found).queryByRole("status")).not.toBeInTheDocument(),
  );
  return found;
}

beforeEach(() => jest.resetAllMocks());

describe("SpeakerSessions", () => {
  it("asks for the three categories of this speaker, first page", async () => {
    serve({});
    renderCard();

    await screen.findByText("No upcoming sessions yet.");
    expect(api.listSessions).toHaveBeenCalledTimes(3);
    for (const timeline of ["now", "upcoming", "past"]) {
      expect(api.listSessions).toHaveBeenCalledWith(slug, {
        timeline,
        page: 1,
      });
    }
  });

  it("shows a skeleton in each section while it loads", () => {
    api.listSessions.mockReturnValue(new Promise(() => undefined));
    renderCard();

    expect(
      screen.getByRole("status", { name: "Loading upcoming sessions" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Loading happening now sessions" }),
    ).toBeInTheDocument();
  });

  it("lists the events with the speaker's sessions, linked to their own pages", async () => {
    serve({ upcoming: { items: upcomingGroups, total: 2, sessions: 3 } });
    renderCard();

    const upcoming = await loadedSection("Upcoming");
    expect(
      within(upcoming).getByRole("link", {
        name: "Design Systems Engineering Day",
      }),
    ).toHaveAttribute("href", "/events/design-systems-day");
    expect(
      within(upcoming).getByRole("link", { name: "Design Tokens at Scale" }),
    ).toHaveAttribute(
      "href",
      `/events/design-systems-day/sessions/${sessionA}`,
    );
    expect(within(upcoming).getByText("3 sessions · 2 events")).toBeVisible();
    expect(within(upcoming).getByText("2 sessions")).toBeVisible();
  });

  it("shows the seats left, Full, and nothing when no booking is needed", async () => {
    serve({ upcoming: { items: upcomingGroups, total: 2, sessions: 3 } });
    renderCard();

    const upcoming = await loadedSection("Upcoming");
    expect(within(upcoming).getByText("54 seats left")).toBeVisible();
    expect(within(upcoming).getByText("Full")).toBeVisible();
    // Three sessions in all, but only two have a seat badge.
    expect(within(upcoming).getAllByRole("listitem")).toHaveLength(3);
    expect(within(upcoming).queryByText(/null/)).not.toBeInTheDocument();
  });

  it("says how far away an event is", async () => {
    serve({ upcoming: { items: upcomingGroups, total: 2, sessions: 3 } });
    renderCard();

    const upcoming = await loadedSection("Upcoming");
    expect(
      within(upcoming).getAllByText(/^In \d+ days?$|^In under a day$/),
    ).toHaveLength(2);
  });

  it("marks the sessions on right now as live", async () => {
    serve({
      now: {
        items: [
          group(
            "Frontend Engineering Week 2026",
            "frontend-week",
            [
              {
                id: sessionA,
                title: "Web Performance Budgets",
                seatsLeft: null,
              },
            ],
            inDays(-1),
          ),
        ],
        total: 1,
        sessions: 1,
      },
    });
    renderCard();

    const now = await loadedSection("Happening now");
    expect(within(now).getAllByText("Live now")).toHaveLength(2);
  });

  it("shows how many sessions each category has in the jump links", async () => {
    serve({
      now: { items: [], total: 0, sessions: 0 },
      upcoming: { items: upcomingGroups, total: 2, sessions: 3 },
    });
    renderCard();

    const nav = screen.getByRole("navigation", { name: "Jump to" });
    expect(
      await within(nav).findByRole("link", { name: "Upcoming · 3" }),
    ).toHaveAttribute("href", "#speaker-sessions-upcoming");
    expect(within(nav).getByRole("link", { name: "Now · 0" })).toBeVisible();
    expect(within(nav).getByRole("link", { name: "Past · 0" })).toBeVisible();
  });

  it("says so when a category is empty, without hiding the others", async () => {
    serve({ upcoming: { items: upcomingGroups, total: 2, sessions: 3 } });
    renderCard();

    expect(await screen.findByText("No sessions on right now.")).toBeVisible();
    expect(screen.getByText("No past sessions yet.")).toBeVisible();
    expect(
      within(section("Upcoming")).getByRole("link", {
        name: "Design Tokens at Scale",
      }),
    ).toBeVisible();
  });

  it("shows a failed category with a way to try again, and the others still work", async () => {
    api.listSessions.mockImplementation(async (_slug, { timeline }) => {
      if (timeline === "past") {
        throw new ApiError(500, "INTERNAL", "Something broke");
      }
      return {
        items: timeline === "upcoming" ? upcomingGroups : [],
        meta: meta(
          timeline === "upcoming" ? 2 : 0,
          timeline === "upcoming" ? 3 : 0,
        ),
      };
    });
    renderCard();

    const past = await screen.findByRole("region", { name: "Also spoken at" });
    expect(await within(past).findByText("Something broke")).toBeVisible();
    expect(
      within(section("Upcoming")).getByRole("link", {
        name: "Design Tokens at Scale",
      }),
    ).toBeVisible();

    api.listSessions.mockResolvedValue({ items: [], meta: meta(0, 0) });
    await userEvent.click(
      within(past).getByRole("button", { name: "Try again" }),
    );
    expect(
      await within(past).findByText("No past sessions yet."),
    ).toBeVisible();
  });

  it("pages by event: Next asks for page 2 and shows only its rows", async () => {
    const page2 = [
      group("Pune React Meetup", "pune-react-meetup", [
        {
          id: sessionC,
          title: "Server Components in Practice",
          seatsLeft: null,
        },
      ]),
    ];
    api.listSessions.mockImplementation(
      async (_slug, { timeline, page = 1 }) => {
        if (timeline !== "upcoming") return { items: [], meta: meta(0, 0) };
        return page === 1
          ? {
              items: upcomingGroups,
              meta: { page: 1, pageSize: 2, total: 3, totalSessions: 4 },
            }
          : {
              items: page2,
              meta: { page: 2, pageSize: 2, total: 3, totalSessions: 4 },
            };
      },
    );
    renderCard();

    const upcoming = await screen.findByRole("region", { name: "Upcoming" });
    expect(await within(upcoming).findByText("Events 1–2 of 3")).toBeVisible();
    expect(
      within(upcoming).getByRole("button", { name: "Previous" }),
    ).toBeDisabled();

    await userEvent.click(
      within(upcoming).getByRole("button", { name: "Next" }),
    );

    expect(api.listSessions).toHaveBeenCalledWith(slug, {
      timeline: "upcoming",
      page: 2,
    });
    expect(
      await within(upcoming).findByRole("link", { name: "Pune React Meetup" }),
    ).toBeVisible();
    // The first page's rows are gone, not shown next to the new ones.
    expect(
      within(upcoming).queryByRole("link", { name: "Design Tokens at Scale" }),
    ).not.toBeInTheDocument();
    expect(
      within(upcoming).getByRole("button", { name: "Next" }),
    ).toBeDisabled();
  });

  it("folds and unfolds an event with its button, keeping the folded rows out of reach", async () => {
    serve({ upcoming: { items: upcomingGroups, total: 2, sessions: 3 } });
    renderCard();

    const upcoming = await loadedSection("Upcoming");
    const toggle = within(upcoming).getByRole("button", {
      name: "Collapse Design Systems Engineering Day",
    });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const rows = document.getElementById(
      toggle.getAttribute("aria-controls") ?? "",
    );
    expect(rows).not.toHaveAttribute("inert");

    await userEvent.click(toggle);

    expect(
      within(upcoming).getByRole("button", {
        name: "Expand Design Systems Engineering Day",
      }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(rows).toHaveAttribute("inert");
    // The other event stays open.
    expect(
      within(upcoming).getByRole("button", {
        name: "Collapse Product Engineering Summit 2026",
      }),
    ).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(
      within(upcoming).getByRole("button", {
        name: "Expand Design Systems Engineering Day",
      }),
    );
    expect(rows).not.toHaveAttribute("inert");
  });

  it("has no pager when everything fits on one page", async () => {
    serve({ upcoming: { items: upcomingGroups, total: 2, sessions: 3 } });
    renderCard();

    await screen.findByRole("link", { name: "Design Tokens at Scale" });
    expect(
      screen.queryByRole("navigation", { name: "Event pages" }),
    ).not.toBeInTheDocument();
  });
});
