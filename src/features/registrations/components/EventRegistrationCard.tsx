"use client";

import { CircleCheck, Lock } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { formatZonedDateTime } from "@/src/core/format/format-zoned";
import { Alert, Button, buttonStyles, Spinner } from "@/src/core/ui";
import { AUTH_ROUTES } from "@/src/features/auth";
import { SCHEDULE_ROUTES } from "@/src/features/schedule";
import { useCancelRegistration } from "../hooks/useCancelRegistration";
import { useGetMyRegistration } from "../hooks/useGetMyRegistration";
import { useRegisterForEvent } from "../hooks/useRegisterForEvent";
import { useRegistrationViewer } from "../hooks/useRegistrationViewer";
import {
  registrationCardState,
  registrationFailureMessage,
  type RegistrationCardEvent,
  type RegistrationCardState,
} from "../utils/registration-card-state";
import { CancelRegistrationDialog } from "./CancelRegistrationDialog";
import { CardStatus as Status } from "./CardStatus";
import { TicketDialog } from "./TicketDialog";

function sessionsBooked(count: number): string {
  return count === 1 ? "1 session booked" : `${count} sessions booked`;
}

/** "Register for free" switched off, with the reason under it. */
function DisabledRegister({ paid, note }: { paid: boolean; note: string }) {
  return (
    <>
      <Button fullWidth disabled>
        {paid ? "Register" : "Register for free"}
      </Button>
      <p className="text-sm text-muted">{note}</p>
    </>
  );
}

function TicketCode({ code }: { code: string }) {
  return (
    <p className="flex items-center justify-between gap-2 rounded-md bg-surface-subtle px-3 py-2 text-sm">
      <span className="text-muted">Ticket code</span>
      <span className="font-mono font-semibold tracking-wider">{code}</span>
    </p>
  );
}

/**
 * The registration part of an event page: register, see the ticket, cancel. It reads the user's
 * standing (route 2) when the page opens, and calls route 1 or 3 on a click. Every state of the
 * design's "Event registration card" board is one `kind` of `registrationCardState`; the server's
 * 409 codes override what the page worked out from its own (possibly stale) data.
 */
export function EventRegistrationCard({
  event,
  eventTitle,
}: {
  event: RegistrationCardEvent;
  eventTitle: string;
}) {
  const { viewer, retry: retryAccount } = useRegistrationViewer();
  const standing = useGetMyRegistration(event.id, {
    enabled: viewer === "attendee",
  });
  const register = useRegisterForEvent(event.id);
  const cancel = useCancelRegistration(event.id);
  const [dialog, setDialog] = useState<"ticket" | "cancel" | null>(null);

  const state = registrationCardState({
    event,
    viewer,
    standing: standing.data,
    standingFailed: standing.isError,
    registerError: register.error,
    cancelError: cancel.error,
    now: new Date(),
  });
  const failure = registrationFailureMessage(register.error);
  const zone = event.timezone;
  const at = (iso: string) => formatZonedDateTime(iso, zone);

  function startRegister() {
    // A new attempt starts clean: an old "cancel failed" must not decide the new state.
    cancel.reset();
    register.mutate();
  }

  function confirmCancel() {
    register.reset();
    cancel.mutate(undefined, {
      onSuccess: () => setDialog(null),
      onError: (error) => {
        // A 409 (checked in, closed) or 404 changes the card itself: close and show it there.
        if (error.status === 409 || error.status === 404) setDialog(null);
      },
    });
  }

  const registerButton = (label: string) => (
    <Button fullWidth onClick={startRegister} isPending={register.isPending}>
      {register.isPending ? "Registering…" : label}
    </Button>
  );

  function body(current: RegistrationCardState): ReactNode {
    switch (current.kind) {
      case "loading":
        return (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Spinner />
            Checking your registration…
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
          <Alert tone="error" title="We couldn't load your registration">
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
          <Status title="This event was cancelled">
            The organiser cancelled it. Registrations and session seats were
            cancelled too.
          </Status>
        );
      case "event_ended":
        return (
          <Status title="This event has ended">Ended {at(event.endAt)}.</Status>
        );
      case "signed_out":
        return (
          <>
            <Link
              href={AUTH_ROUTES.login}
              className={buttonStyles({ fullWidth: true })}
            >
              Sign in to register
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
          <Status title="You can't register with this account">
            Organizer and admin accounts manage events. Use a separate attendee
            account to attend.
          </Status>
        );
      case "registered": {
        const { registration } = current;
        const speaker = registration.reason === "complimentary_speaker";
        return (
          <>
            <Status
              title="You're registered"
              icon={
                <CircleCheck
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-success"
                />
              }
            >
              {speaker ? "Complimentary speaker ticket. " : ""}
              {sessionsBooked(current.bookedCount)} · registered{" "}
              {at(registration.registeredAt)}
            </Status>
            <TicketCode code={registration.ticketCode} />
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setDialog("ticket")}
            >
              View ticket
            </Button>
            {current.canCancel ? (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    cancel.reset();
                    setDialog("cancel");
                  }}
                  className="text-sm font-semibold text-danger hover:underline"
                >
                  Cancel registration
                </button>
                <p className="text-xs text-muted">
                  You can cancel until {at(current.cancelUntil)}.
                </p>
              </div>
            ) : (
              <p className="flex gap-2 text-sm text-muted">
                <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                Registration closed on {at(current.cancelUntil)}, so this ticket
                can no longer be cancelled. Contact the organiser if you cannot
                attend.
              </p>
            )}
          </>
        );
      }
      case "checked_in":
        return (
          <>
            <Status
              title="You're checked in"
              icon={
                <CircleCheck
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-success"
                />
              }
            >
              A ticket that has been used can no longer be cancelled.
            </Status>
            <TicketCode code={current.registration.ticketCode} />
            <Link
              href={SCHEDULE_ROUTES.mine}
              className={buttonStyles({
                variant: "secondary",
                fullWidth: true,
              })}
            >
              View my schedule
            </Link>
          </>
        );
      case "not_open":
        return (
          <>
            <Status title="Registration opens soon">
              {current.opensAt ? `Opens ${at(current.opensAt)}.` : null}
            </Status>
            <DisabledRegister
              paid={event.ticketPrice > 0}
              note="Come back when registration opens."
            />
          </>
        );
      case "closed":
        return (
          <>
            <Status title="Registration is closed">
              Closed {at(current.closedAt)}.
            </Status>
            <DisabledRegister
              paid={event.ticketPrice > 0}
              note="Contact the organiser if you still want to attend."
            />
          </>
        );
      case "paid_unavailable":
        return (
          <>
            <Status title="Paid tickets are not available yet">
              Only free events can be registered for right now.
            </Status>
            <DisabledRegister paid note="We will open paid tickets soon." />
          </>
        );
      case "full":
        return (
          <>
            <Status title="This event is full">All seats are taken.</Status>
            <DisabledRegister
              paid={event.ticketPrice > 0}
              note="If someone cancels, a seat may open up. Check back later."
            />
          </>
        );
      case "open":
        return (
          <>
            {current.cancelledBefore && (
              <Status title="You cancelled your registration">
                Your old ticket code no longer works.
              </Status>
            )}
            {registerButton(
              current.cancelledBefore
                ? "Register again"
                : current.paid
                  ? "Register"
                  : "Register for free",
            )}
            <p className="text-sm text-muted">
              {register.isPending
                ? "Please wait. Do not close this page."
                : current.cancelledBefore
                  ? "You will get a new ticket code. Your session seats are not restored."
                  : current.paid
                    ? "Paid tickets are not on sale yet. Speakers of this event can register for free."
                    : `Registration closes ${at(current.closesAt)}. Book sessions after you register.`}
            </p>
          </>
        );
    }
  }

  const registration = state.kind === "registered" ? state.registration : null;

  return (
    <div className="space-y-3">
      {failure && (
        <Alert tone="error" title="We couldn't complete that">
          {failure} Your registration was not changed.
        </Alert>
      )}
      {body(state)}

      {registration && (
        <>
          <TicketDialog
            open={dialog === "ticket"}
            onClose={() => setDialog(null)}
            eventTitle={eventTitle}
            ticketCode={registration.ticketCode}
          />
          <CancelRegistrationDialog
            open={dialog === "cancel"}
            onClose={() => setDialog(null)}
            onConfirm={confirmCancel}
            isPending={cancel.isPending}
            error={registrationFailureMessage(cancel.error)}
            eventTitle={eventTitle}
            ticketCode={registration.ticketCode}
            bookedCount={state.kind === "registered" ? state.bookedCount : 0}
          />
        </>
      )}
    </div>
  );
}
