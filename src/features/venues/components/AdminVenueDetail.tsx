"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { useLayoutEffect, useState, type ReactNode } from "react";
import { ApiError } from "@/src/core/api-client/base-api.service";
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  buttonStyles,
  type BreadcrumbItem,
} from "@/src/core/ui";
import { useGetVenueDetail } from "../hooks/useGetVenueDetail";
import { findListedVenue } from "../hooks/venue-cache";
import { adminVenueEditHref, VENUE_ROUTES } from "../routes";
import type { VenueDetailDto } from "../schemas/venue.schemas";
import { googleMapsUrl, statusLabel } from "../utils/venue-display";
import { ActivateVenueDialog } from "./ActivateVenueDialog";
import { DeactivateVenueDialog } from "./DeactivateVenueDialog";
import { DeleteVenueDialog } from "./DeleteVenueDialog";
import { HallsCard } from "./HallsCard";
import { MapLink } from "./MapLink";
import { VenueDetailsCard } from "./VenueDetailsCard";

const VENUES_CRUMB: BreadcrumbItem = {
  label: "Venues",
  href: VENUE_ROUTES.list,
};

/**
 * The admin's page for one venue: its details, its halls (activate or deactivate, add, delete)
 * and activating or deactivating the venue. It loads GET /api/venues/[id], and every change puts the
 * server's answer straight into that query, so the page always shows what the server says.
 */
export function AdminVenueDetail({ venueId }: { venueId: string }) {
  const detail = useGetVenueDetail(venueId);
  // Coming from the Venues list, its row is already in the cache: the name and address show at
  // once instead of a generic "Venue" while the halls load. Opened by URL, there is none yet.
  const listed = findListedVenue(useQueryClient(), venueId);
  const crumb = listed?.name ?? "Venue";

  if (detail.isPending) {
    return (
      <PageFrame crumb={crumb}>
        {listed && (
          <VenueHeading
            name={listed.name}
            isActive={listed.isActive}
            address={`${listed.addressLine}, ${listed.city}`}
          />
        )}
        <div
          role="status"
          aria-label="Loading venue"
          className="animate-pulse space-y-4 motion-reduce:animate-none"
        >
          {!listed && <div className="h-16 rounded-lg bg-surface-subtle" />}
          <div className="h-64 rounded-lg bg-surface-subtle" />
        </div>
      </PageFrame>
    );
  }

  if (detail.isError) {
    const notFound =
      detail.error instanceof ApiError && detail.error.status === 404;
    return (
      <PageFrame crumb={crumb}>
        {notFound ? (
          <Alert tone="warning" title="Venue not found">
            This venue does not exist, or was removed.
            <Link
              href={VENUE_ROUTES.list}
              className={buttonStyles({ variant: "secondary" }) + " mt-3"}
            >
              Back to venues
            </Link>
          </Alert>
        ) : (
          <Alert tone="error" title="We couldn't load this venue">
            {detail.error.message}
            <Button
              variant="secondary"
              onClick={() => void detail.refetch()}
              className="mt-3"
            >
              Try again
            </Button>
          </Alert>
        )}
      </PageFrame>
    );
  }

  return <VenueView venue={detail.data} />;
}

function PageFrame({
  crumb,
  children,
}: {
  crumb: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Breadcrumb items={[VENUES_CRUMB, { label: crumb }]} />
      {children}
    </div>
  );
}

/**
 * The venue's name, status and address, with an icon that opens the map pin. Shared by the
 * loading view (from the list's row) and the loaded page; `children` are the header's buttons.
 */
function VenueHeading({
  name,
  isActive,
  address,
  mapUrl,
  children,
}: {
  name: string;
  isActive: boolean;
  address: string;
  /** Left out (or null) = no map pin, so no map icon. */
  mapUrl?: string | null;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{name}</h1>
          <Badge tone={isActive ? "success" : "neutral"}>
            {statusLabel(isActive)}
          </Badge>
        </div>
        <p className="flex flex-wrap items-center gap-1.5 text-muted">
          {address}
          {mapUrl && <MapLink href={mapUrl} venueName={name} />}
        </p>
      </div>
      {children}
    </header>
  );
}

function VenueView({ venue }: { venue: VenueDetailDto }) {
  const [dialog, setDialog] = useState<
    "deactivate" | "activate" | "delete" | null
  >(null);

  // Leaving the page hides it (React <Activity>) instead of unmounting it: close the dialog.
  useLayoutEffect(() => () => setDialog(null), []);

  const ref = { id: venue.id, name: venue.name, hallCount: venue.halls.length };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Breadcrumb items={[VENUES_CRUMB, { label: venue.name }]} />

      <VenueHeading
        name={venue.name}
        isActive={venue.isActive}
        address={`${venue.addressLine}, ${venue.city}`}
        mapUrl={googleMapsUrl(venue)}
      >
        <div className="flex flex-wrap gap-2.5">
          <Link
            href={adminVenueEditHref(venue.id)}
            className={buttonStyles({ variant: "secondary" })}
          >
            <Pencil aria-hidden="true" className="size-4" />
            Edit venue
          </Link>
          {venue.isActive ? (
            <Button
              variant="secondary"
              className="border-danger/40 text-danger"
              onClick={() => setDialog("deactivate")}
            >
              <PowerOff aria-hidden="true" className="size-4" />
              Deactivate venue
            </Button>
          ) : (
            <Button onClick={() => setDialog("activate")}>
              <Power aria-hidden="true" className="size-4" />
              Activate venue
            </Button>
          )}
        </div>
      </VenueHeading>

      {!venue.isActive && (
        <Alert tone="warning" title="This venue is inactive">
          Guests and attendees cannot see it, organizers cannot use it, and all
          its halls are inactive. Activate the venue to make its halls available
          again.
        </Alert>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 flex-[2_1_34rem]">
          <HallsCard venue={venue} />
        </div>
        <div className="min-w-0 flex-[1_1_20rem]">
          <VenueDetailsCard venue={venue} />
        </div>
      </div>

      <section
        aria-labelledby="delete-venue-heading"
        className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-danger/40 p-5"
      >
        <div className="max-w-xl">
          <h2 id="delete-venue-heading" className="font-semibold">
            Delete this venue
          </h2>
          <p className="text-sm text-muted">
            Removes the venue and its halls for good. Only a venue that was
            never used by an event or a session can be deleted; otherwise
            deactivate it.
          </p>
        </div>
        <Button
          variant="secondary"
          className="border-danger/40 text-danger"
          onClick={() => setDialog("delete")}
        >
          <Trash2 aria-hidden="true" className="size-4" />
          Delete venue
        </Button>
      </section>

      <DeleteVenueDialog
        venue={dialog === "delete" ? ref : null}
        isActive={venue.isActive}
        onClose={() => setDialog(null)}
      />
      <DeactivateVenueDialog
        venue={dialog === "deactivate" ? ref : null}
        onClose={() => setDialog(null)}
      />
      <ActivateVenueDialog
        venue={dialog === "activate" ? ref : null}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
