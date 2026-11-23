/** @jest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import type {
  CheckInContext,
  CheckInOutcome,
} from "../../utils/check-in-result";
import { useCheckInQueue } from "../useCheckInQueue";

const DAY_2: CheckInContext = {
  door: "event",
  date: "2026-12-04",
  dayLabel: "Fri 4 Dec",
  dayOfLabel: "Day 2 of 3",
};
const DAY_3: CheckInContext = {
  door: "event",
  date: "2026-12-05",
  dayLabel: "Sat 5 Dec",
  dayOfLabel: "Day 3 of 3",
};

const OK = (code: string): CheckInOutcome => ({
  ok: true,
  attendee: { firstName: "Priya", lastName: "Shah", ticketCode: code },
  checkedInAt: "2026-12-04T04:11:00.000Z",
});
const RATE_LIMITED: CheckInOutcome = {
  ok: false,
  status: 429,
  code: "RATE_LIMITED",
  message: "Too many requests",
};

/** A `send` whose answers the test gives by hand, in any order. */
function controlledSend() {
  const calls: {
    code: string;
    context: CheckInContext;
    answer: (outcome: CheckInOutcome) => void;
    fail: () => void;
  }[] = [];
  const send = jest.fn(
    (code: string, context: CheckInContext) =>
      new Promise<CheckInOutcome>((resolve, reject) => {
        calls.push({
          code,
          context,
          answer: resolve,
          fail: () => reject(new Error("network")),
        });
      }),
  );
  return { send, calls };
}

function setup() {
  const { send, calls } = controlledSend();
  const hook = renderHook(() => useCheckInQueue(send));
  return { send, calls, hook };
}

const states = (hook: ReturnType<typeof setup>["hook"]) =>
  hook.result.current.entries.map((entry) => [entry.code, entry.state]);

describe("useCheckInQueue", () => {
  it("never blocks: codes can be added while one is being checked, and wait their turn", async () => {
    const { send, hook } = setup();

    act(() => {
      hook.result.current.enqueue("AAA", DAY_2);
      hook.result.current.enqueue("BBB", DAY_2);
      hook.result.current.enqueue("CCC", DAY_2);
    });

    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    // Newest first on screen; only the oldest is out.
    expect(states(hook)).toEqual([
      ["CCC", "waiting"],
      ["BBB", "waiting"],
      ["AAA", "sending"],
    ]);
    expect(hook.result.current.pending).toBe(3);
  });

  it("sends ONE code at a time, oldest first, each only after the last one's answer", async () => {
    const { send, calls, hook } = setup();
    act(() => {
      hook.result.current.enqueue("AAA", DAY_2);
      hook.result.current.enqueue("BBB", DAY_2);
    });
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(calls[0].code).toBe("AAA");

    await act(async () => calls[0].answer(OK("AAA")));

    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(calls[1].code).toBe("BBB");
    expect(states(hook)).toEqual([
      ["BBB", "sending"],
      ["AAA", "done"],
    ]);
  });

  it("keeps each code's answer on its own row", async () => {
    const { calls, hook } = setup();
    act(() => {
      hook.result.current.enqueue("AAA", DAY_2);
    });
    await waitFor(() => expect(calls).toHaveLength(1));

    await act(async () => calls[0].answer(OK("AAA")));

    const [row] = hook.result.current.entries;
    expect(row.outcome).toEqual(OK("AAA"));
    expect(hook.result.current.pending).toBe(0);
  });

  it("sends the day picked when Enter was pressed, even if the day changes before its turn", async () => {
    const { calls, hook } = setup();
    act(() => {
      hook.result.current.enqueue("AAA", DAY_2);
      hook.result.current.enqueue("BBB", DAY_2);
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    await act(async () => calls[0].answer(OK("AAA")));
    await waitFor(() => expect(calls).toHaveLength(2));

    expect(calls[1].context).toEqual(DAY_2);
  });

  it("refuses a double Enter: the same code for the same day is not added twice", () => {
    const { hook } = setup();
    let first = "";
    let second = "";
    act(() => {
      first = hook.result.current.enqueue("AAA", DAY_2);
      second = hook.result.current.enqueue("AAA", DAY_2);
    });

    expect([first, second]).toEqual(["queued", "duplicate"]);
    expect(hook.result.current.entries).toHaveLength(1);
  });

  it("takes the same code for ANOTHER day, and again once its first answer came", async () => {
    const { calls, hook } = setup();
    let other = "";
    act(() => {
      hook.result.current.enqueue("AAA", DAY_2);
      other = hook.result.current.enqueue("AAA", DAY_3);
    });
    expect(other).toBe("queued");

    await waitFor(() => expect(calls).toHaveLength(1));
    await act(async () => calls[0].answer(OK("AAA")));
    let again = "";
    act(() => {
      again = hook.result.current.enqueue("AAA", DAY_2);
    });
    // The server will answer "already checked in": that answer must still be shown.
    expect(again).toBe("queued");
  });

  it("turns a thrown error into 'no answer' (status 0), never a lost row", async () => {
    const { calls, hook } = setup();
    act(() => {
      hook.result.current.enqueue("AAA", DAY_2);
    });
    await waitFor(() => expect(calls).toHaveLength(1));

    await act(async () => calls[0].fail());

    await waitFor(() =>
      expect(hook.result.current.entries[0].outcome).toMatchObject({
        ok: false,
        status: 0,
        code: null,
      }),
    );
  });

  it("a send that throws at once is 'no answer' too, and the line keeps moving", async () => {
    // Not a rejected promise: `send` itself throws before it returns one.
    const send = jest
      .fn<Promise<CheckInOutcome>, [string, CheckInContext]>()
      .mockImplementationOnce(() => {
        throw new Error("could not start");
      })
      .mockImplementation(async (code) => OK(code));
    const hook = renderHook(() => useCheckInQueue(send));

    act(() => {
      hook.result.current.enqueue("AAA", DAY_2);
      hook.result.current.enqueue("BBB", DAY_2);
    });

    // Without the cleanup, the line would be stuck on AAA and BBB would never go out.
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(hook.result.current.pending).toBe(0));
    const byCode = Object.fromEntries(
      hook.result.current.entries.map((entry) => [entry.code, entry.outcome]),
    );
    expect(byCode.AAA).toMatchObject({ ok: false, status: 0, code: null });
    expect(byCode.BBB).toMatchObject({ ok: true });
  });

  it("retry sends a finished code again, at the BACK of the line", async () => {
    const { send, calls, hook } = setup();
    act(() => {
      hook.result.current.enqueue("AAA", DAY_2);
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    await act(async () => calls[0].answer(RATE_LIMITED));

    act(() => {
      hook.result.current.enqueue("BBB", DAY_2);
    });
    await waitFor(() => expect(calls).toHaveLength(2));
    const aaa = hook.result.current.entries.find((row) => row.code === "AAA")!;
    act(() => hook.result.current.retry(aaa.id));
    // BBB is still out: AAA waits.
    expect(send).toHaveBeenCalledTimes(2);

    await act(async () => calls[1].answer(OK("BBB")));

    await waitFor(() => expect(calls).toHaveLength(3));
    expect(calls[2]).toMatchObject({ code: "AAA", context: DAY_2 });
    // The row stays where it was on screen, now being checked again.
    expect(states(hook)).toEqual([
      ["BBB", "done"],
      ["AAA", "sending"],
    ]);
  });

  it("does not retry a row that is still waiting or being sent", async () => {
    const { send, calls, hook } = setup();
    act(() => {
      hook.result.current.enqueue("AAA", DAY_2);
    });
    await waitFor(() => expect(calls).toHaveLength(1));

    act(() => hook.result.current.retry(hook.result.current.entries[0].id));

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("keeps the newest 20 answers on screen", async () => {
    const send = jest.fn(async (code: string) => OK(code));
    const hook = renderHook(() => useCheckInQueue(send));

    for (let n = 1; n <= 22; n += 1) {
      act(() => {
        hook.result.current.enqueue(`CODE${n}`, DAY_2);
      });
    }

    await waitFor(() => expect(hook.result.current.pending).toBe(0));
    const codes = hook.result.current.entries.map((row) => row.code);
    expect(codes).toHaveLength(20);
    expect(codes[0]).toBe("CODE22");
    expect(codes).not.toContain("CODE1");
    expect(codes).not.toContain("CODE2");
  });
});
