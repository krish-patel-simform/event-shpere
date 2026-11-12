"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Card, cn } from "@/src/core/ui";
import { useSetHallsStatus } from "../hooks/useSetHallsStatus";
import type { VenueDetailDto } from "../schemas/venue.schemas";
import {
  pluralHalls,
  statusLabel,
  summarizeHalls,
} from "../utils/venue-display";
import { AddHallDialog } from "./AddHallDialog";
import { DeleteHallDialog, type HallRef } from "./DeleteHallDialog";

const ACTIVATE_VENUE_FIRST = "Activate the venue first";
const KEEP_ONE = "A venue must keep at least one hall";
const smallButton = "px-3 py-1.5";

/**
 * The halls of one venue: activate or deactivate halls (one row, or several ticked rows), add a
 * hall, delete a hall. The server enforces every rule; the buttons only avoid asking for what it
 * would refuse: no activating a hall of an inactive venue, no deleting the last hall.
 */
export function HallsCard({ venue }: { venue: VenueDetailDto }) {
  const { halls } = venue;
  const summary = summarizeHalls(halls);
  const setStatus = useSetHallsStatus(venue.id);

  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [deleting, setDeleting] = useState<HallRef | null>(null);

  // Leaving the page hides it (React <Activity>) instead of unmounting it, so an open dialog
  // would still be open when the admin comes back. Close them as the page is hidden.
  useLayoutEffect(
    () => () => {
      setIsAdding(false);
      setDeleting(null);
      setSelected(new Set());
    },
    [],
  );

  // A hall that was deleted can no longer be ticked.
  const selectedHalls = halls.filter((hall) => selected.has(hall.id));
  const selectedIds = selectedHalls.map((hall) => hall.id);
  const allSelected = halls.length > 0 && selectedHalls.length === halls.length;

  const selectAll = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAll.current) {
      selectAll.current.indeterminate =
        selectedHalls.length > 0 && !allSelected;
    }
  }, [selectedHalls.length, allSelected]);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  /** Activates (true) or deactivates (false) the given halls, then clears the ticks. */
  const setActive = (isActive: boolean, ids: string[]) =>
    setStatus.mutate(
      { isActive, halls: ids },
      { onSuccess: () => setSelected(new Set()) },
    );

  const venueInactive = !venue.isActive;
  const pendingIds = setStatus.isPending
    ? Array.isArray(setStatus.variables?.halls)
      ? setStatus.variables.halls
      : []
    : [];
  const inactiveCount = summary.hallCount - summary.hallsOn;

  return (
    <>
      <Card
        flush
        title="Halls"
        description={`${pluralHalls(summary.hallCount)} · ${summary.totalSeats} seats · ${summary.hallsOn} active, ${inactiveCount} inactive`}
        action={
          <Button
            onClick={() => setIsAdding(true)}
            disabled={venueInactive}
            title={
              venueInactive ? "Activate the venue to add a hall" : undefined
            }
            className={smallButton}
          >
            <Plus aria-hidden="true" className="size-4" />
            Add hall
          </Button>
        }
      >
        {setStatus.isError && (
          <div className="p-4">
            <Alert tone="error" title="We couldn't update those halls">
              {setStatus.error.message}
            </Alert>
          </div>
        )}

        {selectedHalls.length > 0 && (
          <div
            role="status"
            className="flex flex-wrap items-center gap-2.5 border-b border-line bg-brand-soft px-5 py-2.5 text-sm"
          >
            <span className="font-semibold">
              {selectedHalls.length} selected
            </span>
            <Button
              variant="secondary"
              className={smallButton}
              disabled={venueInactive || setStatus.isPending}
              title={venueInactive ? ACTIVATE_VENUE_FIRST : undefined}
              onClick={() => setActive(true, selectedIds)}
            >
              Activate selected
            </Button>
            <Button
              variant="secondary"
              className={smallButton}
              disabled={setStatus.isPending}
              onClick={() => setActive(false, selectedIds)}
            >
              Deactivate selected
            </Button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="font-semibold text-link hover:underline"
            >
              Clear selection
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="w-11 px-4 py-2.5">
                  <input
                    ref={selectAll}
                    type="checkbox"
                    aria-label="Select all halls"
                    checked={allSelected}
                    onChange={() =>
                      setSelected(
                        allSelected
                          ? new Set()
                          : new Set(halls.map((hall) => hall.id)),
                      )
                    }
                    className="size-4"
                  />
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Hall
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Seats
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Status
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 text-right font-semibold"
                >
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {halls.map((hall) => {
                const isSelected = selected.has(hall.id);
                // An inactive venue's halls can be deactivated, never activated.
                const cannotActivate = venueInactive && !hall.isActive;
                const action = hall.isActive ? "Deactivate" : "Activate";
                return (
                  <tr
                    key={hall.id}
                    className={cn(
                      "border-t border-line",
                      isSelected && "bg-brand-soft",
                    )}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${hall.name}`}
                        checked={isSelected}
                        onChange={() => toggle(hall.id)}
                        className="size-4"
                      />
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 font-semibold",
                        !hall.isActive && "text-muted",
                      )}
                    >
                      {hall.name}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3",
                        !hall.isActive && "text-muted",
                      )}
                    >
                      {hall.capacity}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={hall.isActive ? "success" : "neutral"}>
                        <span
                          aria-hidden="true"
                          className="size-1.5 rounded-full bg-current"
                        />
                        {statusLabel(hall.isActive)}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Button
                        variant="secondary"
                        className={smallButton}
                        disabled={setStatus.isPending || cannotActivate}
                        isPending={pendingIds.includes(hall.id)}
                        title={
                          cannotActivate ? ACTIVATE_VENUE_FIRST : undefined
                        }
                        onClick={() => setActive(!hall.isActive, [hall.id])}
                      >
                        <span className="sr-only">
                          {action} {hall.name}
                        </span>
                        <span aria-hidden="true">{action}</span>
                      </Button>{" "}
                      <button
                        type="button"
                        aria-label={`Delete ${hall.name}`}
                        disabled={halls.length === 1}
                        title={
                          halls.length === 1 ? KEEP_ONE : `Delete ${hall.name}`
                        }
                        onClick={() =>
                          setDeleting({ id: hall.id, name: hall.name })
                        }
                        className="inline-flex size-8 items-center justify-center rounded-md align-middle text-danger hover:bg-danger-soft disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent"
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-5 py-3 text-sm text-muted">
          An inactive hall cannot be given new sessions. A hall with sessions
          that are not over yet cannot be deactivated: move or cancel them
          first. A venue always keeps at least one hall, and a hall that has
          ever had sessions cannot be deleted.
        </p>
      </Card>

      <AddHallDialog
        venue={
          isAdding
            ? { id: venue.id, name: venue.name, hallCount: halls.length }
            : null
        }
        onClose={() => setIsAdding(false)}
      />
      <DeleteHallDialog
        venueId={venue.id}
        hall={deleting}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
