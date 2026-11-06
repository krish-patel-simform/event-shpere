/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import {
  boardHeight,
  DEFAULT_FRAME,
  type BoardDay,
  type BoardHall,
  type BoardSession,
} from "../../utils/schedule-board";
import { ScheduleBoard } from "../ScheduleBoard";

const DAYS: BoardDay[] = [
  { index: 0, key: "2026-12-12", label: "Sat 12 Dec" },
  { index: 1, key: "2026-12-13", label: "Sun 13 Dec" },
];
const HALL_A = "hall-a";
const HALL_B = "hall-b";
const HALLS: BoardHall[] = [
  { id: HALL_A, name: "Hall A", seats: 300, active: true },
  { id: HALL_B, name: "Hall B", seats: 120, active: true },
];
const ANANYA = { id: "ananya", name: "Ananya Rao" };

function session(
  id: string,
  hallId: string,
  startHour: number,
  endHour: number,
  rest: Partial<BoardSession> = {},
): BoardSession {
  return {
    id,
    title: id,
    type: "talk",
    hallId,
    day: 0,
    startMinute: startHour * 60,
    endMinute: endHour * 60,
    speakers: [],
    cancelled: false,
    movable: true,
    ...rest,
  };
}

// jsdom has no layout, so every rectangle dnd-kit asks for is made up here: the hall columns sit
// side by side (200px wide, from x = 56) starting 100px down, a block sits where its time puts it
// in its column, and the drag overlay (fixed) is where its own style says.
const COLUMN_LEFT = 56;
const COLUMN_WIDTH = 200;
const COLUMN_TOP = 100;

function rect(left: number, top: number, width: number, height: number) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function mockLayout() {
  jest
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: Element) {
      const label = this.getAttribute("aria-label") ?? "";
      const column = HALLS.findIndex((hall) =>
        label.startsWith(`${hall.name},`),
      );
      const left = (index: number) => COLUMN_LEFT + index * COLUMN_WIDTH;
      const style = (this as HTMLElement).style;

      if (this.tagName === "UL" && column >= 0) {
        return rect(
          left(column),
          COLUMN_TOP,
          COLUMN_WIDTH,
          boardHeight(DEFAULT_FRAME),
        );
      }
      const parentLabel = this.parentElement?.getAttribute("aria-label") ?? "";
      const parentColumn = HALLS.findIndex((hall) =>
        parentLabel.startsWith(`${hall.name},`),
      );
      if (this.tagName === "LI" && parentColumn >= 0) {
        return rect(
          left(parentColumn) + 4,
          COLUMN_TOP + parseFloat(style.top),
          COLUMN_WIDTH - 8,
          parseFloat(style.height),
        );
      }
      // The drag overlay: the fixed box itself, or the box inside it that dnd-kit measures.
      const fixed =
        style.position === "fixed" && style.top
          ? style
          : this.parentElement?.style.position === "fixed"
            ? this.parentElement.style
            : null;
      if (fixed?.top) {
        return rect(
          parseFloat(fixed.left),
          parseFloat(fixed.top),
          parseFloat(fixed.width),
          parseFloat(fixed.height),
        );
      }
      return rect(0, 0, 0, 0);
    });
}

beforeEach(() => {
  jest.restoreAllMocks();
  mockLayout();
});

function setup(
  sessions: BoardSession[],
  onMove = jest.fn().mockResolvedValue(undefined),
) {
  render(
    <ScheduleBoard
      days={DAYS}
      halls={HALLS}
      sessions={sessions}
      frame={DEFAULT_FRAME}
      onMove={onMove}
      editHref={(sessionId) => `/organizer/edit/${sessionId}`}
    />,
  );
  return onMove;
}

/**
 * Drags a block by its grip: the pointer goes down on the grip (inside Hall A), moves a little
 * to start the drag, then to the hall column at `columnIndex` and `dy` below where it began.
 */
async function drag(
  title: string,
  columnIndex: number,
  dy: number,
  startY = 200,
) {
  const user = userEvent.setup();
  const grip = screen.getByRole("button", { name: `Move ${title}` });
  const startX = COLUMN_LEFT + 180;

  await user.pointer([
    {
      keys: "[MouseLeft>]",
      target: grip,
      coords: { clientX: startX, clientY: startY },
    },
    { coords: { clientX: startX + 10, clientY: startY + 10 } },
    {
      coords: {
        clientX: startX + columnIndex * COLUMN_WIDTH,
        clientY: startY + dy,
      },
    },
    { keys: "[/MouseLeft]" },
  ]);
}

describe("ScheduleBoard: dragging a session", () => {
  it("sends the moved session to onMove when it is dropped on another hall at a free time", async () => {
    // The talk is in Hall A at 10:00 (64px below the top). 192px lower is 13:00.
    const onMove = setup([session("Talk", HALL_A, 10, 11)]);

    await drag("Talk", 1, 192);

    await waitFor(() => expect(onMove).toHaveBeenCalledTimes(1));
    expect(onMove.mock.calls[0][0]).toMatchObject({
      id: "Talk",
      hallId: HALL_B,
      day: 0,
      startMinute: 13 * 60,
      endMinute: 14 * 60,
    });
  });

  it("says it was moved once the save worked", async () => {
    setup([session("Talk", HALL_A, 10, 11)]);

    await drag("Talk", 1, 192);

    expect(
      await screen.findByText(
        'Moved "Talk" to Hall B, Sat 12 Dec, 13:00–14:00.',
      ),
    ).toBeInTheDocument();
  });

  it("changes only the time when it is dropped in the same hall", async () => {
    const onMove = setup([session("Talk", HALL_A, 10, 11)]);

    await drag("Talk", 0, 128);

    await waitFor(() => expect(onMove).toHaveBeenCalledTimes(1));
    expect(onMove.mock.calls[0][0]).toMatchObject({
      hallId: HALL_A,
      startMinute: 12 * 60,
      endMinute: 13 * 60,
    });
  });

  it("does not send a drop that lands where it began", async () => {
    const onMove = setup([session("Talk", HALL_A, 10, 11)]);

    await drag("Talk", 0, 0);

    expect(onMove).not.toHaveBeenCalled();
  });

  it("does not send a drop on a busy hall, and says who holds it", async () => {
    const onMove = setup([
      session("Talk", HALL_A, 10, 11),
      session("Panel", HALL_B, 13, 14),
    ]);

    await drag("Talk", 1, 192);

    expect(
      await screen.findByText(
        'Not moved. Hall B is busy: "Panel" at 13:00–14:00.',
      ),
    ).toBeInTheDocument();
    expect(onMove).not.toHaveBeenCalled();
  });

  it("does not send a drop when a speaker is in another hall at that time", async () => {
    const onMove = setup([
      session("Talk", HALL_A, 10, 11, { speakers: [ANANYA] }),
      session("Workshop", HALL_B, 13, 15, { speakers: [ANANYA] }),
    ]);

    // Dropped in Hall A at 13:00: the hall is free, but Ananya is in the Hall B workshop.
    await drag("Talk", 0, 192);

    expect(
      await screen.findByText(
        'Not moved. Ananya Rao is already in "Workshop" at 13:00–15:00.',
      ),
    ).toBeInTheDocument();
    expect(onMove).not.toHaveBeenCalled();
  });

  it("shows the server's reason when it refuses the move", async () => {
    setup(
      [session("Talk", HALL_A, 10, 11)],
      jest
        .fn()
        .mockRejectedValue(
          new Error("This hall was just booked by someone else."),
        ),
    );

    await drag("Talk", 1, 192);

    expect(
      await screen.findByText(
        "Not moved. This hall was just booked by someone else.",
      ),
    ).toBeInTheDocument();
  });

  describe("while the server has not answered", () => {
    /** A move that stays pending until `finish` is called. */
    function pendingMove() {
      let finish: () => void = () => undefined;
      const onMove = jest
        .fn()
        .mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
      setup(
        [session("Talk", HALL_A, 10, 11), session("Other", HALL_B, 15, 16)],
        onMove,
      );
      return { finish: () => finish() };
    }

    it("marks the moved session as saving, so it does not look saved", async () => {
      pendingMove();

      await drag("Talk", 1, 192);

      expect(await screen.findByText("Saving the move…")).toBeInTheDocument();
      const block = screen.getByText(/Saving · /).closest("[data-pending]");
      expect(block).toHaveAttribute("data-pending", "true");
      expect(block).toHaveTextContent("Talk");
      expect(block?.closest("li")).toHaveAttribute("aria-busy", "true");
      // Only the moved session is marked.
      expect(screen.getAllByText(/Saving · /)).toHaveLength(1);
    });

    it("takes the grip and the link off the saving session only: the others stay free to move", async () => {
      pendingMove();

      await drag("Talk", 1, 192);
      await screen.findByText("Saving the move…");

      expect(
        screen.queryByRole("button", { name: "Move Talk" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "Edit Talk" }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Move Other" })).toBeEnabled();
      expect(
        screen.getByRole("link", { name: "Edit Other" }),
      ).toBeInTheDocument();
    });

    it("goes back to normal once the server has answered", async () => {
      const { finish } = pendingMove();

      await drag("Talk", 1, 192);
      await screen.findByText("Saving the move…");
      finish();

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Move Talk" })).toBeEnabled(),
      );
      expect(screen.queryByText(/Saving · /)).not.toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Edit Talk" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Move Other" })).toBeEnabled();
    });
  });

  it("leaves nothing marked as saving when the server refuses the move", async () => {
    setup(
      [session("Talk", HALL_A, 10, 11)],
      jest.fn().mockRejectedValue(new Error("This hall was just booked.")),
    );

    await drag("Talk", 1, 192);

    await screen.findByText("Not moved. This hall was just booked.");
    expect(screen.queryByText(/Saving · /)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move Talk" })).toBeEnabled();
  });

  it("pulls a block dropped below the last hour up so it still ends inside the board", async () => {
    const onMove = setup([session("Talk", HALL_A, 10, 11)]);

    // 470px lower puts the top at 17:15, so an hour-long block would end after 18:00.
    await drag("Talk", 0, 470);

    await waitFor(() => expect(onMove).toHaveBeenCalledTimes(1));
    expect(onMove.mock.calls[0][0]).toMatchObject({
      startMinute: 17 * 60,
      endMinute: 18 * 60,
    });
  });
});

describe("ScheduleBoard: moving a session while another is being saved", () => {
  /**
   * The board inside a stand-in for the page: a move shows at once (like the page's optimistic
   * update) and is put back when `onMove` is refused (like its rollback).
   */
  function Page({
    initial,
    onMove,
  }: {
    initial: BoardSession[];
    onMove: (moved: BoardSession) => Promise<void>;
  }) {
    const [sessions, setSessions] = useState(initial);
    return (
      <ScheduleBoard
        days={DAYS}
        halls={HALLS}
        sessions={sessions}
        frame={DEFAULT_FRAME}
        editHref={(sessionId) => `/organizer/edit/${sessionId}`}
        onMove={async (moved) => {
          const before = sessions.find((item) => item.id === moved.id);
          const put = (to: BoardSession | undefined) =>
            setSessions((current) =>
              current.map((item) => (item.id === moved.id && to ? to : item)),
            );
          put(moved);
          try {
            await onMove(moved);
          } catch (error) {
            put(before);
            throw error;
          }
        }}
      />
    );
  }

  /** Talk (Hall A 10:00) and Other (Hall B 15:00); each call of `onMove` is answered by the test. */
  function setupPage() {
    const answers: { resolve: () => void; reject: (error: Error) => void }[] =
      [];
    const onMove = jest.fn().mockImplementation(
      () =>
        new Promise<void>((resolve, reject) => {
          answers.push({ resolve, reject });
        }),
    );
    render(
      <Page
        initial={[
          session("Talk", HALL_A, 10, 11),
          session("Other", HALL_B, 15, 16),
        ]}
        onMove={onMove}
      />,
    );
    return { onMove, answers };
  }

  // Other sits at 15:00 in Hall B (484px down); its grip is at y = 520. Talk goes to Hall B 13:00.
  const startTalkMove = () => drag("Talk", 1, 192);

  it("lets another session be moved to a free place while one is being saved", async () => {
    const { onMove } = setupPage();
    await startTalkMove();
    await screen.findByText("Saving the move…");

    // Other to Hall A at 13:00 (128px higher): free.
    await drag("Other", 0, -128, 520);

    await waitFor(() => expect(onMove).toHaveBeenCalledTimes(2));
    expect(onMove.mock.calls[1][0]).toMatchObject({
      id: "Other",
      hallId: HALL_A,
      startMinute: 13 * 60,
    });
    expect(await screen.findByText("Saving 2 moves…")).toBeInTheDocument();
  });

  it("does not let another session take the place a saving session is going to", async () => {
    const { onMove } = setupPage();
    await startTalkMove(); // Talk is on its way to Hall B 13:00-14:00
    await screen.findByText("Saving the move…");

    await drag("Other", 1, -128, 520); // Other to Hall B 13:00

    expect(
      await screen.findByText(
        'Not moved. Hall B is busy: "Talk" at 13:00–14:00. That session is still being saved.',
      ),
    ).toBeInTheDocument();
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it("does not let another session take the place a saving session came from, in case the save fails", async () => {
    const { onMove } = setupPage();
    await startTalkMove(); // Talk left Hall A 10:00-11:00, and goes back there if it is refused
    await screen.findByText("Saving the move…");

    await drag("Other", 0, -320, 520); // Other to Hall A 10:00

    expect(
      await screen.findByText(
        'Not moved. Hall A is busy: "Talk" at 10:00–11:00. That session is still being saved.',
      ),
    ).toBeInTheDocument();
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it("frees the place the session came from once the save has failed, because it is back there", async () => {
    const { onMove, answers } = setupPage();
    await startTalkMove();
    await screen.findByText("Saving the move…");

    answers[0].reject(new Error("This hall was just booked."));
    await screen.findByText("Not moved. This hall was just booked.");

    // Talk is back in Hall A at 10:00: that place is Talk's again, not free.
    await drag("Other", 0, -320, 520);
    expect(
      await screen.findByText(
        'Not moved. Hall A is busy: "Talk" at 10:00–11:00.',
      ),
    ).toBeInTheDocument();
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it("frees the place a session was going to once the save has failed", async () => {
    const { onMove, answers } = setupPage();
    await startTalkMove();
    await screen.findByText("Saving the move…");
    answers[0].reject(new Error("This hall was just booked."));
    await screen.findByText("Not moved. This hall was just booked.");

    // Hall B 13:00 was Talk's destination: it is free again.
    await drag("Other", 1, -128, 520);

    await waitFor(() => expect(onMove).toHaveBeenCalledTimes(2));
    expect(onMove.mock.calls[1][0]).toMatchObject({
      id: "Other",
      hallId: HALL_B,
      startMinute: 13 * 60,
    });
  });

  it("keeps the place a session came from taken until it is saved, and gives it up once it is", async () => {
    const { onMove, answers } = setupPage();
    await startTalkMove();
    await screen.findByText("Saving the move…");

    answers[0].resolve();
    await screen.findByText(/Moved "Talk" to Hall B/);

    // Talk is now in Hall B for good: Hall A at 10:00 is free.
    await drag("Other", 0, -320, 520);

    await waitFor(() => expect(onMove).toHaveBeenCalledTimes(2));
    expect(onMove.mock.calls[1][0]).toMatchObject({
      id: "Other",
      hallId: HALL_A,
      startMinute: 10 * 60,
    });
  });
});

describe("ScheduleBoard: opening a session", () => {
  it("links every block to its edit page, a cancelled or locked one too", () => {
    setup([
      session("Talk", HALL_A, 10, 11),
      session("Locked", HALL_B, 10, 11, { movable: false }),
      session("Gone", HALL_A, 13, 14, { cancelled: true, movable: false }),
    ]);

    for (const title of ["Talk", "Locked", "Gone"]) {
      expect(
        screen.getByRole("link", { name: `Edit ${title}` }),
      ).toHaveAttribute("href", `/organizer/edit/${title}`);
    }
  });

  it("keeps the grip a separate button, not part of the link, so a drag never opens the page", () => {
    setup([session("Talk", HALL_A, 10, 11)]);

    const grip = screen.getByRole("button", { name: "Move Talk" });
    expect(grip.closest("a")).toBeNull();
  });

  it("does not open the edit page when a block is dragged", async () => {
    const onMove = setup([session("Talk", HALL_A, 10, 11)]);
    const link = screen.getByRole("link", { name: "Edit Talk" });
    const click = jest.fn((event: Event) => event.preventDefault());
    link.addEventListener("click", click);

    await drag("Talk", 1, 192);

    await waitFor(() => expect(onMove).toHaveBeenCalledTimes(1));
    expect(click).not.toHaveBeenCalled();
  });

  it("tells that a session can be clicked to edit it", () => {
    setup([session("Talk", HALL_A, 10, 11)]);

    expect(screen.getByText(/Click a session to edit it/)).toBeInTheDocument();
  });
});

describe("ScheduleBoard: what can not be dragged", () => {
  it("gives a session that can not be moved no grip", () => {
    setup([
      session("Locked", HALL_A, 10, 11, { movable: false }),
      session("Free", HALL_B, 10, 11),
    ]);

    expect(
      screen.queryByRole("button", { name: "Move Locked" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Move Free" }),
    ).toBeInTheDocument();
  });
});
