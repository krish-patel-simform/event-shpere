import { Card, DescriptionList, type DescriptionItem } from "@/src/core/ui";
import type { VenueDetailDto } from "../schemas/venue.schemas";
import { googleMapsUrl } from "../utils/venue-display";
import { MapLink } from "./MapLink";

/** The venue's address, time zone and map pin (with an icon that opens it in Google Maps). */
export function VenueDetailsCard({ venue }: { venue: VenueDetailDto }) {
  const mapUrl = googleMapsUrl(venue);
  const items: DescriptionItem[] = [
    { label: "Address", value: venue.addressLine },
    { label: "City", value: venue.city },
    ...(venue.state ? [{ label: "State", value: venue.state }] : []),
    ...(venue.postalCode
      ? [{ label: "Postal code", value: venue.postalCode }]
      : []),
    { label: "Country", value: venue.country },
    { label: "Time zone", value: venue.timezone },
    {
      label: "Map pin",
      value: mapUrl ? (
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs">
            {venue.latitude}, {venue.longitude}
          </span>
          <MapLink href={mapUrl} venueName={venue.name} />
        </span>
      ) : (
        <span className="font-normal text-muted">Not set</span>
      ),
    },
  ];

  return (
    <Card title="Venue details">
      <DescriptionList items={items} labelWidth="sm" />
      <p className="mt-4 text-sm text-muted">
        Events held here use this time zone for their start and end times.
      </p>
      <p className="mt-3 border-t border-line pt-3 text-sm text-muted">
        {/* Not in the API yet: PATCH /api/venues/{id} and PATCH .../halls/{hallId}. */}
        Editing the address or a hall&apos;s name and seats is not in the API
        yet, so this page does not offer it.
      </p>
    </Card>
  );
}
