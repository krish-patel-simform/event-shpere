"use client";

import Link from "next/link";
import { Avatar, Card } from "@/src/core/ui";
import {
  SpeakerPhoto,
  speakerHref,
  useGetSpeakerList,
} from "@/src/features/speakers";
import type { PublicSessionDetailDto } from "../schemas/session-public.schemas";
import { PUBLIC_SPEAKER_ROLE_LABELS } from "../utils/public-session-display";

type Speaker = PublicSessionDetailDto["speakers"][number];

/**
 * The speakers of the session. The names come with the session; the photo, job title and company
 * come from the speakers list (the same public API as the Speakers page), asked for these
 * speakers only. While that loads, or if it fails, the page shows initials and the names: the
 * session never waits for the CMS.
 */
export function PublicSessionSpeakers({ speakers }: { speakers: Speaker[] }) {
  return (
    <Card title={speakers.length === 1 ? "Speaker" : "Speakers"}>
      {speakers.length > 0 ? (
        <SpeakerList speakers={speakers} />
      ) : (
        <p className="text-muted">Speakers will be announced.</p>
      )}
    </Card>
  );
}

function SpeakerList({ speakers }: { speakers: Speaker[] }) {
  const ids = speakers.map((speaker) => speaker.id);
  // Only rendered with at least one speaker: the list needs 1 to 50 ids.
  const details = useGetSpeakerList({ ids, pageSize: ids.length });

  return (
    <ul className="space-y-5">
      {speakers.map((speaker) => {
        const info = details.data?.items.find((item) => item.id === speaker.id);
        const headline = [info?.profile?.jobTitle, info?.profile?.company]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={speaker.id} className="flex items-center gap-4">
            {info ? (
              <SpeakerPhoto
                speaker={info}
                photo={info.profile?.photo}
                className="size-14 text-base"
              />
            ) : (
              <Avatar name={speaker.name} className="size-14 text-base" />
            )}
            <div className="min-w-0">
              <Link
                href={speakerHref(speaker.slug)}
                className="font-semibold hover:underline"
              >
                {speaker.name}
              </Link>
              {speaker.role !== "speaker" && (
                <p className="text-sm text-muted">
                  {PUBLIC_SPEAKER_ROLE_LABELS[speaker.role]}
                </p>
              )}
              {headline && <p className="text-sm text-muted">{headline}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
