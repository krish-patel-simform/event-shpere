import { Mail } from "lucide-react";
import Link from "next/link";
import { Button } from "@/src/core/ui";
import type { SpeakerListItemDto } from "../schemas/speaker.schemas";
import { speakerHref } from "../routes";
import { roleLine, speakerFullName } from "../utils/speaker-display";
import { SpeakerPhoto } from "./SpeakerPhoto";

/** Topics shown on a card; the rest are on the profile. */
const MAX_TOPICS = 3;

/**
 * One speaker in the grid: photo, name, role and topics. The whole card opens the profile.
 * `onResendInvite` is given only to an admin: it adds a Resend invite button at the bottom.
 */
export function SpeakerCard({
  speaker,
  onResendInvite,
  isResendingInvite = false,
}: {
  speaker: SpeakerListItemDto;
  onResendInvite?: () => void;
  /** The invite is being sent: the button shows it and cannot be pressed twice. */
  isResendingInvite?: boolean;
}) {
  const { profile } = speaker;
  const role = profile ? roleLine(profile) : null;
  const topics = profile?.expertise.slice(0, MAX_TOPICS) ?? [];
  const moreTopics = (profile?.expertise.length ?? 0) - topics.length;

  return (
    <li className="relative flex flex-col items-center gap-1 rounded-lg border border-line bg-surface p-5 text-center hover:border-brand focus-within:border-brand">
      <SpeakerPhoto
        speaker={speaker}
        photo={profile?.photo}
        className="size-18 text-xl"
      />
      {/* The link covers the whole card (after:inset-0), so a click anywhere opens the profile. */}
      <Link
        href={speakerHref(speaker.slug)}
        className="mt-2 text-base font-semibold hover:underline after:absolute after:inset-0 after:content-['']"
      >
        {speakerFullName(speaker)}
      </Link>
      {profile ? (
        <>
          {role && <p className="text-sm text-muted">{role}</p>}
          {topics.length > 0 && (
            <ul
              aria-label="Topics"
              className="mt-2 flex flex-wrap justify-center gap-1.5"
            >
              {topics.map((topic) => (
                <li
                  key={topic}
                  className="rounded bg-surface-subtle px-2 py-0.5 text-xs font-medium"
                >
                  {topic}
                </li>
              ))}
              {moreTopics > 0 && (
                <li className="rounded bg-surface-subtle px-2 py-0.5 text-xs font-medium text-muted">
                  +{moreTopics}
                </li>
              )}
            </ul>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">Profile coming soon</p>
      )}
      {onResendInvite && (
        // relative z-10: above the link that covers the card, so this click is not a link click.
        <Button
          variant="secondary"
          onClick={onResendInvite}
          isPending={isResendingInvite}
          aria-label={`Resend invite to ${speakerFullName(speaker)}`}
          className="relative z-10 mt-3"
        >
          <Mail aria-hidden="true" className="size-4" />
          {isResendingInvite ? "Sending…" : "Resend invite"}
        </Button>
      )}
    </li>
  );
}
