"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ChangeEvent } from "react";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { Alert, Button, buttonStyles, Card } from "@/src/core/ui";
import { EVENT_GALLERY_MAX_IMAGES } from "../constants";
import { useAddGalleryImage } from "../hooks/useAddGalleryImage";
import { useDeleteEventCover } from "../hooks/useDeleteEventCover";
import { useDeleteGalleryImage } from "../hooks/useDeleteGalleryImage";
import { useGetEventContent } from "../hooks/useGetEventContent";
import { useUploadEventCover } from "../hooks/useUploadEventCover";
import { eventEditHref, eventHref } from "../routes";
import type { EventMediaDto } from "../schemas/event-content.schemas";
import {
  eventImageFileError,
  EVENT_IMAGE_ACCEPT,
  EVENT_IMAGE_HINT,
} from "../utils/event-image-file";

/**
 * Step 3: the cover image and the gallery. Unlike the other steps there is no Save: each upload
 * or removal is its own request and is saved at once. "Finish" only leaves for the overview.
 */
export function EventMediaStep({ eventId }: { eventId: string }) {
  const content = useGetEventContent(eventId);

  if (content.isPending) {
    return (
      <div
        role="status"
        aria-label="Loading images"
        className="animate-pulse space-y-4 motion-reduce:animate-none"
      >
        <div className="h-56 rounded-lg bg-surface-subtle" />
        <div className="h-40 rounded-lg bg-surface-subtle" />
      </div>
    );
  }

  if (content.isError) {
    const notFound =
      content.error instanceof ApiError && content.error.status === 404;
    return (
      <div className="space-y-4">
        <Alert
          tone="error"
          title={notFound ? "Event not found" : "We couldn't load the images"}
        >
          {notFound
            ? "It may have been deleted, or it is not one of your events."
            : content.error.message}
        </Alert>
        {!notFound && (
          <Button variant="secondary" onClick={() => void content.refetch()}>
            Try again
          </Button>
        )}
      </div>
    );
  }

  const { coverImage, gallery } = content.data;
  return (
    <div className="space-y-5">
      <CoverCard eventId={eventId} cover={coverImage} />
      <GalleryCard eventId={eventId} gallery={gallery} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={eventEditHref(eventId, "content")}
          className={buttonStyles({ variant: "secondary" })}
        >
          Back
        </Link>
        <Link href={eventHref(eventId)} className={buttonStyles()}>
          Finish
        </Link>
      </div>
    </div>
  );
}

/**
 * A hidden file input with a button that opens it. `onFile` gets a file that passed the early
 * checks; a file that did not shows its message instead.
 */
function ImagePicker({
  label,
  disabled,
  isPending,
  onFile,
  clientError,
  setClientError,
  variant = "secondary",
}: {
  label: string;
  disabled?: boolean;
  isPending: boolean;
  onFile: (file: File) => void;
  clientError: string | undefined;
  setClientError: (message: string | undefined) => void;
  variant?: "primary" | "secondary";
}) {
  const input = useRef<HTMLInputElement>(null);

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset the input, so choosing the same file again still fires a change.
    event.target.value = "";
    if (!file) return;
    const message = eventImageFileError(file);
    setClientError(message);
    if (!message) onFile(file);
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept={EVENT_IMAGE_ACCEPT}
        aria-label={label}
        tabIndex={-1}
        className="sr-only"
        onChange={choose}
      />
      <Button
        variant={variant}
        disabled={disabled}
        isPending={isPending}
        onClick={() => input.current?.click()}
      >
        {!isPending && <ImagePlus aria-hidden="true" className="size-4" />}
        {isPending ? "Uploading…" : label}
      </Button>
      {clientError && (
        <p role="alert" className="text-sm text-danger">
          {clientError}
        </p>
      )}
    </>
  );
}

/** An image from the CMS host: a plain <img>, as next/image would need that host configured. */
function EventImage({
  media,
  fallbackAlt,
  className,
}: {
  media: EventMediaDto;
  fallbackAlt: string;
  className: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={media.url}
      alt={media.alt ?? fallbackAlt}
      width={media.width ?? undefined}
      height={media.height ?? undefined}
      loading="lazy"
      className={className}
    />
  );
}

function CoverCard({
  eventId,
  cover,
}: {
  eventId: string;
  cover: EventMediaDto | null;
}) {
  const upload = useUploadEventCover(eventId);
  const remove = useDeleteEventCover(eventId);
  const [clientError, setClientError] = useState<string>();
  const busy = upload.isPending || remove.isPending;
  const serverError = upload.error ?? remove.error;

  return (
    <Card
      title="Cover image"
      description="The banner at the top of the event page and on its card."
    >
      <div className="space-y-4">
        {serverError && (
          <Alert tone="error" title="The cover image could not be saved">
            {serverError.message}
          </Alert>
        )}
        {cover ? (
          <EventImage
            media={cover}
            fallbackAlt="Event cover"
            className="aspect-[16/6] w-full rounded-md border border-line object-cover"
          />
        ) : (
          <div className="grid aspect-[16/6] w-full place-items-center rounded-md border border-dashed border-field bg-surface-subtle text-sm text-muted">
            No cover image yet. A placeholder is shown until you add one.
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2.5">
          <ImagePicker
            label={cover ? "Replace cover" : "Upload cover"}
            variant={cover ? "secondary" : "primary"}
            disabled={remove.isPending}
            isPending={upload.isPending}
            clientError={clientError}
            setClientError={(message) => {
              setClientError(message);
              if (!message) {
                upload.reset();
                remove.reset();
              }
            }}
            onFile={(file) => upload.mutate(file)}
          />
          {cover && (
            <Button
              variant="secondary"
              disabled={busy}
              isPending={remove.isPending}
              onClick={() => {
                setClientError(undefined);
                remove.mutate();
              }}
            >
              {remove.isPending ? "Removing…" : "Remove cover"}
            </Button>
          )}
          <span className="text-xs text-muted">{EVENT_IMAGE_HINT}</span>
        </div>
      </div>
    </Card>
  );
}

function GalleryCard({
  eventId,
  gallery,
}: {
  eventId: string;
  gallery: EventMediaDto[];
}) {
  const add = useAddGalleryImage(eventId);
  const remove = useDeleteGalleryImage(eventId);
  const [clientError, setClientError] = useState<string>();
  const full = gallery.length >= EVENT_GALLERY_MAX_IMAGES;
  const serverError = add.error ?? remove.error;

  return (
    <Card
      title="Gallery"
      description={`Photos shown on the event page. ${gallery.length} of ${EVENT_GALLERY_MAX_IMAGES}.`}
    >
      <div className="space-y-4">
        {serverError && (
          <Alert tone="error" title="The gallery could not be saved">
            {serverError.message}
          </Alert>
        )}
        {gallery.length === 0 ? (
          <p className="text-muted">No gallery images yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {gallery.map((image, index) => {
              const removing =
                remove.isPending && remove.variables === image.id;
              return (
                <li
                  key={image.id}
                  className="relative overflow-hidden rounded-md border border-line"
                >
                  <EventImage
                    media={image}
                    fallbackAlt={`Gallery image ${index + 1}`}
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <Button
                    variant="secondary"
                    className="absolute right-2 top-2 px-2 py-2"
                    aria-label={`Remove gallery image ${index + 1}`}
                    disabled={remove.isPending || add.isPending}
                    isPending={removing}
                    onClick={() => {
                      setClientError(undefined);
                      add.reset();
                      remove.mutate(image.id);
                    }}
                  >
                    {!removing && (
                      <Trash2 aria-hidden="true" className="size-4" />
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2.5">
          <ImagePicker
            label="Add image"
            disabled={full || remove.isPending}
            isPending={add.isPending}
            clientError={clientError}
            setClientError={(message) => {
              setClientError(message);
              if (!message) {
                add.reset();
                remove.reset();
              }
            }}
            onFile={(file) => add.mutate(file)}
          />
          <span className="text-xs text-muted">
            {full
              ? `The gallery is full (${EVENT_GALLERY_MAX_IMAGES} images). Remove one to add another.`
              : EVENT_IMAGE_HINT}
          </span>
        </div>
      </div>
    </Card>
  );
}
