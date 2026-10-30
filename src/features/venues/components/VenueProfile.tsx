"use client";

import {
  Building2,
  Clock,
  DoorOpen,
  ExternalLink,
  MapPin,
  Settings2,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ApiError } from "@/src/core/api-client/base-api.service";
import {
  Alert,
  Breadcrumb,
  Button,
  buttonStyles,
  Card,
  cn,
} from "@/src/core/ui";
import { useHasPermission } from "@/src/features/auth";
import { useGetVenueDetail } from "../hooks/useGetVenueDetail";
import { adminVenueHref, VENUE_ROUTES } from "../routes";
import type { VenueDetailDto } from "../schemas/venue.schemas";
import { pluralHalls } from "../utils/venue-display";

const VENUES_CRUMB = { label: "Venues", href: VENUE_ROUTES.browse };

/**
 * Discover: one venue's page (GET /api/venues/[id]) with its active halls. The same page for
 * every visitor: a guest never gets an inactive venue or hall from the API, and an admin (who
 * does) sees them hidden here too, so Discover always shows what organizers can use.
 */
export function VenueProfile({ venueId }: { venueId: string }) {
  const detail = useGetVenueDetail(venueId);

  if (detail.isPending) return <VenueProfileSkeleton />;

  const notFound =
    (detail.isError &&
      detail.error instanceof ApiError &&
      detail.error.status === 404) ||
    // An inactive venue reaches here only for an admin: Discover hides it like for everyone.
    (detail.isSuccess && !detail.data.isActive);

  if (notFound) {
    return (
      <PageFrame name="Venue">
        <Alert tone="warning" title="Venue not found">
          This venue does not exist, or is not open for events right now.
          <Link
            href={VENUE_ROUTES.browse}
            className={cn(buttonStyles({ variant: "secondary" }), "mt-3")}
          >
            Back to venues
          </Link>
        </Alert>
      </PageFrame>
    );
  }

  if (detail.isError) {
    return (
      <PageFrame name="Venue">
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
      </PageFrame>
    );
  }

  return <VenueView venue={detail.data} />;
}

/** The breadcrumb, shared by the loading, error and loaded views. */
function PageFrame({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Breadcrumb items={[VENUES_CRUMB, { label: name }]} />
      {children}
    </div>
  );
}

/** What the page shows while the venue loads; also the page's Suspense fallback. */
export function VenueProfileSkeleton() {
  return (
    <PageFrame name="Venue">
      <div
        role="status"
        aria-label="Loading venue"
        className="animate-pulse space-y-5 motion-reduce:animate-none"
      >
        <div className="h-36 rounded-lg bg-surface-subtle" />
        <div className="h-56 rounded-lg bg-surface-subtle" />
      </div>
    </PageFrame>
  );
}

function VenueView({ venue }: { venue: VenueDetailDto }) {
  const canManage = useHasPermission("VENUE_MANAGE");
  // Discover shows only the halls organizers can use (an admin also gets the inactive ones).
  const halls = venue.halls.filter((hall) => hall.isActive);
  const place = [venue.city, venue.state, venue.postalCode]
    .filter(Boolean)
    .join(", ");
  const mapUrl =
    venue.latitude !== null && venue.longitude !== null
      ? `https://www.google.com/maps/search/?api=1&query=${venue.latitude},${venue.longitude}`
      : null;

  return (
    <PageFrame name={venue.name}>
      <Card>
        <div className="flex flex-wrap items-start gap-5">
          <span
            aria-hidden="true"
            className="grid size-16 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-soft-foreground"
          >
            <Building2 className="size-8" />
          </span>
          <div className="min-w-0 flex-1 basis-72 space-y-3">
            <div>
              <h1 className="text-2xl font-semibold">{venue.name}</h1>
              <p className="flex items-start gap-1.5 text-muted">
                <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0" />
                <span>
                  {venue.addressLine}, {place}, {venue.country}
                </span>
              </p>
            </div>
            <ul aria-label="About this venue" className="flex flex-wrap gap-2">
              <Fact icon={DoorOpen}>
                {halls.length > 0
                  ? `${pluralHalls(halls.length)} open`
                  : "No halls open"}
              </Fact>
              <Fact icon={Clock}>Time zone: {venue.timezone}</Fact>
            </ul>
            {(mapUrl || canManage) && (
              <div className="flex flex-wrap gap-2">
                {mapUrl && (
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonStyles({ variant: "secondary" })}
                  >
                    <ExternalLink aria-hidden="true" className="size-4" />
                    View on map
                  </a>
                )}
                {canManage && (
                  <Link
                    href={adminVenueHref(venue.id)}
                    className={buttonStyles({ variant: "secondary" })}
                  >
                    <Settings2 aria-hidden="true" className="size-4" />
                    Manage venue
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card
        title="Halls"
        description="The rooms events and sessions at this venue take place in."
      >
        {halls.length === 0 ? (
          <p className="py-4 text-center text-muted">
            No halls are open at this venue right now.
          </p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3">
            {halls.map((hall) => (
              <li
                key={hall.id}
                className="flex items-center gap-3 rounded-md border border-line p-4"
              >
                <span
                  aria-hidden="true"
                  className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-subtle text-muted"
                >
                  <DoorOpen className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">{hall.name}</p>
                  <p className="flex items-center gap-1 text-sm text-muted">
                    <Users aria-hidden="true" className="size-3.5" />
                    Capacity {hall.capacity}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageFrame>
  );
}

/** One fact about the venue, as a small grey chip. */
function Fact({
  icon: Icon,
  children,
}: {
  icon: typeof Clock;
  children: ReactNode;
}) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded bg-surface-subtle px-2.5 py-1 text-sm font-medium">
      <Icon aria-hidden="true" className="size-4 text-muted" />
      {children}
    </li>
  );
}
