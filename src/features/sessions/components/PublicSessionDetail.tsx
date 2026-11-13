"use client";

import { CalendarX } from "lucide-react";
import Link from "next/link";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { Alert, Breadcrumb, Button, buttonStyles, Card } from "@/src/core/ui";
import { EVENT_ROUTES, paragraphs, publicEventHref } from "../../events";
import { useGetPublicSession } from "../hooks/useGetPublicSession";
import type { PublicSessionDetailDto } from "../schemas/session-public.schemas";
import { PublicSessionBooking } from "./PublicSessionBooking";
import { PublicSessionDetails } from "./PublicSessionDetails";
import { PublicSessionDetailSkeleton } from "./PublicSessionDetailSkeleton";
import { PublicSessionHero } from "./PublicSessionHero";
import { PublicSessionSpeakers } from "./PublicSessionSpeakers";

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

      <PublicSessionHero session={session} />

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
          <PublicSessionSpeakers speakers={session.speakers} />
        </div>

        <div className="min-w-0 flex-[1_1_20rem] space-y-6 lg:sticky lg:top-6">
          <PublicSessionBooking session={session} />
          <PublicSessionDetails session={session} />
        </div>
      </div>
    </div>
  );
}

/**
 * One session's public page (GET /api/events/slug/[slug]/sessions/[sessionId]): a cover hero, the
 * description, prerequisites and resources from the CMS, the speakers with their photos, what
 * attending costs and how many seats are left, and the details of the place. Open to guests. A
 * session that is not public, or an unknown link, is "not found".
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
