"use client";

import { Power, PowerOff } from "lucide-react";
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
import { VENUE_ROUTES } from "../routes";
import type { VenueDetailDto } from "../schemas/venue.schemas";
import { statusLabel } from "../utils/venue-display";
import { ActivateVenueDialog } from "./ActivateVenueDialog";
import { DeactivateVenueDialog } from "./DeactivateVenueDialog";
import { HallsCard } from "./HallsCard";
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

  if (detail.isPending) {
    return (
      <PageFrame crumb="Venue">
        <div
          role="status"
          aria-label="Loading venue"
          className="animate-pulse space-y-4 motion-reduce:animate-none"
        >
          <div className="h-16 rounded-lg bg-surface-subtle" />
          <div className="h-64 rounded-lg bg-surface-subtle" />
        </div>
      </PageFrame>
    );
  }

  if (detail.isError) {
    const notFound =
      detail.error instanceof ApiError && detail.error.status === 404;
    return (
      <PageFrame crumb="Venue">
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

function VenueView({ venue }: { venue: VenueDetailDto }) {
  const [dialog, setDialog] = useState<"deactivate" | "activate" | null>(null);

  // Leaving the page hides it (React <Activity>) instead of unmounting it: close the dialog.
  useLayoutEffect(() => () => setDialog(null), []);

  const ref = { id: venue.id, name: venue.name, hallCount: venue.halls.length };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Breadcrumb items={[VENUES_CRUMB, { label: venue.name }]} />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{venue.name}</h1>
            <Badge tone={venue.isActive ? "success" : "neutral"}>
              {statusLabel(venue.isActive)}
            </Badge>
          </div>
          <p className="text-muted">
            {venue.addressLine}, {venue.city}
          </p>
        </div>
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
      </header>

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
