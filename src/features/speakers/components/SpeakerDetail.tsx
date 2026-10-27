"use client";

import { Globe, Link as LinkIcon } from "lucide-react";
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
import { useGetSpeakerDetail } from "../hooks/useGetSpeakerDetail";
import { SPEAKER_ROUTES } from "../routes";
import type { SpeakerProfileDto } from "../schemas/speaker.schemas";
import {
  bioParagraphs,
  roleLine,
  speakerFullName,
} from "../utils/speaker-display";
import { SpeakerDetailSkeleton } from "./SpeakerDetailSkeleton";
import { SpeakerPhoto } from "./SpeakerPhoto";

const SPEAKERS_CRUMB = { label: "Speakers", href: SPEAKER_ROUTES.list };

/**
 * One speaker's page (GET /api/speakers/[slug]): the name from the database and the profile the
 * speaker keeps in the CMS (photo, role, topics, links, bio). The same page for every visitor.
 */
export function SpeakerDetail({ slug }: { slug: string }) {
  const detail = useGetSpeakerDetail(slug);

  if (detail.isPending) return <SpeakerDetailSkeleton />;

  if (detail.isError) {
    const notFound =
      detail.error instanceof ApiError && detail.error.status === 404;
    return (
      <PageFrame name="Speaker">
        {notFound ? (
          <Alert tone="warning" title="Speaker not found">
            This speaker does not exist, or is not listed any more.
            <Link
              href={SPEAKER_ROUTES.list}
              className={cn(buttonStyles({ variant: "secondary" }), "mt-3")}
            >
              Back to speakers
            </Link>
          </Alert>
        ) : (
          <Alert tone="error" title="We couldn't load this speaker">
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

  return <SpeakerView speaker={detail.data} />;
}

/** The breadcrumb, shared by the loading, error and loaded views. */
function PageFrame({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Breadcrumb items={[SPEAKERS_CRUMB, { label: name }]} />
      {children}
    </div>
  );
}

function SpeakerView({ speaker }: { speaker: SpeakerProfileDto }) {
  const name = speakerFullName(speaker);
  const { profile } = speaker;
  const role = profile ? roleLine(profile) : null;
  const paragraphs = profile ? bioParagraphs(profile.bio) : [];
  const links = profile
    ? [
        { label: "Website", href: profile.links.website, icon: Globe },
        { label: "LinkedIn", href: profile.links.linkedin, icon: LinkIcon },
        { label: "X / Twitter", href: profile.links.twitter, icon: LinkIcon },
      ].filter((link) => link.href !== null)
    : [];

  return (
    <PageFrame name={name}>
      <Card>
        <div className="flex flex-wrap items-center gap-6">
          <SpeakerPhoto
            speaker={speaker}
            photo={profile?.photo}
            className="size-28 text-3xl"
          />
          <div className="min-w-0 flex-1 basis-80">
            <h1 className="text-2xl font-semibold">{name}</h1>
            {role && <p className="text-lg text-muted">{role}</p>}
            {profile && profile.expertise.length > 0 && (
              <ul aria-label="Topics" className="mt-3 flex flex-wrap gap-2">
                {profile.expertise.map((topic) => (
                  <li
                    key={topic}
                    className="rounded bg-surface-subtle px-2.5 py-1 text-sm font-medium"
                  >
                    {topic}
                  </li>
                ))}
              </ul>
            )}
            {links.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {links.map(({ label, href, icon: Icon }) => (
                  <a
                    key={label}
                    href={href ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonStyles({ variant: "secondary" })}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                    {label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {profile ? (
        <Card title="About">
          {paragraphs.length > 0 ? (
            <div className="space-y-3">
              {paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          ) : (
            <p className="text-muted">This speaker has not added a bio yet.</p>
          )}
        </Card>
      ) : (
        // No CMS content right now: the name above still shows, the rest is "coming soon".
        <Alert tone="info" title="Profile coming soon">
          This speaker&apos;s profile is not available right now.
        </Alert>
      )}
    </PageFrame>
  );
}
