"use client";

import { useState } from "react";
import { Alert, Badge, Button } from "@/src/core/ui";
import { useGetSpeakerSessions } from "../hooks/useGetSpeakerSessions";
import {
  countLabel,
  SPEAKER_SESSION_SECTIONS,
} from "../utils/speaker-session-display";
import { SpeakerEventGroup } from "./SpeakerEventGroup";

type Section = (typeof SPEAKER_SESSION_SECTIONS)[number];

/** The anchor a jump link points at. */
export const sectionAnchor = (section: Section) =>
  `speaker-sessions-${section.timeline}`;

/**
 * One category of the speaker's sessions (GET /api/speakers/[slug]/sessions?timeline=…): its own
 * loading, empty and error states, the events with their sessions, and Previous / Next when the
 * category has more events than one page.
 */
export function SpeakerSessionsSection({
  slug,
  section,
}: {
  slug: string;
  section: Section;
}) {
  const [page, setPage] = useState(1);
  const sessions = useGetSpeakerSessions(slug, {
    timeline: section.timeline,
    page,
  });
  // The clock the "In 3 days" badges count from, taken once when the section first shows.
  const [now] = useState(() => new Date());

  return (
    <section
      id={sectionAnchor(section)}
      aria-labelledby={`${sectionAnchor(section)}-title`}
      className="scroll-mt-20 space-y-3"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 id={`${sectionAnchor(section)}-title`} className="font-semibold">
          {section.title}
        </h3>
        {sessions.isSuccess && sessions.data.meta.total > 0 && (
          <Badge>
            {countLabel(
              sessions.data.meta.totalSessions,
              sessions.data.meta.total,
            )}
          </Badge>
        )}
        <span className="text-sm text-muted">{section.hint}</span>
      </div>

      {sessions.isPending && (
        <div
          role="status"
          aria-label={`Loading ${section.title.toLowerCase()} sessions`}
          className="animate-pulse space-y-2 motion-reduce:animate-none"
        >
          <div className="h-16 rounded-lg bg-surface-subtle" />
          <div className="h-16 rounded-lg bg-surface-subtle" />
        </div>
      )}

      {sessions.isError && (
        <Alert tone="error" title="We couldn't load these sessions">
          {sessions.error.message}
          <Button
            variant="secondary"
            onClick={() => void sessions.refetch()}
            className="mt-3"
          >
            Try again
          </Button>
        </Alert>
      )}

      {sessions.isSuccess &&
        (sessions.data.items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
            {section.empty}
          </p>
        ) : (
          <>
            <div className="space-y-3">
              {sessions.data.items.map((group) => (
                <SpeakerEventGroup
                  key={group.event.slug}
                  group={group}
                  timeline={section.timeline}
                  now={now}
                />
              ))}
            </div>
            <Pager
              page={sessions.data.meta.page}
              pageSize={sessions.data.meta.pageSize}
              total={sessions.data.meta.total}
              onPageChange={setPage}
            />
          </>
        ))}
    </section>
  );
}

/** "Events 6–10 of 12" with Previous / Next; nothing when everything fits on one page. */
function Pager({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (total <= pageSize) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Event pages"
      className="flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <p className="text-muted">
        Events {first}–{last} of {total}
      </p>
      <div className="flex gap-1.5">
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          disabled={last >= total}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
