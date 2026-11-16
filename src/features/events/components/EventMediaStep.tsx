"use client";

import { useIsMutating } from "@tanstack/react-query";
import { ImagePlus, Trash2, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ChangeEvent } from "react";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { formatFileSize } from "@/src/core/format/format-file-size";
import { Alert, Button, buttonStyles, Card } from "@/src/core/ui";
import {
  EVENT_GALLERY_BATCH_MAX_BYTES,
  EVENT_GALLERY_MAX_IMAGES,
} from "../constants";
import { eventMutationKeys } from "../hooks/event-cache";
import { useAddGalleryImages } from "../hooks/useAddGalleryImages";
import { useDeleteEventCover } from "../hooks/useDeleteEventCover";
import { useDeleteGalleryImage } from "../hooks/useDeleteGalleryImage";
import { useGetEventContent } from "../hooks/useGetEventContent";
import { useUploadEventCover } from "../hooks/useUploadEventCover";
import { eventEditHref, eventHref } from "../routes";
import type { EventMediaDto } from "../schemas/event-content.schemas";
import { plural } from "../utils/event-display";
import {
  addToGallerySelection,
  eventImageFileError,
  EVENT_GALLERY_HINT,
  EVENT_IMAGE_ACCEPT,
  EVENT_IMAGE_HINT,
} from "../utils/event-image-file";

/**
 * Step 3: the cover image and the gallery. Unlike the other steps there is no Save: each upload
 * or removal is its own request and is saved at once. "Finish" only leaves for the overview.
 */
export function EventMediaStep({ eventId }: { eventId: string }) {
  const content = useGetEventContent(eventId);
  // Any upload or removal of this event's images that is still running (the cover and the
  // gallery are separate cards, so the parent asks React Query instead of being told).
  const isUploading =
    useIsMutating({ mutationKey: eventMutationKeys.media(eventId) }) > 0;

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
        {isUploading ? (
          // A link cannot be disabled, so a plain disabled button takes its place while an image
          // is on its way: leaving now would hide whether the upload worked. No spinner: the
          // upload's own button already shows the progress.
          <Button disabled title="Wait for the images to finish uploading">
            Finish
          </Button>
        ) : (
          <Link href={eventHref(eventId)} className={buttonStyles()}>
            Finish
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * A hidden file input with a button that opens it. `onFiles` gets what was chosen (one file, or
 * several with `multiple`); the card decides what to do with it.
 */
function ImagePicker({
  label,
  disabled,
  isPending,
  multiple = false,
  onFiles,
  variant = "secondary",
}: {
  label: string;
  disabled?: boolean;
  isPending?: boolean;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  variant?: "primary" | "secondary";
}) {
  const input = useRef<HTMLInputElement>(null);

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    // Reset the input, so choosing the same file again still fires a change.
    event.target.value = "";
    if (files.length > 0) onFiles(files);
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept={EVENT_IMAGE_ACCEPT}
        multiple={multiple}
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

  function chooseCover([file]: File[]) {
    const message = eventImageFileError(file);
    setClientError(message);
    if (message) return;
    upload.reset();
    remove.reset();
    upload.mutate(file);
  }

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
            onFiles={chooseCover}
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
        {clientError && (
          <p role="alert" className="text-sm text-danger">
            {clientError}
          </p>
        )}
      </div>
    </Card>
  );
}

/**
 * The gallery: the images it holds, and a way to add more at once. "Add images" picks several
 * files (they are only listed, with how many and how big); "Upload N images" sends them all in
 * ONE request, and the list is cleared when they are saved. A failed upload keeps the list, so the
 * organizer can try again without choosing again.
 */
function GalleryCard({
  eventId,
  gallery,
}: {
  eventId: string;
  gallery: EventMediaDto[];
}) {
  const add = useAddGalleryImages(eventId);
  const remove = useDeleteGalleryImage(eventId);
  const [selected, setSelected] = useState<File[]>([]);
  const [clientError, setClientError] = useState<string>();

  const busy = add.isPending || remove.isPending;
  const room = EVENT_GALLERY_MAX_IMAGES - gallery.length;
  const full = room <= 0;
  const selectedBytes = selected.reduce((sum, file) => sum + file.size, 0);
  const serverError = add.error ?? remove.error;

  function pick(files: File[]) {
    const next = addToGallerySelection(selected, files, room);
    setSelected(next.files);
    setClientError(next.error);
    add.reset();
    remove.reset();
  }

  function unpick(file: File) {
    setSelected((current) => current.filter((item) => item !== file));
    setClientError(undefined);
  }

  function upload() {
    setClientError(undefined);
    add.mutate(selected, { onSuccess: () => setSelected([]) });
  }

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
                    disabled={busy}
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

        {selected.length > 0 && (
          <div className="space-y-2 rounded-md border border-line p-3">
            <p className="text-sm font-semibold" role="status">
              {plural(selected.length, "image")} selected ·{" "}
              {formatFileSize(selectedBytes)} of{" "}
              {formatFileSize(EVENT_GALLERY_BATCH_MAX_BYTES)}
            </p>
            <ul
              aria-label="Images selected for upload"
              className="divide-y divide-line text-sm"
            >
              {selected.map((file) => (
                <li
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                  className="flex items-center justify-between gap-3 py-1.5"
                >
                  <span className="min-w-0 truncate">{file.name}</span>
                  <span className="flex shrink-0 items-center gap-2 text-muted">
                    {formatFileSize(file.size)}
                    <button
                      type="button"
                      aria-label={`Remove ${file.name} from the selection`}
                      disabled={add.isPending}
                      onClick={() => unpick(file)}
                      className="rounded-md p-1.5 hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <X aria-hidden="true" className="size-4" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <ImagePicker
            label="Add images"
            multiple
            disabled={full || busy}
            onFiles={pick}
          />
          {selected.length > 0 && (
            <Button
              disabled={remove.isPending}
              isPending={add.isPending}
              onClick={upload}
            >
              {!add.isPending && (
                <Upload aria-hidden="true" className="size-4" />
              )}
              {add.isPending
                ? `Uploading ${plural(selected.length, "image")}…`
                : `Upload ${plural(selected.length, "image")}`}
            </Button>
          )}
          <span className="text-xs text-muted">
            {full
              ? `The gallery is full (${EVENT_GALLERY_MAX_IMAGES} images). Remove one to add another.`
              : EVENT_GALLERY_HINT}
          </span>
        </div>
        {clientError && (
          <p role="alert" className="text-sm text-danger">
            {clientError}
          </p>
        )}
      </div>
    </Card>
  );
}
