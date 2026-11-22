/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  CheckInContext,
  CheckInOutcome,
} from "../../utils/check-in-result";
import { CheckInPanel, type CheckInPanelProps } from "../CheckInPanel";

const DAY_2: CheckInContext = {
  door: "event",
  date: "2026-12-04",
  dayLabel: "Fri 4 Dec",
  dayOfLabel: "Day 2 of 3",
};

const ok = (code: string, firstName = "Priya"): CheckInOutcome => ({
  ok: true,
  attendee: { firstName, lastName: "Shah", ticketCode: code },
  // 4 Dec 09:41 IST.
  checkedInAt: "2026-12-04T04:11:00.000Z",
});

/** A `send` the test answers by hand. */
function controlledSend() {
  const answers: ((outcome: CheckInOutcome) => void)[] = [];
  // Typed like the panel's `send`; the arguments are read from send.mock.calls.
  const send = jest.fn<
    Promise<CheckInOutcome>,
    [code: string, context: CheckInContext]
  >(
    () =>
      new Promise<CheckInOutcome>((resolve) => {
        answers.push(resolve);
      }),
  );
  return { send, answers };
}

function renderPanel(
  overrides: Partial<CheckInPanelProps> = {},
  { fakeTimers = false } = {},
) {
  // With fake timers, user-event's own small waits must move the fake clock too.
  const user = userEvent.setup(
    fakeTimers ? { advanceTimers: jest.advanceTimersByTime } : {},
  );
  const props: CheckInPanelProps = {
    title: "Check in at the door",
    description: "Type the code and press Enter.",
    rules: "Check-ins can't be undone.",
    door: { open: true, context: DAY_2 },
    timezone: "Asia/Kolkata",
    send: jest.fn(),
    ...overrides,
  };
  const view = render(<CheckInPanel {...props} />);
  const input = () => screen.getByRole("textbox", { name: "Ticket code" });
  const scan = async (code: string) => {
    await user.type(input(), `${code}{Enter}`);
  };
  return { user, view, props, input, scan };
}

const rows = () =>
  within(screen.getByRole("list", { name: "Check-in results" })).getAllByRole(
    "listitem",
  );

describe("CheckInPanel: the form", () => {
  it("asks for a code when Enter is pressed on an empty box, and sends nothing", async () => {
    const send = jest.fn();
    const { user } = renderPanel({ send });

    await user.click(screen.getByRole("button", { name: "Check in" }));

    expect(
      screen.getByText("Enter the ticket code (1 to 32 characters)."),
    ).toBeInTheDocument();
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses a code over 32 characters", async () => {
    const send = jest.fn();
    const { scan } = renderPanel({ send });

    await scan("A".repeat(33));

    expect(screen.getByText(/1 to 32 characters/)).toBeInTheDocument();
    expect(send).not.toHaveBeenCalled();
  });

  it("sends the code trimmed and upper-cased, with the day picked, and empties the box at once", async () => {
    const { send } = controlledSend();
    const { scan, input } = renderPanel({ send });

    await scan("  esevt1y6d4s ");

    expect(send).toHaveBeenCalledWith("ESEVT1Y6D4S", DAY_2);
    expect(input()).toHaveValue("");
    // Ready for the next person: the box is not locked and keeps the focus.
    expect(input()).toBeEnabled();
    expect(input()).toHaveFocus();
  });
});

describe("CheckInPanel: every code is awaited, but the door never waits", () => {
  it("takes the next codes while the first is checked, and shows each one's state", async () => {
    const { send, answers } = controlledSend();
    const { scan } = renderPanel({ send });

    await scan("AAA");
    await scan("BBB");
    await scan("CCC");

    expect(rows().map((row) => row.textContent)).toEqual([
      "CCC · Waiting…",
      "BBB · Waiting…",
      "AAA · Checking…",
    ]);
    expect(
      screen.getByText("3 codes are being checked, in order."),
    ).toBeInTheDocument();
    expect(send).toHaveBeenCalledTimes(1);

    await act(async () => answers[0](ok("AAA")));

    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send).toHaveBeenLastCalledWith("BBB", DAY_2);
    expect(screen.getByText("Priya Shah")).toBeInTheDocument();
  });

  it("reads left to right: the name and ticket with the day chip, the answer, then the time", async () => {
    const { send, answers } = controlledSend();
    const { scan } = renderPanel({ send });
    await scan("ESEVT1Y6D4S");

    await act(async () => answers[0](ok("ESEVT1Y6D4S")));

    const row = within(rows()[0]);
    // Left.
    expect(row.getByText("Priya Shah")).toBeInTheDocument();
    expect(row.getByText("ESEVT1Y6D4S")).toBeInTheDocument();
    expect(row.getByText("Fri 4 Dec · Day 2 of 3")).toBeInTheDocument();
    // Middle.
    expect(row.getByText("Checked in")).toBeInTheDocument();
    expect(
      row.getByText("Let them in. Next person, please."),
    ).toBeInTheDocument();
    // Right: the time the API gave, in the event's zone.
    expect(row.getByText("Checked in at")).toBeInTheDocument();
    expect(row.getByText("09:41")).toBeInTheDocument();
    expect(row.getByText("Fri 4 Dec 2026")).toBeInTheDocument();
  });

  it("shows the typed code big, and no time, when the API named nobody", async () => {
    const { send, answers } = controlledSend();
    const { scan } = renderPanel({ send });
    await scan("NOPE");

    await act(async () =>
      answers[0]({
        ok: false,
        status: 404,
        code: "NOT_FOUND",
        message: "Ticket not found",
      }),
    );

    const row = within(rows()[0]);
    expect(row.getByText("Ticket code")).toBeInTheDocument();
    expect(row.getByText("NOPE")).toBeInTheDocument();
    expect(row.queryByText(/checked in$/i)).toBeNull();
    expect(row.queryByText(/^\d{2}:\d{2}$/)).toBeNull();
  });

  it("names who is already checked in, since when, and for which day", async () => {
    const { send, answers } = controlledSend();
    const { scan } = renderPanel({ send });
    await scan("ESEVT1Y6D4S");

    await act(async () =>
      answers[0]({
        ok: false,
        status: 409,
        code: "ALREADY_CHECKED_IN",
        message: "Priya Shah is already checked in today",
        already: {
          attendee: {
            firstName: "Priya",
            lastName: "Shah",
            ticketCode: "ESEVT1Y6D4S",
          },
          checkedInAt: "2026-12-04T04:11:00.000Z",
        },
      }),
    );

    const row = within(rows()[0]);
    expect(row.getByText("Priya Shah")).toBeInTheDocument();
    expect(
      row.getByText("Already checked in for this day"),
    ).toBeInTheDocument();
    expect(row.getByText("Fri 4 Dec · Day 2 of 3")).toBeInTheDocument();
    expect(row.getByText("First checked in at")).toBeInTheDocument();
    expect(row.getByText("09:41")).toBeInTheDocument();
  });

  it("does not add a code twice while it is still being checked, and says why", async () => {
    const { send } = controlledSend();
    const { scan } = renderPanel({ send });

    await scan("AAA");
    await scan("aaa");

    expect(rows()).toHaveLength(1);
    expect(
      screen.getByText("AAA is already being checked. Its answer is below."),
    ).toBeInTheDocument();
  });

  it("offers Try again on a code that was not checked (429), and sends it again", async () => {
    const { send, answers } = controlledSend();
    const { scan, user } = renderPanel({ send });
    await scan("ESEVTSLOW");
    await act(async () =>
      answers[0]({
        ok: false,
        status: 429,
        code: "RATE_LIMITED",
        message: "Too many requests",
      }),
    );

    await user.click(
      await screen.findByRole("button", { name: "Try ESEVTSLOW again" }),
    );

    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send).toHaveBeenLastCalledWith("ESEVTSLOW", DAY_2);
  });

  it("offers no Try again on a final answer (ticket not found)", async () => {
    const { send, answers } = controlledSend();
    const { scan } = renderPanel({ send });
    await scan("NOPE");

    await act(async () =>
      answers[0]({
        ok: false,
        status: 404,
        code: "NOT_FOUND",
        message: "Ticket not found",
      }),
    );

    expect(await screen.findByText("Ticket not found")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /again/ })).toBeNull();
    // A failed row names the code it was about.
    expect(within(rows()[0]).getByText("NOPE")).toBeInTheDocument();
  });

  it("links to the event door when the session door says they did not come through it", async () => {
    const { send, answers } = controlledSend();
    const { scan } = renderPanel({
      send,
      door: { open: true, context: { door: "session", place: "Hall B" } },
      eventDoorHref: "/organizer/events/e-1/attendees",
    });
    await scan("ESEVT4M2X8L");

    await act(async () =>
      answers[0]({
        ok: false,
        status: 409,
        code: "EVENT_CHECK_IN_REQUIRED",
        message: "Check in at the event door first",
      }),
    );

    expect(
      await screen.findByRole("link", { name: "Check in at the event door" }),
    ).toHaveAttribute("href", "/organizer/events/e-1/attendees");
  });
});

describe("CheckInPanel: a shut door", () => {
  it("has no form, says why, and keeps the earlier answers", async () => {
    const { send, answers } = controlledSend();
    const { scan, view, props } = renderPanel({ send });
    await scan("AAA");
    await act(async () => answers[0](ok("AAA")));
    await screen.findByText("Priya Shah");

    view.rerender(
      <CheckInPanel
        {...props}
        send={send}
        door={{
          open: false,
          title: "Check-in is closed",
          detail: "Every day of this event is over.",
        }}
      />,
    );

    expect(screen.queryByRole("textbox", { name: "Ticket code" })).toBeNull();
    expect(screen.getByText("Check-in is closed")).toBeInTheDocument();
    expect(screen.getByText("Check-in closed")).toBeInTheDocument();
    expect(screen.getByText("Priya Shah")).toBeInTheDocument();
  });
});

describe("CheckInPanel: closing answers", () => {
  afterEach(() => jest.useRealTimers());

  const notFound: CheckInOutcome = {
    ok: false,
    status: 404,
    code: "NOT_FOUND",
    message: "Ticket not found",
  };

  it("closes a row with its × and gives the focus back to the code box", async () => {
    const { send, answers } = controlledSend();
    const { scan, user, input } = renderPanel({ send });
    await scan("NOPE");
    await act(async () => answers[0](notFound));

    await user.click(
      await screen.findByRole("button", { name: "Close the answer for NOPE" }),
    );

    expect(screen.queryByText("Ticket not found")).toBeNull();
    expect(input()).toHaveFocus();
  });

  it("has no × on a code that is still being checked", async () => {
    const { send } = controlledSend();
    const { scan } = renderPanel({ send });
    await scan("AAA");

    expect(
      screen.queryByRole("button", { name: /Close the answer/ }),
    ).toBeNull();
  });

  it("closes a green row by itself after 6 seconds", async () => {
    jest.useFakeTimers();
    const { send, answers } = controlledSend();
    const { scan } = renderPanel({ send }, { fakeTimers: true });
    await scan("AAA");
    await act(async () => answers[0](ok("AAA")));
    expect(screen.getByText("Priya Shah")).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(5_900));
    expect(screen.getByText("Priya Shah")).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(200));
    expect(screen.queryByText("Priya Shah")).toBeNull();
  });

  it("keeps a red 'do not let them in' row until it is closed", async () => {
    jest.useFakeTimers();
    const { send, answers } = controlledSend();
    const { scan } = renderPanel({ send }, { fakeTimers: true });
    await scan("NOPE");
    await act(async () => answers[0](notFound));

    act(() => jest.advanceTimersByTime(60_000));

    expect(screen.getByText("Ticket not found")).toBeInTheDocument();
  });

  it("waits while the pointer is on the row, and starts again when it leaves", async () => {
    jest.useFakeTimers();
    const { send, answers } = controlledSend();
    const { scan, user } = renderPanel({ send }, { fakeTimers: true });
    await scan("AAA");
    await act(async () => answers[0](ok("AAA")));

    await user.hover(rows()[0]);
    act(() => jest.advanceTimersByTime(30_000));
    expect(screen.getByText("Priya Shah")).toBeInTheDocument();

    await user.unhover(rows()[0]);
    act(() => jest.advanceTimersByTime(6_100));
    expect(screen.queryByText("Priya Shah")).toBeNull();
  });

  it("keeps counting while more codes are scanned (a busy door still clears)", async () => {
    jest.useFakeTimers();
    const { send, answers } = controlledSend();
    const { scan } = renderPanel({ send }, { fakeTimers: true });
    await scan("AAA");
    await act(async () => answers[0](ok("AAA")));

    act(() => jest.advanceTimersByTime(4_000));
    // AAA's answer is still up; scanning BBB re-renders every row.
    expect(screen.getByText("AAA")).toBeInTheDocument();
    await scan("BBB");
    act(() => jest.advanceTimersByTime(2_100));

    // 6 s after AAA's answer it is gone: BBB's scan did not restart its timer.
    expect(screen.queryByText("AAA")).toBeNull();
    expect(screen.getByText(/BBB/)).toBeInTheDocument();
  });
});

describe("CheckInPanel: real answers (routes 6 and 11)", () => {
  it("is no longer marked Static and offers no sample codes", () => {
    renderPanel();

    expect(screen.queryByText("Static")).toBeNull();
    expect(screen.queryByText(/Sample answers/)).toBeNull();
  });
});
