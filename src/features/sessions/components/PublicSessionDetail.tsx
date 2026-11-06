"use client";

import { CalendarDays, CalendarX, MapPin } from "lucide-react";
import Link from "next/link";
import { ApiError } from "@/src/core/api-client/base-api.service";
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  buttonStyles,
  Card,
} from "@/src/core/ui";
import { speakerHref } from "@/src/features/speakers";
import {
  EVENT_ROUTES,
  formatTicketPrice,
  paragraphs,
  publicEventHref,
  PUBLIC_SESSION_TYPE_LABELS,
} from "../../events";
import { useGetPublicSession } from "../hooks/useGetPublicSession";
import type { PublicSessionDetailDto } from "../schemas/session-public.schemas";
import {
  PUBLIC_SESSION_MODE_LABELS,
  PUBLIC_SPEAKER_ROLE_LABELS,
  sessionPlace,
  sessionWhen,
} from "../utils/public-session-display";
import { PublicSessionDetailSkeleton } from "./PublicSessionDetailSkeleton";

function SessionAbout({
  content,
}: {
  content: NonNullable<PublicSessionDetailDto["content"]>;
}) {
  const about = paragraphs(content.description);
  return (
    <Card title="About this session">
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
        {content.prerequisites && (
          <div>
            <h3 className="font-semibold">Before you come</h3>
            <p className="max-w-3xl text-foreground/90">
              {content.prerequisites}
            </p>
          </div>
        )}
        {content.resources.length > 0 && (
          <div>
            <h3 className="font-semibold">Resources</h3>
            <ul className="mt-1 space-y-1">
              {content.resources.map((resource) => (
                <li key={resource.url}>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-link hover:underline"
                  >
                    {resource.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

function SessionPage({ session }: { session: PublicSessionDetailDto }) {
  const { event, content } = session;
  const when = sessionWhen(session);
  const cancelled = event.status === "cancelled";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Breadcrumb
        items={[
          { label: "Events", href: EVENT_ROUTES.browse },
          { label: event.title, href: publicEventHref(event.slug) },
          { label: session.title },
        ]}
      />

      {cancelled && (
        <Alert tone="error" title="This event was cancelled">
          The page stays up so the details are still there.
        </Alert>
      )}

      <section
        aria-labelledby="session-title"
        className="overflow-hidden rounded-lg border border-line bg-surface"
      >
        {content?.coverImage && (
          <div className="h-55 bg-brand-soft">
            {/* A plain <img>, like the event's banner: it comes from the CMS host. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={content.coverImage.url}
              alt={content.coverImage.alt ?? ""}
              className="size-full object-cover"
            />
          </div>
        )}
        <div className="space-y-3 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">
              {PUBLIC_SESSION_TYPE_LABELS[session.type]}
            </Badge>
            <Badge tone="neutral">
              {PUBLIC_SESSION_MODE_LABELS[session.mode]}
            </Badge>
            {session.price > 0 && (
              <Badge tone="brand">+ {formatTicketPrice(session.price)}</Badge>
            )}
          </div>
          <h1
            id="session-title"
            className="text-3xl font-semibold leading-tight"
          >
            {session.title}
          </h1>
          <p className="text-muted">
            Part of{" "}
            <Link
              href={publicEventHref(event.slug)}
              className="font-medium text-link hover:underline"
            >
              {event.title}
            </Link>
          </p>
          <div className="flex flex-wrap gap-x-7 gap-y-2 pt-2">
            <p className="flex items-center gap-2 text-sm">
              <CalendarDays aria-hidden="true" className="size-5 text-muted" />
              {when ? `${when.date} · ${when.time}` : "Time to be announced"}
            </p>
            <p className="flex items-center gap-2 text-sm">
              <MapPin aria-hidden="true" className="size-5 text-muted" />
              {sessionPlace(session)}
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[2_1_28rem] space-y-6">
          {content === null ? (
            <Alert tone="info" title="More details are coming">
              The description could not be loaded just now. The time, place and
              speakers on this page are up to date.
            </Alert>
          ) : (
            <SessionAbout content={content} />
          )}
        </div>

        <div className="min-w-0 flex-[1_1_18rem] space-y-6">
          <Card title={session.speakers.length === 1 ? "Speaker" : "Speakers"}>
            {session.speakers.length > 0 ? (
              <ul className="space-y-3">
                {session.speakers.map((speaker) => (
                  <li key={speaker.slug} className="flex flex-col">
                    <Link
                      href={speakerHref(speaker.slug)}
                      className="font-semibold hover:underline"
                    >
                      {speaker.name}
                    </Link>
                    {speaker.role !== "speaker" && (
                      <span className="text-sm text-muted">
                        {PUBLIC_SPEAKER_ROLE_LABELS[speaker.role]}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">Speakers will be announced.</p>
            )}
          </Card>

          <Card title="Attending">
            <dl className="space-y-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Price</dt>
                <dd className="font-semibold">
                  {session.price > 0
                    ? `+ ${formatTicketPrice(session.price)}`
                    : "Included in the event ticket"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Seat</dt>
                <dd className="font-semibold">
                  {session.requiresRegistration
                    ? "Registration required"
                    : "No separate registration"}
                </dd>
              </div>
            </dl>
            <Link
              href={publicEventHref(event.slug)}
              className={buttonStyles({ variant: "secondary" }) + " mt-4"}
            >
              View the event
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * One session's public page (GET /api/events/slug/[slug]/sessions/[sessionId]): hero, the
 * description, prerequisites and resources from the CMS, the speakers, and what attending costs.
 * Open to guests. A session that is not public, or an unknown link, is "not found".
 */
export function PublicSessionDetail({
  slug,
  sessionId,
}: {
  slug: string;
  sessionId: string;
}) {
  const session = useGetPublicSession(slug, sessionId);

  if (session.isPending) return <PublicSessionDetailSkeleton />;

  if (session.isError) {
    const notFound =
      session.error instanceof ApiError &&
      (session.error.status === 404 || session.error.status === 400);
    if (notFound) {
      return (
        <div className="mx-auto flex max-w-md flex-col items-center gap-2 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-surface-subtle text-muted">
            <CalendarX aria-hidden="true" className="size-6" />
          </span>
          <h1 className="text-xl font-semibold">
            We couldn&apos;t find that session
          </h1>
          <p className="text-muted">
            The link may be wrong, or the session is not public.
          </p>
          <Link
            href={publicEventHref(slug)}
            className={buttonStyles({ variant: "secondary" })}
          >
            Back to the event
          </Link>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-6xl">
        <Alert tone="error" title="We couldn't load this session">
          {session.error.message}
          <Button
            variant="secondary"
            onClick={() => void session.refetch()}
            className="mt-3"
          >
            Try again
          </Button>
        </Alert>
      </div>
    );
  }

  return <SessionPage session={session.data} />;
}
