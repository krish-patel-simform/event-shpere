"use client";

import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { CheckInContext, CheckInOutcome } from "../utils/check-in-result";

/** One scanned code and what happened to it. */
export type CheckInEntry = {
  id: number;
  code: string;
  /** The door and day picked when Enter was pressed: a later day change does not move it. */
  context: CheckInContext;
  state: "waiting" | "sending" | "done";
  outcome: CheckInOutcome | null;
};

/** What happens to a code handed to `enqueue`. */
export type EnqueueResult = "queued" | "duplicate";

type Send = (code: string, context: CheckInContext) => Promise<CheckInOutcome>;

/** How many finished rows stay on screen; older ones drop off. */
const KEEP_DONE = 20;

/** The answer when `send` throws: nothing came back, so the code was not checked. */
const NO_ANSWER: CheckInOutcome = {
  ok: false,
  status: 0,
  code: null,
  message: "No answer from the server",
};

/**
 * The door's line of codes. Every code is AWAITED (its row ends with the server's answer, never
 * dropped) but the screen is NOT blocked: the staff keep typing and pressing Enter while earlier
 * codes are on their way. Codes go out ONE AT A TIME, oldest first, so two Enters never race each
 * other and a burst does not trip the rate limit at once. A code that is already waiting or
 * being sent for the same door and day is not added twice (a double Enter). A row that could not
 * be checked (no answer, 429) can be sent again with `retry`; it goes to the back of the line.
 */
export function useCheckInQueue(send: Send) {
  const [entries, setEntries] = useState<CheckInEntry[]>([]);
  // The line lives outside React (made once): React only holds the rows it shows.
  const [line] = useState(() => createCheckInLine(setEntries, send));
  // The latest `send`, so a re-render never restarts or drops the line.
  useEffect(() => line.setSend(send), [line, send]);

  /** Sends a finished row's code again (same door and day), at the back of the line. */
  const retry = useCallback(
    (id: number) => {
      const entry = entries.find(
        (item) => item.id === id && item.state === "done",
      );
      if (entry) line.retry(entry);
    },
    [entries, line],
  );

  /**
   * Takes a FINISHED row off the screen (its × or its auto-close). A row still waiting or being
   * sent cannot be closed: its answer has not come yet.
   */
  const dismiss = useCallback((id: number) => {
    setEntries((all) =>
      all.filter((entry) => !(entry.id === id && entry.state === "done")),
    );
  }, []);

  return {
    /** Newest scan first. */
    entries: [...entries].sort((a, b) => b.id - a.id),
    enqueue: line.enqueue,
    retry,
    dismiss,
    /** How many codes are still waiting or being sent. */
    pending: entries.filter((entry) => entry.state !== "done").length,
  };
}

/**
 * The line itself: the codes waiting their turn (oldest first), whether a request is out, and
 * which codes are unfinished (to refuse a double Enter, checked here rather than in React state,
 * so two Enters in the same tick both see the first). `pump` starts the next code unless one is
 * out, and runs again when each answer comes, so exactly one request is out while codes wait.
 */
export function createCheckInLine(
  setEntries: Dispatch<SetStateAction<CheckInEntry[]>>,
  initialSend: Send,
) {
  let send = initialSend;
  let nextId = 1;
  let inFlight = false;
  const waiting: Pick<CheckInEntry, "id" | "code" | "context">[] = [];
  const unfinished = new Set<string>();

  // Everything up to the first `await` runs at once, so a code goes out on the same tick it is
  // added. Callers start it with `void`: nothing waits for it, and it never rejects (the send
  // is caught, and the cleanup below always runs).
  async function pump(): Promise<void> {
    if (inFlight) return;
    const next = waiting.shift();
    if (!next) return;

    inFlight = true;
    setEntries((all) => update(all, next.id, { state: "sending" }));

    // A send that throws (or fails to start) is "no answer", never a stuck line.
    let outcome = NO_ANSWER;
    try {
      outcome = await send(next.code, next.context);
    } catch {
      // keeps NO_ANSWER
    }

    try {
      setEntries((all) =>
        trimDone(update(all, next.id, { state: "done", outcome })),
      );
    } finally {
      // Whatever happened above, free the line and move on to the next code: if this were
      // skipped, `inFlight` would stay true and the door would stop checking people in.
      unfinished.delete(queueKey(next.code, next.context));
      inFlight = false;
      void pump();
    }
  }

  return {
    setSend(latest: Send) {
      send = latest;
    },

    enqueue(code: string, context: CheckInContext): EnqueueResult {
      const key = queueKey(code, context);
      if (unfinished.has(key)) return "duplicate";
      unfinished.add(key);

      const ticket = { id: nextId++, code, context };
      waiting.push(ticket);
      setEntries((all) => [
        ...all,
        { ...ticket, state: "waiting", outcome: null },
      ]);
      void pump();
      return "queued";
    },

    retry(entry: Pick<CheckInEntry, "id" | "code" | "context">) {
      const key = queueKey(entry.code, entry.context);
      // The same code was scanned again meanwhile and is already in the line.
      if (unfinished.has(key)) return;
      unfinished.add(key);

      waiting.push({ id: entry.id, code: entry.code, context: entry.context });
      setEntries((all) =>
        update(all, entry.id, { state: "waiting", outcome: null }),
      );
      void pump();
    },
  };
}

function update(
  all: CheckInEntry[],
  id: number,
  change: Partial<Pick<CheckInEntry, "state" | "outcome">>,
): CheckInEntry[] {
  return all.map((entry) =>
    entry.id === id ? { ...entry, ...change } : entry,
  );
}

/** The same code at the same door (and, at the event door, for the same day). */
function queueKey(code: string, context: CheckInContext): string {
  return context.door === "event"
    ? `${code}|event|${context.date}`
    : `${code}|session`;
}

/** Keeps every unfinished row and the newest KEEP_DONE finished ones. */
function trimDone(all: CheckInEntry[]): CheckInEntry[] {
  const done = all.filter((entry) => entry.state === "done");
  if (done.length <= KEEP_DONE) return all;
  const dropped = new Set(
    done
      .sort((a, b) => a.id - b.id)
      .slice(0, done.length - KEEP_DONE)
      .map((entry) => entry.id),
  );
  return all.filter((entry) => !dropped.has(entry.id));
}
