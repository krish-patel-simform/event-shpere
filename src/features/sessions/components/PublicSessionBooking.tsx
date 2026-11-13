import Link from "next/link";
import { Button, buttonStyles, Card, cn } from "@/src/core/ui";
import { formatTicketPrice, publicEventHref } from "../../events";
import type { PublicSessionDetailDto } from "../schemas/session-public.schemas";
import { seatsTakenPercent } from "../utils/public-session-display";

/**
 * "Book this session": what it costs, how many seats are left, and the booking button. Booking a
 * seat is not built yet, so the button is a disabled placeholder that says so; the price and the
 * seats are real.
 */
export function PublicSessionBooking({
  session,
}: {
  session: PublicSessionDetailDto;
}) {
  const { event, price, requiresRegistration, seatsLeft, hallCapacity } =
    session;
  const cancelled = event.status === "cancelled";
  const showSeats =
    requiresRegistration && seatsLeft !== null && hallCapacity !== null;
  const taken = showSeats ? seatsTakenPercent(hallCapacity, seatsLeft) : 0;

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

        {showSeats ? (
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
        ) : (
          <p className="text-sm font-medium">
            {requiresRegistration
              ? "Registration required"
              : "No separate registration"}
          </p>
        )}

        {cancelled ? (
          <p className="text-sm text-muted">
            This event was cancelled, so this session cannot be booked.
          </p>
        ) : requiresRegistration ? (
          <>
            <Button disabled className="w-full">
              Booking opens soon
            </Button>
            <p className="text-sm text-muted">
              You will book your seat here once you have registered for the
              event.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">
            No booking needed: come along with your event ticket.
          </p>
        )}

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
