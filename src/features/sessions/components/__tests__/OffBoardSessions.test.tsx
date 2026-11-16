/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  cancelledKeynote,
  EVENT_ID,
  SPEAKER_ANANYA_ID,
  SPEAKER_ROHAN_ID,
} from "../../__fixtures__/organizer-sessions";
import { eventSessionEditHref } from "../../routes";
import type { SessionDto } from "../../schemas/sessions.schemas";
import { OFF_BOARD_PREVIEW, OffBoardSessions } from "../OffBoardSessions";

const ZONE = "Asia/Kolkata";

/** `count` running online sessions, one an hour from 09:00 IST on 12 Dec 2026. */
function onlineSessions(count: number): SessionDto[] {
  return Array.from({ length: count }, (_, index) => ({
    ...cancelledKeynote,
    id: `7c3d4e5f-6a7b-4c8d-ae9f-1a2b3c4d5f${String(index).padStart(2, "0")}`,
    title: `Online talk ${index + 1}`,
    type: "talk" as const,
    status: "scheduled" as const,
    startAt: new Date(Date.UTC(2026, 11, 12, 3 + index, 30)).toISOString(),
    endAt: new Date(Date.UTC(2026, 11, 12, 4 + index, 30)).toISOString(),
  }));
}

function setup(sessions: SessionDto[]) {
  render(
    <OffBoardSessions eventId={EVENT_ID} sessions={sessions} timezone={ZONE} />,
  );
}

const tiles = () => within(screen.getByRole("list")).getAllByRole("listitem");
const search = () =>
  screen.getByRole("searchbox", { name: "Search these sessions" });

describe("OffBoardSessions", () => {
  it("says how many sessions have no column, and how many of them are cancelled", () => {
    setup([...onlineSessions(2), cancelledKeynote]);

    expect(
      screen.getByRole("heading", { name: "Not on the board (3)" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 cancelled\./)).toBeInTheDocument();
  });

  describe("a tile", () => {
    it("shows the title and when the session is, in two lines, without a badge for a plain online session", () => {
      setup(onlineSessions(1));

      const [tile] = tiles();
      expect(within(tile).getByText("Online talk 1")).toBeInTheDocument();
      expect(
        within(tile).getByText("Sat 12 Dec · 09:00–10:00"),
      ).toBeInTheDocument();
      // Every tile is an online session, so the card says it once and the tile does not repeat it.
      expect(within(tile).queryByText("Online")).not.toBeInTheDocument();
      expect(within(tile).queryByText("Cancelled")).not.toBeInTheDocument();
    });

    it("badges a session that is not online but still has no column", () => {
      setup([{ ...onlineSessions(1)[0], mode: "in_person" }]);

      expect(within(tiles()[0]).getByText("Off the board")).toBeInTheDocument();
    });

    it("keeps to a compact height: one line for the title, which is cut short, not wrapped", () => {
      setup(onlineSessions(1));

      const title = screen.getByText("Online talk 1");
      expect(title).toHaveClass("truncate");
      expect(title).not.toHaveClass("line-clamp-2");
    });

    it("marks a cancelled session: dashed, struck through, and badged", () => {
      setup([onlineSessions(1)[0], cancelledKeynote]);

      const [, cancelled] = tiles();
      expect(within(cancelled).getByText("Cancelled")).toBeInTheDocument();
      expect(within(cancelled).getByText(cancelledKeynote.title)).toHaveClass(
        "line-through",
      );
      expect(cancelled).toHaveClass("border-dashed");
    });

    it("carries the colour its session type has on the board", () => {
      setup([
        { ...onlineSessions(1)[0], type: "keynote" },
        { ...onlineSessions(2)[1], type: "workshop" },
      ]);

      const [keynote, workshop] = tiles();
      expect(keynote).toHaveClass("border-l-session-keynote");
      expect(workshop).toHaveClass("border-l-session-workshop");
    });

    it("names who speaks, and counts the rest when there are more than two", () => {
      const [first] = onlineSessions(1);
      const speaker = (id: string, name: string, displayOrder: number) => ({
        speakerId: id,
        name,
        role: "speaker" as const,
        displayOrder,
      });
      setup([
        {
          ...first,
          speakers: [
            speaker(SPEAKER_ROHAN_ID, "Rohan Mehta", 1),
            speaker(SPEAKER_ANANYA_ID, "Ananya Rao", 0),
          ],
        },
        {
          ...onlineSessions(2)[1],
          speakers: [
            speaker(SPEAKER_ANANYA_ID, "Ananya Rao", 0),
            speaker(SPEAKER_ROHAN_ID, "Rohan Mehta", 1),
            speaker("a1b2c3d4-0000-4000-8000-000000000001", "Meera Joshi", 2),
          ],
        },
      ]);

      const [two, three] = tiles();
      // In the order they were given, whatever order the API sent.
      expect(
        within(two).getByText("· Ananya Rao, Rohan Mehta"),
      ).toBeInTheDocument();
      expect(within(three).getByText("· Ananya Rao +2")).toBeInTheDocument();
    });

    it("names a session with no time yet", () => {
      setup([{ ...onlineSessions(1)[0], startAt: null, endAt: null }]);

      expect(screen.getByText("No time yet")).toBeInTheDocument();
    });

    it("is a link to the session's edit page, all over the tile", () => {
      const [first] = onlineSessions(1);
      setup([first]);

      expect(
        screen.getByRole("link", { name: "Edit Online talk 1" }),
      ).toHaveAttribute("href", eventSessionEditHref(EVENT_ID, first.id));
    });
  });

  describe("many sessions", () => {
    it("shows a few in full, with no search and no button to expand", () => {
      setup(onlineSessions(OFF_BOARD_PREVIEW));

      expect(tiles()).toHaveLength(OFF_BOARD_PREVIEW);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    });

    it("shows only the first tiles of many, and expands to all of them and back", async () => {
      const user = userEvent.setup();
      setup(onlineSessions(15));

      expect(tiles()).toHaveLength(OFF_BOARD_PREVIEW);
      const toggle = screen.getByRole("button", {
        name: "Show all 15 (9 more)",
      });
      expect(toggle).toHaveAttribute("aria-expanded", "false");

      await user.click(toggle);

      expect(tiles()).toHaveLength(15);
      expect(
        screen.getByRole("button", { name: "Show fewer" }),
      ).toHaveAttribute("aria-expanded", "true");

      await user.click(screen.getByRole("button", { name: "Show fewer" }));
      expect(tiles()).toHaveLength(OFF_BOARD_PREVIEW);
    });

    it("scrolls inside the card when a long grid is open, instead of growing without end", async () => {
      const user = userEvent.setup();
      setup(onlineSessions(15));

      expect(screen.getByRole("list").parentElement).not.toHaveClass(
        "overflow-y-auto",
      );

      await user.click(screen.getByRole("button", { name: /Show all 15/ }));

      expect(screen.getByRole("list").parentElement).toHaveClass(
        "overflow-y-auto",
      );
    });
  });

  describe("searching", () => {
    it("appears once there are more sessions than fit, and finds a session by its title", async () => {
      const user = userEvent.setup();
      setup(onlineSessions(15));

      await user.type(search(), "talk 13");

      expect(tiles()).toHaveLength(1);
      expect(screen.getByText("Online talk 13")).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(
        "1 of 15 sessions match.",
      );
    });

    it("shows every match, past the few a collapsed grid shows, and has no expand button meanwhile", async () => {
      const user = userEvent.setup();
      setup(onlineSessions(15));

      // "Online talk 1" matches 1, 10, 11, 12, 13, 14 and 15.
      await user.type(search(), "Online talk 1");

      expect(tiles()).toHaveLength(7);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("ignores case and the spaces around the words", async () => {
      const user = userEvent.setup();
      setup(onlineSessions(15));

      await user.type(search(), "  ONLINE TALK 7  ");

      expect(tiles()).toHaveLength(1);
      expect(screen.getByText("Online talk 7")).toBeInTheDocument();
    });

    it("says so when nothing matches, and goes back to the first tiles when cleared", async () => {
      const user = userEvent.setup();
      setup(onlineSessions(15));

      await user.type(search(), "zzz");
      expect(screen.getByRole("status")).toHaveTextContent(
        "No session matches “zzz”.",
      );
      expect(screen.queryByRole("list")).not.toBeInTheDocument();

      await user.clear(search());

      expect(tiles()).toHaveLength(OFF_BOARD_PREVIEW);
      expect(
        screen.getByRole("button", { name: "Show all 15 (9 more)" }),
      ).toBeInTheDocument();
    });
  });
});
