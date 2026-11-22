import Link from "next/link";
import { buttonStyles, Card, cn } from "@/src/core/ui";
import { SessionBookingCard } from "@/src/features/registrations";
import { formatTicketPrice, publicEventHref } from "../../events";
import { SESSION_ROUTES } from "../routes";
import type { PublicSessionDetailDto } from "../schemas/session-public.schemas";
import {
  seatsTakenPercent,
  sessionPlace,
  sessionWhen,
} from "../utils/public-session-display";

/** The seats line: a bar for a hall, "No seat limit" online, or what kind of session it is. */
function Seats({ session }: { session: PublicSessionDetailDto }) {
  const { requiresRegistration, seatsLeft, hallCapacity, mode } = session;

  if (requiresRegistration && seatsLeft !== null && hallCapacity !== null) {
    const taken = seatsTakenPercent(hallCapacity, seatsLeft);
    return (
      <div>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-semibold">Seats</span>
          <span className="text-muted">
            {seatsLeft === 0
              ? "Fully booked"
              : `${seatsLeft} of ${hallCapacity} left`}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Seats taken"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={taken}
          className="mt-2 h-2 overflow-hidden rounded-full bg-surface-subtle"
        >
          <div
            className={cn(
              "h-full rounded-full",
              taken >= 90 ? "bg-warning" : "bg-brand",
            )}
            style={{ width: `${taken}%` }}
          />
        </div>
      </div>
    );
  }
  return (
    <p className="text-sm font-medium">
      {!requiresRegistration
        ? "No separate registration"
        : mode === "online"
          ? "No seat limit"
          : "Registration required"}
    </p>
  );
}

/**
 * "Book this session": what it costs, how many seats are left, and the booking card (the
 * registrations feature), which knows whether the user holds a seat and every reason they can or
 * cannot book one.
 */
export function PublicSessionBooking({
  session,
}: {
  session: PublicSessionDetailDto;
}) {
  const { event, price } = session;
  const slot = sessionWhen(session);

  return (
    <Card title="Book this session">
      <div className="space-y-4">
        <div>
          <p className="text-2xl font-semibold">
            {price > 0 ? formatTicketPrice(price) : "Included"}
          </p>
          <p className="text-sm text-muted">
            {price > 0 ? "on top of the event ticket" : "in your event ticket"}
          </p>
        </div>

        <Seats session={session} />

        <SessionBookingCard
          session={session}
          sessionTitle={session.title}
          event={event}
          eventHref={publicEventHref(event.slug)}
          mySessionsHref={SESSION_ROUTES.list}
          when={
            slot
              ? `${slot.date} · ${slot.time} · ${sessionPlace(session)}`
              : null
          }
        />

        <Link
          href={publicEventHref(event.slug)}
          className={cn(buttonStyles({ variant: "secondary" }), "w-full")}
        >
          View the event
        </Link>
      </div>
    </Card>
  );
}
