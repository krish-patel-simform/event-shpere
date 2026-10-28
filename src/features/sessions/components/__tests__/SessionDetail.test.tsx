/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  allSessions,
  pwaTalk,
  reduxTalk,
  scalingTalk,
} from "../../__fixtures__/sessions";
import { SESSION_ROUTES } from "../../routes";
import { SessionDetail } from "../SessionDetail";
import { SessionDetailSkeleton } from "../SessionDetailSkeleton";

function renderDetail(
  sessionId: string,
  props: Partial<Parameters<typeof SessionDetail>[0]> = {},
) {
  return render(
    <SessionDetail sessionId={sessionId} sessions={allSessions} {...props} />,
  );
}

/** A card, found by its heading. */
const card = (name: string) => within(screen.getByRole("region", { name }));

describe("SessionDetail", () => {
  it("shows the title, status, format, track and level in the header", () => {
    renderDetail(scalingTalk.id);
    expect(
      screen.getByRole("heading", { level: 1, name: scalingTalk.title }),
    ).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Talk · 45 min")).toBeInTheDocument();
    expect(screen.getByText("Frontend Architecture")).toBeInTheDocument();
    expect(screen.getByText("Intermediate")).toBeInTheDocument();
  });

  it("shows when and where it takes place", () => {
    renderDetail(scalingTalk.id);
    expect(screen.getByText("Wed, 10 Jun 2026")).toBeInTheDocument();
    expect(screen.getByText("09:00 – 09:45 UTC")).toBeInTheDocument();
    // Once in the header, once under Room & logistics.
    expect(screen.getAllByText("Hall B")).toHaveLength(2);
  });

  it("has a breadcrumb back to My sessions", () => {
    renderDetail(scalingTalk.id);
    const crumb = within(
      screen.getByRole("navigation", { name: "Breadcrumb" }),
    );
    expect(crumb.getByRole("link", { name: "My sessions" })).toHaveAttribute(
      "href",
      SESSION_ROUTES.list,
    );
    expect(crumb.getByText(scalingTalk.title)).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows the abstract and what attendees will learn", () => {
    renderDetail(scalingTalk.id);
    const about = card("About this session");
    expect(about.getByText(scalingTalk.abstract)).toBeInTheDocument();
    expect(about.getByText("Attendees will learn")).toBeInTheDocument();
    expect(about.getByText("Cache with intent")).toBeInTheDocument();
  });

  it("lists the files and says that uploading is not available", () => {
    renderDetail(scalingTalk.id);
    const materials = card("Presentation materials");
    expect(
      materials.getByText("Uploading files is not available yet"),
    ).toBeInTheDocument();
    expect(materials.getByText("outline.pdf")).toBeInTheDocument();
    expect(materials.getByText(/1\.8 MB/)).toBeInTheDocument();
    expect(
      materials.getByText(/Visible to organizers only/),
    ).toBeInTheDocument();
    expect(materials.getByText("Due 1 Jun 2026")).toBeInTheDocument();
  });

  it("shows the co-speakers and whether they accepted", () => {
    renderDetail(scalingTalk.id);
    const people = card("Co-speakers");
    expect(people.getByText("Vikram Mehta")).toBeInTheDocument();
    expect(people.getByText("Accepted")).toBeInTheDocument();
    expect(people.getByText("Sara Khan")).toBeInTheDocument();
    expect(people.getByText("Invitation pending")).toBeInTheDocument();
  });

  it("shows seats, the progress bar, a warning in words and the sign-up chart", () => {
    renderDetail(scalingTalk.id);
    const seats = card("Registrations");
    expect(seats.getByText("95")).toBeInTheDocument();
    expect(seats.getByText("of 100 seats")).toBeInTheDocument();
    expect(seats.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "95",
    );
    expect(seats.getByText(/5 seats remaining/)).toBeInTheDocument();
    expect(seats.getByText(/Almost full/)).toBeInTheDocument();
    expect(
      seats.getByRole("img", {
        name: "Daily registrations from 24 May to 26 May: 10, 20, 5",
      }),
    ).toBeInTheDocument();
  });

  it("shows room and logistics", () => {
    renderDetail(scalingTalk.id);
    const logistics = card("Room & logistics");
    expect(logistics.getByText("Theatre, 100 seats")).toBeInTheDocument();
    expect(logistics.getByText("08:30 at the Green Room")).toBeInTheDocument();
    expect(logistics.getByText("Priya Nair")).toBeInTheDocument();
  });

  it("shows Edit details and Open live console as disabled, with the reason", () => {
    renderDetail(scalingTalk.id);
    expect(screen.getByRole("button", { name: "Edit details" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Open live console" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Edit details" }),
    ).toHaveAccessibleDescription(
      "Editing a session and the live console are not available yet.",
    );
  });

  it("says a session that is not scheduled has no seats or room yet", () => {
    renderDetail(pwaTalk.id);
    expect(screen.getByText("Not scheduled yet")).toBeInTheDocument();
    expect(
      screen.getByText("Registrations open once the session is scheduled."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/shared once the organizers schedule this session/),
    ).toBeInTheDocument();
    expect(screen.getByText("No files yet.")).toBeInTheDocument();
    expect(screen.getByText(/No co-speakers/)).toBeInTheDocument();
  });

  it("shows attendance and the rating for a finished session", () => {
    renderDetail(reduxTalk.id);
    const attendance = card("Attendance");
    expect(attendance.getByText("412")).toBeInTheDocument();
    expect(attendance.getByText("attended")).toBeInTheDocument();
    expect(
      attendance.getByText("Rated 4.7 / 5 by attendees"),
    ).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("shows 'Session not found' for an unknown id, with a way back", () => {
    renderDetail("does-not-exist");
    expect(
      screen.getByText("Session not found", { selector: "p" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to my sessions" }),
    ).toHaveAttribute("href", SESSION_ROUTES.list);
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("shows the loading skeleton", () => {
    renderDetail(scalingTalk.id, { state: "loading" });
    expect(
      screen.getByRole("status", { name: "Loading session" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("shows an error with Try again", async () => {
    const onRetry = jest.fn();
    renderDetail(scalingTalk.id, { state: "error", onRetry });
    expect(
      screen.getByText("We couldn't load this session"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("SessionDetailSkeleton", () => {
  it("is announced as loading", () => {
    render(<SessionDetailSkeleton />);
    expect(
      screen.getByRole("status", { name: "Loading session" }),
    ).toBeInTheDocument();
  });
});
