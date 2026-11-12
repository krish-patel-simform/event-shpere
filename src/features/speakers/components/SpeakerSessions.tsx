"use client";

import { Card } from "@/src/core/ui";
import { useGetSpeakerSessions } from "../hooks/useGetSpeakerSessions";
import { SPEAKER_SESSION_SECTIONS } from "../utils/speaker-session-display";
import {
  sectionAnchor,
  SpeakerSessionsSection,
} from "./SpeakerSessionsSection";

/**
 * "Sessions" on the speaker's page: Happening now, Upcoming and Also spoken at, each loaded on
 * its own from GET /api/speakers/[slug]/sessions, with jump links that show how many sessions
 * each has. The first page of each category is shared with its section (one request).
 */
export function SpeakerSessions({ slug }: { slug: string }) {
  return (
    <Card
      title="Sessions"
      description="Grouped by event. Happening now first, then upcoming events, then past ones."
    >
      <nav aria-label="Jump to" className="mb-5 flex flex-wrap gap-2">
        {SPEAKER_SESSION_SECTIONS.map((section) => (
          <JumpLink key={section.timeline} slug={slug} section={section} />
        ))}
      </nav>
      <div className="space-y-8">
        {SPEAKER_SESSION_SECTIONS.map((section) => (
          <SpeakerSessionsSection
            key={section.timeline}
            slug={slug}
            section={section}
          />
        ))}
      </div>
    </Card>
  );
}

function JumpLink({
  slug,
  section,
}: {
  slug: string;
  section: (typeof SPEAKER_SESSION_SECTIONS)[number];
}) {
  const sessions = useGetSpeakerSessions(slug, { timeline: section.timeline });
  return (
    <a
      href={`#${sectionAnchor(section)}`}
      className="rounded-full border border-line px-3 py-1 text-sm font-medium hover:bg-surface-subtle"
    >
      {section.link}
      {sessions.isSuccess && ` · ${sessions.data.meta.totalSessions}`}
    </a>
  );
}
