import { Avatar, cn } from "@/src/core/ui";
import type { SpeakerListItemDto } from "../schemas/speaker.schemas";
import { speakerFullName } from "../utils/speaker-display";

type Photo = NonNullable<SpeakerListItemDto["profile"]>["photo"];

/**
 * The speaker's photo from the CMS, or their initials when there is none. `className` sets the
 * size (e.g. "size-18").
 */
export function SpeakerPhoto({
  speaker,
  photo,
  className,
}: {
  speaker: { firstName: string; lastName: string };
  photo: Photo | undefined;
  className?: string;
}) {
  if (!photo) {
    return <Avatar name={speakerFullName(speaker)} className={className} />;
  }
  return (
    // A plain <img>: the photo comes from the CMS host, which next/image would have to be
    // configured for. The API only sends http(s) URLs.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.url}
      alt={photo.alt}
      width={photo.width ?? undefined}
      height={photo.height ?? undefined}
      loading="lazy"
      className={cn("shrink-0 rounded-full object-cover", className)}
    />
  );
}
