"use client";

import { BarChart3, Megaphone, Vote } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatFileSize } from "@/src/core/format/format-file-size";
import {
  Alert,
  Badge,
  Button,
  buttonStyles,
  Card,
  cn,
  SourceBadge,
} from "@/src/core/ui";
import { EVENT_GALLERY_MAX_IMAGES, EVENT_IMAGE_MAX_BYTES } from "../constants";
import type { useGetEventContent } from "../hooks/useGetEventContent";
import { eventEditHref } from "../routes";
import type { EventContentDto } from "../schemas/event-content.schemas";
import { plural } from "../utils/event-display";
import { paragraphs } from "../utils/public-event-display";

/** How many gallery photos the overview shows; the rest are "+N more". */
const GALLERY_PREVIEW = 6;

/** How many words a text has, for "62 words". */
function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** The title row of a content section: a badge (Added / Missing / Optional) and an edit link. */
function SectionAction({
  badge,
  href,
  label,
}: {
  badge: ReactNode;
  href: string | null;
  label: string;
}) {
  return (
    <span className="flex items-center gap-3">
      {badge}
      {href && (
        <Link href={href} className="font-semibold text-link hover:underline">
          {label}
        </Link>
      )}
    </span>
  );
}

//* The cover strip, under the header

/**
 * The event's banner, with a link to change it. A cover is optional: without one the public page
 * shows a placeholder, and the event can still be published.
 */
export function CoverStrip({
  eventId,
  cover,
  editable,
}: {
  eventId: string;
  cover: EventContentDto["coverImage"];
  /** False once the event can no longer be edited: the change link is hidden. */
  editable: boolean;
}) {
  return (
    <section
      aria-label="Cover image"
      className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-surface p-3"
    >
      <div className="h-20 w-40 shrink-0 overflow-hidden rounded-md bg-brand-soft">
        {cover && (
          // A plain <img>: the picture comes from the CMS host, which next/image would have to be
          // configured for. The API only sends http(s) URLs.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.url}
            alt={cover.alt ?? "Event cover"}
            className="size-full object-cover"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p>
          <strong>Cover image</strong>
          {cover && cover.width && cover.height && (
            <span className="text-muted">
              {" "}
              · {cover.width} × {cover.height}
            </span>
          )}
        </p>
        {!cover && (
          <p className="text-muted">
            None yet (optional). A placeholder is shown on the public page.
          </p>
        )}
      </div>
      {editable && (
        <Link
          href={eventEditHref(eventId, "media")}
          className={buttonStyles({ variant: "secondary" })}
        >
          {cover ? "Replace" : "Add cover image"}
        </Link>
      )}
    </section>
  );
}

//* The page content, from the CMS

function ContentSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading page content"
      className="animate-pulse space-y-5 motion-reduce:animate-none"
    >
      {[0, 1, 2].map((block) => (
        <div key={block} className="h-32 rounded-lg bg-surface-subtle" />
      ))}
    </div>
  );
}

function ContentSections({
  eventId,
  content,
  editable,
}: {
  eventId: string;
  content: EventContentDto;
  editable: boolean;
}) {
  const contentHref = editable ? eventEditHref(eventId, "content") : null;
  const mediaHref = editable ? eventEditHref(eventId, "media") : null;
  const about = paragraphs(content.about);
  const guide = paragraphs(content.venueGuide);
  const hidden = Math.max(content.gallery.length - GALLERY_PREVIEW, 0);

  return (
    <>
      <Card
        title="About this event"
        action={
          <SectionAction
            badge={
              <Badge tone={about.length > 0 ? "success" : "warning"}>
                {about.length > 0 ? "Added" : "Missing"}
              </Badge>
            }
            href={contentHref}
            label="Edit description"
          />
        }
      >
        {about.length === 0 ? (
          <p className="text-muted">
            No description yet. It is needed to publish the event.
          </p>
        ) : (
          <div className="space-y-2">
            {about.slice(0, 2).map((text) => (
              <p key={text} className="line-clamp-3">
                {text}
              </p>
            ))}
            <p className="text-sm text-muted">
              {plural(wordCount(content.about), "word")}
            </p>
          </div>
        )}
      </Card>

      <Card
        title={`Gallery · ${plural(content.gallery.length, "photo")}`}
        action={
          <SectionAction
            badge={
              <Badge tone={content.gallery.length > 0 ? "success" : "neutral"}>
                {content.gallery.length > 0 ? "Added" : "Optional"}
              </Badge>
            }
            href={mediaHref}
            label={content.gallery.length > 0 ? "Manage photos" : "Add photos"}
          />
        }
      >
        {content.gallery.length === 0 ? (
          <p className="text-muted">
            No photos yet. The event can be published without a gallery.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {content.gallery.slice(0, GALLERY_PREVIEW).map((image, index) => (
              <li key={image.id}>
                {/* A plain <img>, like the cover above. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={image.alt ?? `Gallery photo ${index + 1}`}
                  loading="lazy"
                  className="aspect-video w-full rounded-md object-cover"
                />
              </li>
            ))}
          </ul>
        )}
        {hidden > 0 && (
          <p className="mt-2 text-sm text-muted">+{hidden} more</p>
        )}
        <p className="mt-3 text-sm text-muted">
          Up to {formatFileSize(EVENT_IMAGE_MAX_BYTES)} each,{" "}
          {EVENT_GALLERY_MAX_IMAGES} photos at most. The first photo is used in
          event cards.
        </p>
      </Card>

      <Card
        title="Venue directions"
        action={
          <SectionAction
            badge={
              <Badge tone={guide.length > 0 ? "success" : "neutral"}>
                {guide.length > 0 ? "Added" : "Optional"}
              </Badge>
            }
            href={contentHref}
            label="Edit"
          />
        }
      >
        {guide.length === 0 ? (
          <p className="text-muted">No directions yet.</p>
        ) : (
          <div className="space-y-2">
            {guide.map((text) => (
              <p key={text}>{text}</p>
            ))}
          </div>
        )}
      </Card>

      <Card
        title={`FAQs · ${content.faqs.length}`}
        action={
          <SectionAction
            badge={
              <Badge tone={content.faqs.length > 0 ? "success" : "neutral"}>
                {content.faqs.length > 0 ? "Added" : "Optional"}
              </Badge>
            }
            href={contentHref}
            label={content.faqs.length > 0 ? "Edit FAQs" : "Add FAQ"}
          />
        }
      >
        {content.faqs.length === 0 ? (
          <p className="text-muted">No questions yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {content.faqs.map((faq) => (
              <li key={faq.question} className="py-3 first:pt-0 last:pb-0">
                <p className="font-semibold">{faq.question}</p>
                <p className="truncate text-muted">{faq.answer}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

/**
 * The event page's content as the public sees it: description, gallery, directions and FAQs,
 * from GET /api/events/[id]/content. The page owns the query (the cover strip reads the same
 * answer), so a slow or unavailable CMS never blocks the figures above: this shows a skeleton
 * while loading and an error with a retry.
 */
export function EventContentOverview({
  eventId,
  editable,
  content,
}: {
  eventId: string;
  editable: boolean;
  content: ReturnType<typeof useGetEventContent>;
}) {
  if (content.isPending) return <ContentSkeleton />;

  if (content.isError) {
    return (
      <Alert tone="error" title="We couldn't load the page content">
        {content.error.message}
        <Button
          variant="secondary"
          className="mt-3"
          onClick={() => void content.refetch()}
        >
          Try again
        </Button>
      </Alert>
    );
  }

  return (
    <>
      <Alert tone="info" title="Page content">
        The cover, description, gallery, directions and FAQs are written in the
        event form and shown on the public event page.
        {editable && (
          <Link
            href={eventEditHref(eventId, "content")}
            className={cn(buttonStyles({ variant: "secondary" }), "mt-3 w-fit")}
          >
            Open content editor
          </Link>
        )}
      </Alert>
      <ContentSections
        eventId={eventId}
        content={content.data}
        editable={editable}
      />
    </>
  );
}

//* Quick actions

const QUICK_ACTIONS = [
  { label: "Send notification to attendees", icon: Megaphone },
  { label: "Manage polls", icon: Vote },
  { label: "View analytics", icon: BarChart3 },
] as const;

/** Shortcuts to features that are not built yet: shown, switched off and marked Static. */
export function QuickActionsCard() {
  return (
    <Card title="Quick actions">
      <ul className="space-y-1">
        {QUICK_ACTIONS.map(({ label, icon: Icon }) => (
          <li
            key={label}
            className="flex items-center gap-2.5 py-1.5 text-muted"
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </li>
        ))}
      </ul>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
        <SourceBadge source="static" />
        These come with notifications, polls and analytics.
      </p>
    </Card>
  );
}
