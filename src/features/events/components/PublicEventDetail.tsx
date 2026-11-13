"use client";

import { CalendarDays, CalendarX, MapPin } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { formatDate } from "@/src/core/format/format-date";
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  buttonStyles,
  Card,
  SourceBadge,
} from "@/src/core/ui";
import { speakerHref, SPEAKER_ROUTES } from "@/src/features/speakers";
import { useGetPublicEvent } from "../hooks/useGetPublicEvent";
import { EVENT_ROUTES } from "../routes";
import type { PublicEventDetailDto } from "../schemas/event-public.schemas";
import {
  formatEventDates,
  formatEventTimes,
  formatTicketPrice,
  plural,
  seatsLeftBadge,
} from "../utils/event-display";
import {
  eventSpeakers,
  isTimed,
  paragraphs,
} from "../utils/public-event-display";
import { PublicEventDetailSkeleton } from "./PublicEventDetailSkeleton";
import { PublicEventSchedule } from "./PublicEventSchedule";

/** The anchors of the sections under the hero; a section without content has no link. */
type SectionLink = { id: string; label: string };

function Section({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-4">
      <Card title={title} action={action}>
        {children}
      </Card>
    </div>
  );
}

/** "Registration opens 12 Nov 2026", or when it closed or closes; null when there is no limit. */
function registrationNote(
  event: PublicEventDetailDto,
  now: Date,
): string | null {
  const { registrationOpensAt: opens, registrationClosesAt: closes } = event;
  if (opens && new Date(opens) > now) {
    return `Registration opens ${formatDate(opens)}.`;
  }
  if (closes) {
    return new Date(closes) > now
      ? `Registration closes ${formatDate(closes)}.`
      : "Registration has closed.";
  }
  return null;
}

function RegistrationBox({ event }: { event: PublicEventDetailDto }) {
  const cancelled = event.status === "cancelled";
  const seats = seatsLeftBadge(event.seatsLeft);
  const note = cancelled ? null : registrationNote(event, new Date());

  return (
    <aside
      aria-label="Registration"
      className="flex flex-[1_1_20rem] flex-col gap-4 rounded-lg border border-line bg-surface p-6"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-bold">
          {formatTicketPrice(event.ticketPrice)}
        </span>
        <span className="text-sm text-muted">Ticket price</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Badge tone={seats.tone}>{seats.text}</Badge>
      </div>
      {note && <p className="text-sm text-muted">{note}</p>}
      {cancelled ? (
        <p className="text-sm font-semibold text-danger">
          This event was cancelled.
        </p>
      ) : (
        <>
          {/* Registering is not built yet: the button is shown but switched off. */}
          <Button fullWidth disabled>
            Register
          </Button>
          <p className="flex items-center gap-2 text-sm text-muted">
            <SourceBadge source="static" />
            Registration is not open in this build yet.
          </p>
        </>
      )}
    </aside>
  );
}

function EventDetail({ event }: { event: PublicEventDetailDto }) {
  const { content, venue } = event;
  const cancelled = event.status === "cancelled";
  const speakers = eventSpeakers(event.sessions);
  const timedCount = event.sessions.filter(isTimed).length;
  const about = content ? paragraphs(content.about) : [];

  const sections: SectionLink[] = [
    { id: "about", label: "About" },
    ...(timedCount > 0 ? [{ id: "schedule", label: "Schedule" }] : []),
    ...(speakers.length > 0 ? [{ id: "speakers", label: "Speakers" }] : []),
    ...(venue ? [{ id: "venue", label: "Venue" }] : []),
    ...(content && content.faqs.length > 0
      ? [{ id: "faq", label: "FAQ" }]
      : []),
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Breadcrumb
        items={[
          { label: "Events", href: EVENT_ROUTES.browse },
          { label: event.title },
        ]}
      />

      {cancelled && (
        <Alert tone="error" title="This event was cancelled">
          Registration is closed. The page stays up so the details are still
          there.
        </Alert>
      )}

      <div className="flex flex-wrap items-start gap-6">
        <section
          aria-labelledby="event-title"
          className="min-w-0 flex-[3_1_32rem] overflow-hidden rounded-lg border border-line bg-surface"
        >
          <div className="h-55 bg-brand-soft">
            {content?.coverImage && (
              // A plain <img>: the banner comes from the CMS host, which next/image would have to
              // be configured for. The API only sends http(s) URLs.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={content.coverImage.url}
                alt={content.coverImage.alt ?? ""}
                className="size-full object-cover"
              />
            )}
          </div>
          <div className="space-y-3 p-6">
            {timedCount > 0 && (
              <Badge tone="neutral">{plural(timedCount, "session")}</Badge>
            )}
            <h1
              id="event-title"
              className="text-3xl font-semibold leading-tight"
            >
              {event.title}
            </h1>
            {content?.tagline && (
              <p className="text-lg text-muted">{content.tagline}</p>
            )}
            <p className="flex items-center gap-2 text-sm text-muted">
              Organised by{" "}
              <strong className="text-foreground">Organiser</strong>
              <SourceBadge source="static" />
            </p>
            <div className="flex flex-wrap gap-x-7 gap-y-2 pt-2">
              <p className="flex items-center gap-2 text-sm">
                <CalendarDays
                  aria-hidden="true"
                  className="size-5 text-muted"
                />
                {formatEventDates(event.startAt, event.endAt, event.timezone, {
                  weekday: true,
                })}{" "}
                · {formatEventTimes(event.startAt, event.endAt, event.timezone)}
              </p>
              <p className="flex items-center gap-2 text-sm">
                <MapPin aria-hidden="true" className="size-5 text-muted" />
                {venue
                  ? `${venue.name}, ${venue.city}`
                  : "Venue to be announced"}
              </p>
            </div>
          </div>
        </section>

        <RegistrationBox event={event} />
      </div>

      <nav
        aria-label="Event sections"
        className="flex gap-7 overflow-x-auto border-b border-line"
      >
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="flex h-11 items-center whitespace-nowrap text-sm font-medium text-muted hover:text-foreground"
          >
            {section.label}
          </a>
        ))}
      </nav>

      <Section id="about" title="About">
        {content === null ? (
          <Alert tone="info" title="More details are coming">
            The rest of this page could not be loaded just now. The date, place
            and price above are up to date.
          </Alert>
        ) : (
          <div className="space-y-4">
            {about.length > 0 ? (
              about.map((text) => (
                <p key={text} className="max-w-3xl text-foreground/90">
                  {text}
                </p>
              ))
            ) : (
              <p className="text-muted">
                The organizer has not added a description.
              </p>
            )}
            {content.highlights.length > 0 && (
              <ul className="grid gap-3 sm:grid-cols-2">
                {content.highlights.map((item) => (
                  <li
                    key={item.title}
                    className="rounded-md border border-line p-3"
                  >
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-sm text-muted">{item.description}</p>
                  </li>
                ))}
              </ul>
            )}
            {content.gallery.length > 0 && (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {content.gallery.map((image) => (
                  <li key={image.url}>
                    {/* A plain <img>, like the banner above. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      alt={image.alt ?? ""}
                      loading="lazy"
                      className="aspect-video w-full rounded-md object-cover"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Section>

      {timedCount > 0 && (
        <PublicEventSchedule
          sessions={event.sessions}
          slug={event.slug}
          timezone={event.timezone}
        />
      )}

      {speakers.length > 0 && (
        <Section
          id="speakers"
          title={`Speakers (${speakers.length})`}
          action={
            <Link
              href={SPEAKER_ROUTES.list}
              className="text-sm font-semibold text-link hover:underline"
            >
              View all speakers
            </Link>
          }
        >
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-4">
            {speakers.map((speaker) => (
              <li
                key={speaker.slug}
                className="rounded-lg border border-line p-4 hover:border-brand"
              >
                <Link
                  href={speakerHref(speaker.slug)}
                  className="font-semibold hover:underline"
                >
                  {speaker.name}
                </Link>
                <p className="text-sm text-muted">
                  {plural(speaker.sessionCount, "session")}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="flex flex-wrap items-start gap-6">
        {venue && (
          <div className="min-w-0 flex-[1_1_24rem]">
            <Section id="venue" title="Venue">
              <p className="font-semibold">{venue.name}</p>
              <p className="text-muted">
                {[venue.addressLine, venue.city, venue.state, venue.postalCode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {content?.venueGuide && (
                <p className="mt-3 text-sm text-foreground/90">
                  {content.venueGuide}
                </p>
              )}
            </Section>
          </div>
        )}
        {content && content.faqs.length > 0 && (
          <div className="min-w-0 flex-[1.4_1_26rem]">
            <Section id="faq" title="FAQ">
              <div className="divide-y divide-line">
                {content.faqs.map((faq) => (
                  <details key={faq.question} className="py-3">
                    <summary className="cursor-pointer font-semibold">
                      {faq.question}
                    </summary>
                    <p className="mt-2 text-foreground/90">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * One event's public page (GET /api/events/slug/[slug]): hero, price and seats, the programme
 * by day, speakers, venue and FAQ. Open to guests. A draft or an unknown link is "not found".
 * Registering and the organiser's name are not built yet and carry a Static badge.
 */
export function PublicEventDetail({ slug }: { slug: string }) {
  const event = useGetPublicEvent(slug);

  if (event.isPending) return <PublicEventDetailSkeleton />;

  if (event.isError) {
    if (event.error instanceof ApiError && event.error.status === 404) {
      return (
        <div className="mx-auto flex max-w-md flex-col items-center gap-2 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-surface-subtle text-muted">
            <CalendarX aria-hidden="true" className="size-6" />
          </span>
          <h1 className="text-xl font-semibold">
            We couldn&apos;t find that event
          </h1>
          <p className="text-muted">
            The link may be wrong, or the event is not public.
          </p>
          <Link
            href={EVENT_ROUTES.browse}
            className={buttonStyles({ variant: "secondary" })}
          >
            Browse events
          </Link>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-6xl">
        <Alert tone="error" title="We couldn't load this event">
          {event.error.message}
          <Button
            variant="secondary"
            onClick={() => void event.refetch()}
            className="mt-3"
          >
            Try again
          </Button>
        </Alert>
      </div>
    );
  }

  return <EventDetail event={event.data} />;
}
