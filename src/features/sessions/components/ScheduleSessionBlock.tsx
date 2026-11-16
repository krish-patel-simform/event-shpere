"use client";

import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn, Spinner } from "@/src/core/ui";
import {
  blockBox,
  slotLabel,
  speakerNames,
  type BoardFrame,
  type BoardSession,
} from "../utils/schedule-board";

/**
 * How a block is coloured by what kind of session it holds: a thick bar in the type's own colour
 * on the left, a tinted background, and the normal text colour so it reads well on all of them.
 */
export const TYPE_STYLES: Record<BoardSession["type"], string> = {
  keynote:
    "border-l-4 border-session-keynote/40 border-l-session-keynote bg-session-keynote-soft text-foreground",
  talk: "border-l-4 border-session-talk/40 border-l-session-talk bg-session-talk-soft text-foreground",
  workshop:
    "border-l-4 border-session-workshop/40 border-l-session-workshop bg-session-workshop-soft text-foreground",
  panel:
    "border-l-4 border-session-panel/40 border-l-session-panel bg-session-panel-soft text-foreground",
};
export const CANCELLED_STYLE =
  "border-dashed border-line bg-surface text-muted";

/** What a session looks like on the board. It fills whatever box it is put in. */
export function SessionBlockView({
  session,
  handle,
  pending = false,
}: {
  session: BoardSession;
  handle?: ReactNode;
  /** The session is being saved at this place: dashed and dimmed, with a spinner, until it is. */
  pending?: boolean;
}) {
  const speakers = speakerNames(session);

  return (
    <div
      data-pending={pending || undefined}
      className={cn(
        "relative size-full overflow-hidden rounded-md border px-2 py-1 text-xs leading-snug",
        session.cancelled ? CANCELLED_STYLE : TYPE_STYLES[session.type],
        pending && "border-dashed opacity-80",
      )}
    >
      {pending ? (
        <Spinner className="absolute top-1.5 right-1.5 size-4" />
      ) : (
        handle
      )}
      <p
        className={cn(
          "truncate pr-6 text-sm font-semibold",
          session.cancelled && "line-through",
        )}
        title={session.title}
      >
        {session.title}
      </p>
      <p className="truncate">
        {pending && "Saving · "}
        {slotLabel(session)}
        {speakers && ` · ${speakers}`}
        {session.cancelled && " · Cancelled"}
      </p>
    </div>
  );
}

/**
 * One session, drawn where its time falls in its hall's column. It moves by its grip button (not
 * the whole block, so a finger can still scroll the board sideways). A session that can not be
 * moved (cancelled, over, or in a locked event) has no grip, and none while its own move is being
 * saved (other sessions stay free to be moved meanwhile).
 * While it is dragged the block stays as a faint mark where it was, and the board's drag overlay
 * shows the moving copy.
 */
export function DraggableSessionBlock({
  session,
  frame,
  pending,
  editHref,
}: {
  session: BoardSession;
  frame: BoardFrame;
  /** This session's own move is being saved: it shows as saving, with no grip or link. */
  pending: boolean;
  /** Where the session is edited: a click on the block goes there. */
  editHref: string;
}) {
  const canMove = session.movable && !pending;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } =
    useDraggable({ id: session.id, disabled: !canMove });
  const { top, height } = blockBox(
    session.startMinute,
    session.endMinute,
    frame,
  );

  return (
    <li
      ref={setNodeRef}
      aria-busy={pending || undefined}
      className={cn("absolute inset-x-1", isDragging && "opacity-40")}
      style={{ top, height: Math.max(height - 2, 0) }}
    >
      <SessionBlockView
        session={session}
        pending={pending}
        handle={
          session.movable && (
            <button
              ref={setActivatorNodeRef}
              type="button"
              aria-label={`Move ${session.title}`}
              {...attributes}
              {...listeners}
              className="absolute top-0.5 right-0.5 z-2 grid size-6 cursor-grab touch-none place-items-center rounded-sm hover:bg-foreground/10 active:cursor-grabbing disabled:cursor-wait disabled:opacity-50"
            >
              <GripVertical aria-hidden="true" className="size-4" />
            </button>
          )
        }
      />
      {/* A link over the whole block, under the grip: a click anywhere else opens the edit page.
          Not while the move is saved: the page would open on a session the server has not got yet. */}
      {!pending && (
        <Link
          href={editHref}
          aria-label={`Edit ${session.title}`}
          className="absolute inset-0 z-1 rounded-md hover:bg-foreground/5"
        />
      )}
    </li>
  );
}
