import { Building2, Plus, Power, PowerOff } from "lucide-react";
import Link from "next/link";
import {
  ActionMenu,
  Badge,
  buttonStyles,
  ClickableRow,
  cn,
  type ActionMenuItem,
} from "@/src/core/ui";
import { adminVenueHref, VENUE_ROUTES } from "../routes";
import type { VenueListItemDto } from "../schemas/venue.schemas";
import {
  activeHallsLabel,
  pluralHalls,
  statusLabel,
} from "../utils/venue-display";

const TH = "px-4 py-2.5 font-semibold";

type VenuesTableProps = {
  venues: readonly VenueListItemDto[];
  /** A search is active, so an empty list means "no match", not "no venues yet". */
  isFiltered: boolean;
  onAddHall: (venue: VenueListItemDto) => void;
  onDeactivate: (venue: VenueListItemDto) => void;
  onActivate: (venue: VenueListItemDto) => void;
};

/** The venues of one page: name and address, city, hall counts, seats, time zone, status. */
export function VenuesTable({
  venues,
  isFiltered,
  onAddHall,
  onDeactivate,
  onActivate,
}: VenuesTableProps) {
  if (venues.length === 0) {
    return isFiltered ? (
      <p className="px-5 py-8 text-center text-muted">
        No venues match your search. Check the spelling, or search by city
        instead.
      </p>
    ) : (
      <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
        <Building2 aria-hidden="true" className="size-8 text-brand" />
        <p className="text-base font-semibold">No venues yet</p>
        <p className="max-w-sm text-muted">
          Add the first venue and its halls so organizers can place sessions.
        </p>
        <Link
          href={VENUE_ROUTES.new}
          className={buttonStyles({ variant: "primary" }) + " mt-2"}
        >
          Add venue
        </Link>
      </div>
    );
  }

  return (
    // Wide table: it scrolls inside the card on phones, not the whole page.
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-surface-subtle text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th scope="col" className={TH}>
              Venue
            </th>
            <th scope="col" className={TH}>
              City
            </th>
            <th scope="col" className={TH}>
              Halls
            </th>
            <th scope="col" className={TH}>
              Seats
            </th>
            <th scope="col" className={TH}>
              Time zone
            </th>
            <th scope="col" className={TH}>
              Status
            </th>
            <th scope="col" className={cn(TH, "text-right")}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {venues.map((venue) => (
            <VenueRow
              key={venue.id}
              venue={venue}
              onAddHall={onAddHall}
              onDeactivate={onDeactivate}
              onActivate={onActivate}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VenueRow({
  venue,
  onAddHall,
  onDeactivate,
  onActivate,
}: {
  venue: VenueListItemDto;
  onAddHall: (venue: VenueListItemDto) => void;
  onDeactivate: (venue: VenueListItemDto) => void;
  onActivate: (venue: VenueListItemDto) => void;
}) {
  const dim = !venue.isActive && "text-muted";

  // An inactive venue takes no new halls; it can only be activated.
  const items: ActionMenuItem[] = [
    {
      label: "View venue and halls",
      href: adminVenueHref(venue.id),
      icon: Building2,
    },
    venue.isActive
      ? { label: "Add a hall", icon: Plus, onSelect: () => onAddHall(venue) }
      : {
          label: "Activate venue",
          icon: Power,
          onSelect: () => onActivate(venue),
        },
    ...(venue.isActive
      ? [
          {
            label: "Deactivate venue",
            icon: PowerOff,
            tone: "danger" as const,
            separatorBefore: true,
            onSelect: () => onDeactivate(venue),
          },
        ]
      : []),
  ];

  return (
    <ClickableRow className="border-t border-line align-middle">
      <td className="px-4 py-3.5">
        <Link
          href={adminVenueHref(venue.id)}
          data-row-link
          className={cn("font-semibold hover:underline", dim || "text-link")}
        >
          {venue.name}
        </Link>
        <p className="text-muted">{venue.addressLine}</p>
      </td>
      <td className={cn("px-4 py-3.5", dim)}>
        <p>{venue.city}</p>
        <p className="text-muted">
          {[venue.state, venue.country].filter(Boolean).join(", ")}
        </p>
      </td>
      <td className={cn("px-4 py-3.5", dim)}>
        <p>{pluralHalls(venue.hallCount)}</p>
        <p className="text-muted">
          {activeHallsLabel(venue.hallsOn, venue.hallCount)}
        </p>
      </td>
      <td className={cn("px-4 py-3.5", dim)}>{venue.totalSeats}</td>
      <td className="px-4 py-3.5 text-muted">{venue.timezone}</td>
      <td className="px-4 py-3.5">
        <Badge tone={venue.isActive ? "success" : "neutral"}>
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-current"
          />
          {statusLabel(venue.isActive)}
        </Badge>
      </td>
      <td className="px-4 py-3.5 text-right">
        <ActionMenu label={`Actions for ${venue.name}`} items={items} />
      </td>
    </ClickableRow>
  );
}
