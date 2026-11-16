import { MapPin } from "lucide-react";
import Link from "next/link";
import { Card, DescriptionList, type DescriptionItem } from "@/src/core/ui";
import { formatTicketPrice, publicEventHref } from "../../events";
import type { PublicSessionDetailDto } from "../schemas/session-public.schemas";
import { PUBLIC_SESSION_MODE_LABELS } from "../utils/public-session-display";

/** "Details": the facts at a glance (hall, venue, seats, format, price) and a link to the venue. */
export function PublicSessionDetails({
  session,
}: {
  session: PublicSessionDetailDto;
}) {
  const { venue, event } = session;
  const items: DescriptionItem[] = [
    ...(session.hallName ? [{ label: "Hall", value: session.hallName }] : []),
    ...(venue
      ? [
          {
            label: "Venue",
            value: (
              <>
                {venue.name}
                <span className="block font-normal text-muted">
                  {venue.addressLine}, {venue.city}
                </span>
              </>
            ),
          },
        ]
      : []),
    ...(session.hallCapacity !== null
      ? [{ label: "Seats", value: String(session.hallCapacity) }]
      : []),
    { label: "Format", value: PUBLIC_SESSION_MODE_LABELS[session.mode] },
    {
      label: "Price",
      value:
        session.price > 0
          ? `+ ${formatTicketPrice(session.price)}`
          : "Included",
    },
  ];

  return (
    <Card title="Details">
      <DescriptionList items={items} labelWidth="sm" />
      {venue && (
        <Link
          href={`${publicEventHref(event.slug)}#venue`}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-link hover:underline"
        >
          <MapPin aria-hidden="true" className="size-4" />
          Venue directions
        </Link>
      )}
    </Card>
  );
}
