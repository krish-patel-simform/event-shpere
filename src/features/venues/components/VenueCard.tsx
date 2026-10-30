import { Building2, DoorOpen, MapPin } from "lucide-react";
import Link from "next/link";
import { venueHref } from "../routes";
import type { VenueListItemDto } from "../schemas/venue.schemas";
import { pluralHalls } from "../utils/venue-display";

/**
 * One venue in the Discover grid: name, where it is and how many halls are open. The whole card
 * opens the venue's page. Discover lists active venues only, so there is no status here.
 */
export function VenueCard({ venue }: { venue: VenueListItemDto }) {
  const place = [venue.city, venue.state].filter(Boolean).join(", ");

  return (
    <li className="relative flex flex-col gap-3 rounded-lg border border-line bg-surface p-5 hover:border-brand focus-within:border-brand">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid size-11 shrink-0 place-items-center rounded-md bg-brand-soft text-brand-soft-foreground"
        >
          <Building2 className="size-5" />
        </span>
        <div className="min-w-0">
          {/* The link covers the whole card (after:inset-0), so a click anywhere opens the venue. */}
          <Link
            href={venueHref(venue.id)}
            className="text-base font-semibold hover:underline after:absolute after:inset-0 after:content-['']"
          >
            {venue.name}
          </Link>
          <p className="text-sm text-muted">{place}</p>
        </div>
      </div>
      <p className="flex items-start gap-1.5 text-sm text-muted">
        <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>{venue.addressLine}</span>
      </p>
      <p className="mt-auto flex items-center gap-1.5 border-t border-line pt-3 text-sm font-medium">
        <DoorOpen aria-hidden="true" className="size-4 text-muted" />
        {/* Only the halls organizers can use: the inactive ones are not on Discover. */}
        {venue.hallsOn > 0 ? pluralHalls(venue.hallsOn) : "No halls open yet"}
      </p>
    </li>
  );
}
