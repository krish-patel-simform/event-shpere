"use client";

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Badge, cn, Tabs, tabId, type AlertTone } from "@/src/core/ui";
import {
  blockBox,
  boardHeight,
  boardHours,
  dayToOpen,
  describeClash,
  dropTarget,
  findMoveClash,
  HOUR_PX,
  moveSession,
  sessionsInHall,
  slotLabel,
  type BoardDay,
  type BoardFrame,
  type BoardHall,
  type BoardSession,
  type DayHover,
  type DropZone,
  type MoveClash,
} from "../utils/schedule-board";
import {
  CANCELLED_STYLE,
  DraggableSessionBlock,
  SessionBlockView,
  TYPE_STYLES,
} from "./ScheduleSessionBlock";

const PANEL_ID = "schedule-board";

/** How long a dragged block is held over a day before that day opens. */
const OPEN_DAY_AFTER_MS = 600;

const IDLE_HINT =
  "Click a session to edit it. Drag it by its grip to another hall or time; hold it over a day to open that day.";
const DRAG_HINT =
  "Drop on a hall's column to set the time. Hold over a day, or the arrows, to open that day.";

const hallDropId = (hallId: string) => `hall:${hallId}`;
const dayDropId = (day: number) => `day:${day}`;
const stepDropId = (by: -1 | 1) => `step:${by}`;

/** What a drop target's id says it opens, when it opens a day. */
function hoverFromId(id: string | null): DayHover | null {
  if (id?.startsWith("day:")) return { kind: "day", day: Number(id.slice(4)) };
  if (id?.startsWith("step:")) {
    return { kind: "step", by: id === stepDropId(-1) ? -1 : 1 };
  }
  return null;
}

/** What dropping the dragged session now would do. */
type Preview = { moved: BoardSession; clash: MoveClash | null };
type Notice = { tone: AlertTone; text: string };
/** A move the server has not answered yet: the session where it was, and where it is going. */
type PendingMove = { from: BoardSession; to: BoardSession };

function samePreview(a: Preview, b: Preview): boolean {
  return (
    a.moved.hallId === b.moved.hallId &&
    a.moved.day === b.moved.day &&
    a.moved.startMinute === b.moved.startMinute &&
    a.clash?.kind === b.clash?.kind &&
    a.clash?.with.id === b.clash?.with.id
  );
}

function sameSlot(a: BoardSession, b: BoardSession): boolean {
  return (
    a.hallId === b.hallId && a.day === b.day && a.startMinute === b.startMinute
  );
}

/** Why a move was not saved: the server's own words when it gave them. */
function failureText(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Something went wrong. Please try again.";
}

function Legend() {
  const items: { label: string; style: string }[] = [
    { label: "Keynote", style: TYPE_STYLES.keynote },
    { label: "Talk", style: TYPE_STYLES.talk },
    { label: "Workshop", style: TYPE_STYLES.workshop },
    { label: "Panel", style: TYPE_STYLES.panel },
    { label: "Cancelled", style: CANCELLED_STYLE },
  ];
  return (
    <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-sm">
          <span
            aria-hidden="true"
            className={cn("size-3 rounded-xs border", item.style)}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** A bar that fills along the bottom while a day is about to open, so the wait is visible. */
function OpeningBar({ filling }: { filling: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute bottom-0 left-0 h-0.5 bg-success",
        filling
          ? "w-full transition-[width] duration-600 ease-linear motion-reduce:transition-none"
          : "w-0",
      )}
    />
  );
}

/**
 * A day's tab, which a dragged block can be dropped on (it moves to that day, keeping its hall and
 * time) or held over (that day opens, and the block can then be placed on it).
 */
function DayDropTarget({
  day,
  shownDay,
  preview,
  children,
}: {
  day: number;
  shownDay: number;
  preview: Preview | null;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayDropId(day) });
  return (
    <div
      ref={setNodeRef}
      role="presentation"
      className={cn(
        "relative shrink-0 rounded-t-md",
        isOver && (preview?.clash ? "bg-danger-soft" : "bg-success-soft"),
      )}
    >
      {children}
      <OpeningBar filling={isOver && day !== shownDay} />
    </div>
  );
}

/**
 * Goes to the previous or the next day by a click, and while a block is held over it opens the
 * day again and again: the way across an event with many days.
 */
function DayStepButton({
  by,
  shownDay,
  dayCount,
  onOpen,
}: {
  by: -1 | 1;
  shownDay: number;
  dayCount: number;
  onOpen: (day: number) => void;
}) {
  const target = shownDay + by;
  const available = target >= 0 && target < dayCount;
  const { setNodeRef, isOver } = useDroppable({
    id: stepDropId(by),
    disabled: !available,
  });
  const Icon = by < 0 ? ChevronLeft : ChevronRight;

  return (
    <button
      ref={setNodeRef}
      type="button"
      disabled={!available}
      onClick={() => onOpen(target)}
      aria-label={by < 0 ? "Previous day" : "Next day"}
      className={cn(
        "relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-md border border-line",
        available ? "hover:bg-surface-subtle" : "opacity-40",
        isOver && available && "border-success bg-success-soft",
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      <OpeningBar filling={isOver && available} />
    </button>
  );
}

/**
 * One hall's column of the day: a drop target (unless the hall is inactive), with the blocks and
 * the slot a drop would take.
 */
function HallColumn({
  hall,
  dayLabel,
  blocks,
  frame,
  preview,
  pendingIds,
  editHref,
}: {
  hall: BoardHall;
  dayLabel: string;
  blocks: BoardSession[];
  frame: BoardFrame;
  preview: Preview | null;
  /** The sessions whose move is being saved. */
  pendingIds: ReadonlySet<string>;
  editHref: (sessionId: string) => string;
}) {
  const { setNodeRef } = useDroppable({
    id: hallDropId(hall.id),
    disabled: !hall.active,
  });
  const ghost =
    preview && preview.moved.hallId === hall.id
      ? blockBox(preview.moved.startMinute, preview.moved.endMinute, frame)
      : null;

  return (
    <ul
      ref={setNodeRef}
      aria-label={`${hall.name}, ${dayLabel}`}
      className={cn(
        "relative border-l border-line",
        !hall.active && "bg-surface-subtle/60",
      )}
      style={{
        height: boardHeight(frame),
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, var(--line) ${HOUR_PX - 1}px, var(--line) ${HOUR_PX}px)`,
      }}
    >
      {blocks.map((session) => (
        <DraggableSessionBlock
          key={session.id}
          session={session}
          frame={frame}
          pending={pendingIds.has(session.id)}
          editHref={editHref(session.id)}
        />
      ))}
      {preview && ghost && (
        <li
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-1 overflow-hidden rounded-md border-2 border-dashed",
            preview.clash
              ? "border-danger bg-danger-soft/80 text-danger"
              : "border-success bg-success-soft/80 text-success",
          )}
          style={{ top: ghost.top, height: Math.max(ghost.height - 2, 0) }}
        >
          <p className="truncate px-2 py-0.5 text-sm font-semibold">
            {slotLabel(preview.moved)}
            {preview.clash && " · busy"}
          </p>
        </li>
      )}
    </ul>
  );
}

const CHIP_TONES = {
  success: "border-success/40 bg-success-soft text-success",
  error: "border-danger/40 bg-danger-soft text-danger",
  neutral: "border-line bg-surface text-muted",
};

/** Above the moving block: where it would land, or why it can't. Seen right where the eye is. */
function DropChip({
  tone,
  title,
  detail,
}: {
  tone: keyof typeof CHIP_TONES;
  title: string;
  detail?: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute bottom-full left-0 mb-1.5 w-max max-w-72 rounded-md border px-2.5 py-1.5 text-xs shadow-md",
        CHIP_TONES[tone],
      )}
    >
      <p className="font-semibold">{title}</p>
      {detail && <p>{detail}</p>}
    </div>
  );
}

/**
 * The day tabs and the board: one column per hall, a block per session. A block moves by its
 * grip: onto another hall's column, to another time (snapped to 15 minutes), or onto another
 * day. Held over a day's tab, or over the previous/next arrows, it opens that day so it can be
 * placed there. While it moves, the block shows its new time and a chip says where it would land
 * (red, with the reason, when the hall or a speaker is busy); a drop on a busy slot is not sent.
 *
 * The sessions and the save are the parent's: a drop that looks free calls `onMove`, the board
 * waits for it (nothing can be dragged meanwhile) and then says it worked, or shows why the server
 * refused. The parent shows the move at once and takes it back when it is refused.
 */
export function ScheduleBoard({
  days,
  halls,
  sessions,
  frame,
  onMove,
  editHref,
}: {
  days: readonly BoardDay[];
  halls: readonly BoardHall[];
  sessions: readonly BoardSession[];
  frame: BoardFrame;
  /** Saves the move; rejects with an Error whose message is shown when it is refused. */
  onMove: (moved: BoardSession) => Promise<void>;
  /** Where a session is edited: clicking a block goes there. */
  editHref: (sessionId: string) => string;
}) {
  const [dayIndex, setDayIndex] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [hover, setHover] = useState<DayHover | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  // The moves the server has not answered yet, by session: each is drawn at its new place, marked
  // as saving, until it has been saved (or is put back where it came from). Any number can be
  // saving at once; other sessions stay free to be moved meanwhile.
  const [pending, setPending] = useState<ReadonlyMap<string, PendingMove>>(
    new Map(),
  );
  const saving = pending.size > 0;
  const pendingIds = new Set(pending.keys());

  // A move that is still being saved holds two places: where it is going, and where it came from
  // (it goes back there if the server refuses). A new move may take neither, so the board and the
  // database stay the same whichever way the save ends.
  const holders: BoardSession[] = [
    ...sessions.filter((session) => !pending.has(session.id)),
    ...[...pending.values()].flatMap((move) => [move.from, move.to]),
  ];
  /** Why a slot is refused, with a note when the session in the way is still being saved. */
  const clashText = (clash: MoveClash, moved: BoardSession) =>
    `${describeClash(clash, moved, halls)}${pending.has(clash.with.id) ? " That session is still being saved." : ""}`;

  // A finger needs a short press to start a drag, so it can still scroll the board.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
  );

  const day = days[dayIndex] ?? days[0];
  const active = sessions.find((session) => session.id === activeId);
  const placedToday = halls.some(
    (hall) => sessionsInHall(sessions, day.index, hall.id).length > 0,
  );

  // Holding a block over a day (or an arrow) opens that day after a moment. Opening it changes
  // the shown day, which runs this again: held over an arrow, the days go by one after another.
  useEffect(() => {
    const next = dayToOpen(hover, dayIndex, days.length);
    if (next === null) return;
    const timer = setTimeout(() => setDayIndex(next), OPEN_DAY_AFTER_MS);
    return () => clearTimeout(timer);
  }, [hover, dayIndex, days.length]);

  // With many days the tabs scroll sideways: keep the open day in view (not on first render, so
  // the page does not jump when it loads).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document
      .getElementById(tabId(PANEL_ID, String(dayIndex)))
      ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [dayIndex]);

  /** What a drop here would do, or null when the block is not over a hall or a day. */
  function previewFor({
    active,
    over,
  }: Pick<DragMoveEvent, "active" | "over">): Preview | null {
    const session = sessions.find((item) => item.id === active.id);
    const blockTop = active.rect.current.translated?.top;
    if (!session || !over || blockTop === undefined) return null;

    const overId = String(over.id);
    let zone: DropZone;
    if (overId.startsWith("hall:")) {
      zone = { kind: "hall", hallId: overId.slice(5), top: over.rect.top };
    } else if (overId.startsWith("day:")) {
      zone = { kind: "day", day: Number(overId.slice(4)) };
    } else {
      return null;
    }

    const moved = moveSession(
      session,
      dropTarget(session, zone, day.index, blockTop, frame),
      frame,
    );
    return { moved, clash: findMoveClash(holders, moved) };
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    setNotice(null);
  }

  function onDragOver({ over }: DragOverEvent) {
    setHover(hoverFromId(over ? String(over.id) : null));
  }

  function onDragMove(event: DragMoveEvent) {
    const next = previewFor(event);
    setPreview((current) =>
      current && next && samePreview(current, next) ? current : next,
    );
  }

  function endDrag() {
    setActiveId(null);
    setPreview(null);
    setHover(null);
  }

  async function save(from: BoardSession, moved: BoardSession) {
    const hall = halls.find((item) => item.id === moved.hallId);
    setPending((current) =>
      new Map(current).set(moved.id, { from, to: moved }),
    );
    setNotice(null);
    try {
      await onMove(moved);
      setNotice({
        tone: "success",
        text: `Moved "${moved.title}" to ${hall?.name ?? "a hall"}, ${days[moved.day]?.label ?? ""}, ${slotLabel(moved)}.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: `Not moved. ${failureText(error)}`,
      });
    } finally {
      setPending((current) => {
        const rest = new Map(current);
        rest.delete(moved.id);
        return rest;
      });
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const next = previewFor(event);
    const before = sessions.find((session) => session.id === event.active.id);
    endDrag();
    if (!next || !before || sameSlot(before, next.moved)) return;

    // A slot that is plainly busy is not even sent: the server would only say the same.
    if (next.clash) {
      setNotice({
        tone: "error",
        text: `Not moved. ${clashText(next.clash, next.moved)}`,
      });
      return;
    }
    void save(before, next.moved);
  }

  const hours = boardHours(frame);
  const columns = `3.5rem repeat(${halls.length}, minmax(10rem, 1fr))`;
  const hallOf = (hallId: string) => halls.find((hall) => hall.id === hallId);

  // The block in the overlay shows the time it would take, and the chip says where.
  const moving = preview?.moved ?? active ?? null;
  const chip = preview
    ? {
        tone: preview.clash ? ("error" as const) : ("success" as const),
        title: `${hallOf(preview.moved.hallId)?.name ?? "Hall"} · ${days[preview.moved.day]?.label ?? ""} · ${slotLabel(preview.moved)}`,
        detail: preview.clash
          ? clashText(preview.clash, preview.moved)
          : undefined,
      }
    : { tone: "neutral" as const, title: "Move over a hall or a day" };

  // While a block is held, the hint for dropping it; else the last result (a refusal must show even
  // while another move is being saved), else that a save is running, else the tip.
  const message: Notice = activeId
    ? { tone: "info", text: DRAG_HINT }
    : (notice ??
      (saving
        ? {
            tone: "info",
            text:
              pending.size > 1
                ? `Saving ${pending.size} moves…`
                : "Saving the move…",
          }
        : { tone: "info", text: IDLE_HINT }));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={endDrag}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {days.length > 1 && (
            <DayStepButton
              by={-1}
              shownDay={day.index}
              dayCount={days.length}
              onOpen={setDayIndex}
            />
          )}
          <div className="min-w-0 flex-1">
            <Tabs
              label="Event day"
              tabs={days.map((item) => ({
                key: String(item.index),
                label: item.label,
              }))}
              value={String(day.index)}
              onChange={(key) => setDayIndex(Number(key))}
              panelId={PANEL_ID}
              wrapTab={(tab, button) => (
                <DayDropTarget
                  day={Number(tab.key)}
                  shownDay={day.index}
                  preview={preview}
                >
                  {button}
                </DayDropTarget>
              )}
            />
          </div>
          {days.length > 1 && (
            <DayStepButton
              by={1}
              shownDay={day.index}
              dayCount={days.length}
              onOpen={setDayIndex}
            />
          )}
        </div>
        <Legend />
        <div
          id={PANEL_ID}
          role="tabpanel"
          aria-labelledby={`${PANEL_ID}-tab-${day.index}`}
          className="space-y-3"
        >
          {/* A fixed height, so a message appearing never moves the board while it is dragged. */}
          <Alert
            tone={message.tone}
            className="h-16 items-center overflow-hidden"
          >
            <span className="line-clamp-2">{message.text}</span>
          </Alert>
          <div
            // The board is wider than a phone: it scrolls sideways, and a keyboard user can focus it.
            tabIndex={0}
            role="region"
            aria-label={`Schedule board, ${day.label}`}
            className="overflow-x-auto rounded-md border border-line"
          >
            <div className="min-w-176">
              <div
                className="grid border-b border-line bg-surface-subtle"
                style={{ gridTemplateColumns: columns }}
              >
                <div />
                {halls.map((hall) => (
                  <div key={hall.id} className="px-3 py-2">
                    <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold">
                      {hall.name}
                      {!hall.active && <Badge tone="neutral">Inactive</Badge>}
                    </p>
                    <p className="text-xs text-muted">{hall.seats} seats</p>
                  </div>
                ))}
              </div>
              <div className="grid" style={{ gridTemplateColumns: columns }}>
                <ol
                  aria-hidden="true"
                  className="relative text-xs text-muted"
                  style={{ height: boardHeight(frame) }}
                >
                  {hours.map((hour, row) => (
                    <li
                      key={hour}
                      className={cn(
                        "absolute right-2",
                        row > 0 && "-translate-y-2",
                      )}
                      style={{ top: row * HOUR_PX }}
                    >
                      {hour}
                    </li>
                  ))}
                </ol>
                {halls.map((hall) => (
                  <HallColumn
                    key={hall.id}
                    hall={hall}
                    dayLabel={day.label}
                    blocks={sessionsInHall(sessions, day.index, hall.id)}
                    frame={frame}
                    preview={preview?.moved.day === day.index ? preview : null}
                    pendingIds={pendingIds}
                    editHref={editHref}
                  />
                ))}
              </div>
            </div>
          </div>
          {!placedToday && (
            <p className="text-sm text-muted">
              Nothing is placed on {day.label} yet.
            </p>
          )}
        </div>
      </div>

      {/* The moving copy follows the pointer above everything, so it is not clipped by the board. */}
      <DragOverlay dropAnimation={null}>
        {moving ? (
          <div className="relative h-full cursor-grabbing shadow-lg">
            <DropChip {...chip} />
            <SessionBlockView session={moving} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
