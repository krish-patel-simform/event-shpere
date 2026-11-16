"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { Alert, Breadcrumb, Button, buttonStyles } from "@/src/core/ui";
import { useGetVenueDetail } from "../hooks/useGetVenueDetail";
import { adminVenueHref, VENUE_ROUTES } from "../routes";
import { EditVenueForm } from "./EditVenueForm";

/**
 * The admin's "Edit venue" page. It loads GET /api/venues/[id] (the same query as the venue
 * page, so it is usually already in the cache) and fills the form with it.
 */
export function AdminVenueEdit({ venueId }: { venueId: string }) {
  const detail = useGetVenueDetail(venueId);

  if (detail.isPending) {
    return (
      <PageFrame>
        <div
          role="status"
          aria-label="Loading venue"
          className="max-w-3xl animate-pulse space-y-4 motion-reduce:animate-none"
        >
          <div className="h-72 rounded-lg bg-surface-subtle" />
          <div className="h-32 rounded-lg bg-surface-subtle" />
        </div>
      </PageFrame>
    );
  }

  if (detail.isError) {
    const notFound =
      detail.error instanceof ApiError && detail.error.status === 404;
    return (
      <PageFrame>
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

  const venue = detail.data;
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Breadcrumb
        items={[
          { label: "Venues", href: VENUE_ROUTES.list },
          { label: venue.name, href: adminVenueHref(venue.id) },
          { label: "Edit" },
        ]}
      />
      <header>
        <h1 className="text-2xl font-semibold">Edit venue</h1>
        <p className="max-w-xl text-muted">
          Change the address, state or map pin. Halls are edited on the
          venue&apos;s page. Events that already use this venue keep their own
          time zone.
        </p>
      </header>
      <EditVenueForm venue={venue} />
    </div>
  );
}

function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Breadcrumb
        items={[
          { label: "Venues", href: VENUE_ROUTES.list },
          { label: "Edit" },
        ]}
      />
      {children}
    </div>
  );
}
