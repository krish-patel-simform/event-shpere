"use client";

import { useIsMutating } from "@tanstack/react-query";
import { ImagePlus } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ChangeEvent } from "react";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { Alert, Button, buttonStyles, Card } from "@/src/core/ui";
import { sessionMutationKeys } from "../hooks/session-cache";
import { useDeleteSessionCover } from "../hooks/useDeleteSessionCover";
import { useGetSessionContent } from "../hooks/useGetSessionContent";
import { useUploadSessionCover } from "../hooks/useUploadSessionCover";
import type { SessionContentDto } from "../schemas/session-content.schemas";
import {
  SESSION_COVER_ACCEPT,
  SESSION_COVER_HINT,
  sessionCoverFileError,
} from "../utils/session-cover-file";

/**
 * Step 4: the cover image. There is no Save: an upload or a removal is its own request and is
 * saved at once. "Finish" only leaves for the sessions list. A cover is optional.
 */
export function SessionCoverStep({
  eventId,
  sessionId,
  backHref,
  finishHref,
}: {
  eventId: string;
  sessionId: string;
  /** Where "Back" goes: the content step. */
  backHref: string;
  /** Where "Finish" goes: the event's sessions. */
  finishHref: string;
}) {
  const content = useGetSessionContent(eventId, sessionId);
  // An upload or removal of this session's cover that is still running.
  const isUploading =
    useIsMutating({
      mutationKey: sessionMutationKeys.media(eventId, sessionId),
    }) > 0;

  if (content.isPending) {
    return (
      <div
        role="status"
        aria-label="Loading the cover image"
        className="animate-pulse space-y-4 motion-reduce:animate-none"
      >
        <div className="h-56 rounded-lg bg-surface-subtle" />
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
          title={
            notFound ? "Session not found" : "We couldn't load the cover image"
          }
        >
          {notFound
            ? "It may have been removed, or it is not in one of your events."
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

  return (
    <div className="space-y-5">
      <CoverCard
        eventId={eventId}
        sessionId={sessionId}
        cover={content.data.coverImage}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={backHref}
          className={buttonStyles({ variant: "secondary" })}
        >
          Back
        </Link>
        {isUploading ? (
          // A link cannot be disabled, so a plain disabled button takes its place while the image
          // is on its way: leaving now would hide whether the upload worked.
          <Button disabled title="Wait for the image to finish uploading">
            Finish
          </Button>
        ) : (
          <Link href={finishHref} className={buttonStyles()}>
            Finish
          </Link>
        )}
      </div>
    </div>
  );
}

function CoverCard({
  eventId,
  sessionId,
  cover,
}: {
  eventId: string;
  sessionId: string;
  cover: SessionContentDto["coverImage"];
}) {
  const upload = useUploadSessionCover(eventId, sessionId);
  const remove = useDeleteSessionCover(eventId, sessionId);
  const input = useRef<HTMLInputElement>(null);
  const [clientError, setClientError] = useState<string>();
  const busy = upload.isPending || remove.isPending;
  const serverError = upload.error ?? remove.error;

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const [file] = Array.from(event.target.files ?? []);
    // Reset the input, so choosing the same file again still fires a change.
    event.target.value = "";
    if (!file) return;

    const message = sessionCoverFileError(file);
    setClientError(message);
    if (message) return;
    upload.reset();
    remove.reset();
    upload.mutate(file);
  }

  return (
    <Card
      title="Cover image"
      description="Shown at the top of the session page. Optional."
    >
      <div className="space-y-4">
        {serverError && (
          <Alert tone="error" title="The cover image could not be saved">
            {serverError.message}
          </Alert>
        )}
        {cover ? (
          // A plain <img>: the picture comes from the CMS host, which next/image would have to be
          // configured for.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.url}
            alt={cover.alt ?? "Session cover"}
            width={cover.width ?? undefined}
            height={cover.height ?? undefined}
            className="aspect-[16/6] w-full rounded-md border border-line object-cover"
          />
        ) : (
          <div className="grid aspect-[16/6] w-full place-items-center rounded-md border border-dashed border-field bg-surface-subtle text-sm text-muted">
            No cover image yet. A placeholder is shown until you add one.
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={input}
            type="file"
            accept={SESSION_COVER_ACCEPT}
            aria-label={cover ? "Replace cover" : "Upload cover"}
            tabIndex={-1}
            className="sr-only"
            onChange={choose}
          />
          <Button
            variant={cover ? "secondary" : "primary"}
            disabled={remove.isPending}
            isPending={upload.isPending}
            onClick={() => input.current?.click()}
          >
            {!upload.isPending && (
              <ImagePlus aria-hidden="true" className="size-4" />
            )}
            {upload.isPending
              ? "Uploading…"
              : cover
                ? "Replace cover"
                : "Upload cover"}
          </Button>
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
          <span className="text-xs text-muted">{SESSION_COVER_HINT}</span>
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
