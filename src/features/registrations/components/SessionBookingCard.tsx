"use client";

import { CircleCheck, Lock } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { formatZonedDateTime } from "@/src/core/format/format-zoned";
import { Alert, Button, buttonStyles, Spinner } from "@/src/core/ui";
import { AUTH_ROUTES } from "@/src/features/auth";
import { useBookSession } from "../hooks/useBookSession";
import { useCancelSessionBooking } from "../hooks/useCancelSessionBooking";
import { useGetMyRegistration } from "../hooks/useGetMyRegistration";
import { useRegistrationViewer } from "../hooks/useRegistrationViewer";
import {
  bookingFailureMessage,
  sessionBookingState,
  type SessionBookingEvent,
  type SessionBookingState,
  type SessionBookingTarget,
} from "../utils/session-booking-state";
import { CancelSeatDialog } from "./CancelSeatDialog";
import { CardStatus } from "./CardStatus";

/** "Book session" switched off, with the reason under it. */
function DisabledBook({ note }: { note?: string }) {
  return (
    <>
      <Button fullWidth disabled>
        Book session
      </Button>
      {note && <p className="text-sm text-muted">{note}</p>}
    </>
  );
}

const checkIcon = (
  <CircleCheck
    aria-hidden="true"
    className="mt-0.5 size-5 shrink-0 text-success"
  />
);

/**
 * The action part of "Book this session" on a session page: book a seat, see it, cancel it. It
 * reads the user's standing in the EVENT (route 2: `bookedSessionIds`), so the event page and this
 * page share one request; it calls route 8 or 9 on a click. Every state of the design's "Session
 * booking card" board is one `kind` of `sessionBookingState`; the server's 409 codes override
 * what the page worked out from its own (possibly stale) data.
 */
export function SessionBookingCard({
  session,
  sessionTitle,
  event,
  eventHref,
  mySessionsHref,
  when,
}: {
  session: SessionBookingTarget;
  sessionTitle: string;
  event: SessionBookingEvent;
  /** The event's public page: "Register for the event". */
  eventHref: string;
  /** A speaker's own sessions: "Open My sessions". */
  mySessionsHref: string;
  /** "Fri 4 Dec 2026 · 10:00 – 12:00 IST · Lab 3" for the cancel dialog; null = not scheduled. */
  when: string | null;
}) {
  const { viewer, retry: retryAccount } = useRegistrationViewer();
  const standing = useGetMyRegistration(event.id, {
    enabled: viewer === "attendee",
  });
  const book = useBookSession(event.id, session.id);
  const cancel = useCancelSessionBooking(event.id, session.id);
  const [confirming, setConfirming] = useState(false);

  const state = sessionBookingState({
    session,
    event,
    viewer,
    standing: standing.data,
    standingFailed: standing.isError,
    bookError: book.error,
    cancelError: cancel.error,
    now: new Date(),
  });
  const failure = bookingFailureMessage(book.error);
  const at = (iso: string) => formatZonedDateTime(iso, event.timezone);

  function startBooking() {
    // A new attempt starts clean: an old "cancel failed" must not decide the new state.
    cancel.reset();
    book.mutate();
  }

  function confirmCancel() {
    book.reset();
    cancel.mutate(undefined, {
      onSuccess: () => setConfirming(false),
      onError: (error) => {
        // A 409 (checked in, closed) or 404 changes the card itself: close and show it there.
        if (error.status === 409 || error.status === 404) setConfirming(false);
      },
    });
  }

  function body(current: SessionBookingState): ReactNode {
    switch (current.kind) {
      case "loading":
        return (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Spinner />
            Checking your booking…
          </p>
        );
      case "account_error":
        return (
          <Alert tone="error" title="We couldn't check your account">
            <Button variant="secondary" className="mt-2" onClick={retryAccount}>
              Try again
            </Button>
          </Alert>
        );
      case "standing_error":
        return (
          <Alert tone="error" title="We couldn't load your booking">
            {standing.error?.message}
            <Button
              variant="secondary"
              className="mt-2"
              onClick={() => void standing.refetch()}
            >
              Try again
            </Button>
          </Alert>
        );
      case "event_cancelled":
        return (
          <CardStatus title="This event was cancelled">
            Sessions cannot be booked. Any seat you held was cancelled.
          </CardStatus>
        );
      case "session_cancelled":
        return (
          <CardStatus title="This session was cancelled">
            The organiser removed it from the programme. Any seat you held was
            cancelled.
          </CardStatus>
        );
      case "no_booking_needed":
        return (
          <CardStatus title="No booking needed">
            Come along with your event ticket. Seats are not reserved for this
            session.
          </CardStatus>
        );
      case "signed_out":
        return (
          <>
            <Link
              href={AUTH_ROUTES.login}
              className={buttonStyles({ fullWidth: true })}
            >
              Sign in to book
            </Link>
            <p className="text-sm text-muted">
              New here?{" "}
              <Link
                href={AUTH_ROUTES.signup}
                className="font-semibold text-link hover:underline"
              >
                Create an account
              </Link>
              . It takes a minute.
            </p>
          </>
        );
      case "staff":
        return (
          <CardStatus title="You can't book with this account">
            Organizer and admin accounts manage events. Use a separate attendee
            account to attend.
          </CardStatus>
        );
      case "booked":
        return (
          <>
            <CardStatus title="Your seat is booked" icon={checkIcon}>
              Show your event ticket at the session door.
            </CardStatus>
            {current.canCancel ? (
              <div className="space-y-1">
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    cancel.reset();
                    setConfirming(true);
                  }}
                >
                  Cancel seat
                </Button>
                <p className="text-xs text-muted">
                  You can cancel until registration for the event closes on{" "}
                  {at(current.cancelUntil)}.
                </p>
              </div>
            ) : (
              <p className="flex gap-2 text-sm text-muted">
                <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                Registration for the event closed on {at(current.cancelUntil)},
                so seats can no longer be cancelled.
              </p>
            )}
          </>
        );
      case "checked_in":
        return (
          <CardStatus title="You're checked in" icon={checkIcon}>
            You attended this session. A used seat can no longer be cancelled.
          </CardStatus>
        );
      case "started":
        return (
          <>
            <CardStatus title="Booking is closed">
              This session has started. Booking stops at the start time.
            </CardStatus>
            <DisabledBook />
          </>
        );
      case "opens_soon":
        return (
          <>
            <CardStatus title="Booking opens soon">
              {current.reason === "time"
                ? "Seats open once the organiser sets the time."
                : "Seats open once the organiser assigns a hall."}
            </CardStatus>
            <DisabledBook />
          </>
        );
      case "register_first":
        return (
          <>
            <CardStatus title="Register for the event first">
              {current.cancelledBefore
                ? "Your event registration was cancelled. Register again to book sessions."
                : "Sessions are booked from your event registration."}
            </CardStatus>
            <Link
              href={eventHref}
              className={buttonStyles({ fullWidth: true })}
            >
              Register for the event
            </Link>
          </>
        );
      case "speaker":
        return (
          <>
            <CardStatus title="You're speaking at this session">
              Speakers of a session do not book a seat.
            </CardStatus>
            <Link
              href={mySessionsHref}
              className={buttonStyles({
                variant: "secondary",
                fullWidth: true,
              })}
            >
              Open My sessions
            </Link>
          </>
        );
      case "paid_unavailable":
        return (
          <>
            <CardStatus title="Paid sessions can't be booked yet">
              Only sessions included in the event ticket can be booked right
              now.
            </CardStatus>
            <DisabledBook />
          </>
        );
      case "full":
        return (
          <>
            <CardStatus title="This session is full">
              All seats are booked.
            </CardStatus>
            <DisabledBook note="A seat may open if someone cancels." />
          </>
        );
      case "open":
        return (
          <>
            <Button fullWidth onClick={startBooking} isPending={book.isPending}>
              {book.isPending ? "Booking…" : "Book session"}
            </Button>
            <p className="text-sm text-muted">
              {current.unlimited ? "Online session: no seat limit. " : ""}
              You can cancel until registration for the event closes on{" "}
              {at(current.cancelUntil)}.
            </p>
          </>
        );
    }
  }

  return (
    <div className="space-y-3">
      {failure && (
        <Alert tone="error" title="We couldn't complete that">
          {failure} Your booking was not changed.
        </Alert>
      )}
      {body(state)}
      {state.kind === "booked" && (
        <CancelSeatDialog
          open={confirming}
          onClose={() => setConfirming(false)}
          onConfirm={confirmCancel}
          isPending={cancel.isPending}
          error={bookingFailureMessage(cancel.error)}
          sessionTitle={sessionTitle}
          when={when}
        />
      )}
    </div>
  );
}
