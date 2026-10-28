"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Alert, Button, Card, TextAreaField, TextField } from "@/src/core/ui";
import { SPEAKER_PHOTO_MAX_BYTES, SPEAKER_PHOTO_TYPES } from "../constants";
import { speakerHref } from "../routes";
import {
  updateOwnSpeakerProfileBodySchema,
  type OwnSpeakerProfileDto,
  type UpdateOwnSpeakerProfileBody,
  type UpdateOwnSpeakerProfileInput,
} from "../schemas/speaker.schemas";
import {
  BIO_MAX_LENGTH,
  fillValues,
  friendlyError,
  linkError,
  photoFileError,
  toFormValues,
} from "../utils/own-profile-form";
import { OWN_SPEAKER_PROFILE_SAMPLE } from "../utils/own-profile.sample";
import { SpeakerPhoto } from "./SpeakerPhoto";
import { SpeakerProfilePreview } from "./SpeakerProfilePreview";
import { SpeakerProfileTitle } from "./SpeakerProfileStates";
import { SpeakerTopicsField } from "./SpeakerTopicsField";

/** "image/jpeg" -> "JPG", for the hint under the photo. */
const PHOTO_TYPE_LABEL: Record<(typeof SPEAKER_PHOTO_TYPES)[number], string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WebP",
};
const PHOTO_HINT = `${SPEAKER_PHOTO_TYPES.map((type) => PHOTO_TYPE_LABEL[type]).join(", ")}, up to ${SPEAKER_PHOTO_MAX_BYTES / (1024 * 1024)} MB.`;

type SpeakerProfileFormProps = {
  /** The speaker's saved profile (GET /api/me/speaker-profile). Default: sample data. */
  initialValues?: OwnSpeakerProfileDto;
  /**
   * Called with the parsed PATCH body when a valid form is sent. Without it the form only shows
   * "Sample data: nothing was sent to the server". Reject (throw) to show a save error.
   */
  onSubmit?: (body: UpdateOwnSpeakerProfileBody) => void | Promise<void>;
  /**
   * Called with the chosen photo when the form is saved, before `onSubmit` (POST
   * /api/me/speaker-profile/photo). Reject (throw) to show an upload error. Without it the photo
   * cannot be changed.
   */
  onUploadPhoto?: (file: File) => void | Promise<void>;
};

type Outcome =
  | { kind: "sample" }
  | { kind: "saved" }
  | { kind: "unchanged" }
  | { kind: "failed"; title: string; message: string };

/**
 * "Edit my profile": the speaker edits their own public profile. The fields and the validation
 * are the ones of PATCH /api/me/speaker-profile (updateOwnSpeakerProfileBodySchema), so what the
 * form accepts is what the server accepts. A chosen photo is only previewed until the form is
 * saved; Discard drops it.
 */
export function SpeakerProfileForm({
  initialValues = OWN_SPEAKER_PROFILE_SAMPLE,
  onSubmit,
  onUploadPhoto,
}: SpeakerProfileFormProps) {
  const defaults = toFormValues(initialValues);
  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    trigger,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<
    UpdateOwnSpeakerProfileInput,
    unknown,
    UpdateOwnSpeakerProfileBody
  >({
    resolver: zodResolver(updateOwnSpeakerProfileBodySchema),
    defaultValues: defaults,
  });
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const values = fillValues(useWatch({ control }));

  // The chosen photo: only previewed here, uploaded when the form is saved.
  const photoInput = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string>();
  const previewUrl = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : null),
    [photoFile],
  );
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset the input, so choosing the same file again still fires a change.
    event.target.value = "";
    if (!file) return;
    const error = photoFileError(file);
    setPhotoError(error);
    // A refused file leaves an earlier valid choice as it was.
    if (!error) {
      setPhotoFile(file);
      setOutcome(null);
    }
  };

  const send = async (body: UpdateOwnSpeakerProfileBody) => {
    setOutcome(null);
    if (!onSubmit) {
      setOutcome({ kind: "sample" });
      return;
    }
    if (!isDirty && !photoFile) {
      setOutcome({ kind: "unchanged" });
      return;
    }

    // Photo first, then the details: each is its own request, so say which one failed.
    let photoUploaded = false;
    try {
      if (photoFile && onUploadPhoto) {
        await onUploadPhoto(photoFile);
        photoUploaded = true;
        setPhotoFile(null);
      }
      if (isDirty) {
        await onSubmit(body);
        // The saved values are the new starting point: nothing is "changed" any more.
        reset(fillValues(getValues()));
      }
      setOutcome({ kind: "saved" });
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : "Please try again in a minute.";
      setOutcome(
        photoUploaded
          ? {
              kind: "failed",
              title: "Photo updated, but your details were not saved",
              message: reason,
            }
          : {
              kind: "failed",
              title: photoFile
                ? "We couldn't upload your photo"
                : "We couldn't save your profile",
              message:
                photoFile && isDirty
                  ? `${reason} Your other changes were not saved either.`
                  : reason,
            },
      );
    }
  };

  const discard = () => {
    reset(defaults);
    setPhotoFile(null);
    setPhotoError(undefined);
    setOutcome(null);
  };

  const topicsError =
    errors.expertise?.message ?? errors.expertise?.root?.message;

  return (
    <form
      noValidate
      onSubmit={handleSubmit(send)}
      className="mx-auto max-w-6xl space-y-5"
    >
      <SpeakerProfileTitle>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={speakerHref(initialValues.slug)}
            className="text-sm font-semibold text-link hover:underline"
          >
            View public page
          </Link>
          <Button
            variant="secondary"
            disabled={!isDirty && !photoFile}
            onClick={discard}
          >
            Discard changes
          </Button>
          <Button type="submit" isPending={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </SpeakerProfileTitle>

      {outcome?.kind === "sample" && (
        <Alert tone="info" title="Sample data: nothing was sent to the server">
          The form is valid. Saving to your real profile is not connected yet.
        </Alert>
      )}
      {outcome?.kind === "saved" && (
        <Alert tone="success" title="Profile saved">
          Your public page shows the new details.
        </Alert>
      )}
      {outcome?.kind === "unchanged" && (
        <Alert tone="info" title="No changes to save">
          Change a detail or choose a new photo first.
        </Alert>
      )}
      {outcome?.kind === "failed" && (
        <Alert tone="error" title={outcome.title}>
          {outcome.message}
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-5">
          <Card
            title="Basic information"
            description="Your name and photo help attendees recognise you."
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <SpeakerPhoto
                  speaker={initialValues}
                  photo={
                    previewUrl
                      ? {
                          url: previewUrl,
                          alt: "Preview of your new photo",
                          width: null,
                          height: null,
                        }
                      : initialValues.photo
                  }
                  className="size-20 text-xl"
                />
                <div className="space-y-1.5">
                  <input
                    ref={photoInput}
                    type="file"
                    hidden
                    aria-label="Photo file"
                    accept={SPEAKER_PHOTO_TYPES.join(",")}
                    onChange={choosePhoto}
                  />
                  <Button
                    variant="secondary"
                    disabled={!onUploadPhoto || isSubmitting}
                    aria-describedby="speaker-photo-note"
                    onClick={() => photoInput.current?.click()}
                  >
                    {photoFile ? "Choose another photo" : "Upload new photo"}
                  </Button>
                  <p id="speaker-photo-note" className="text-xs text-muted">
                    {!onUploadPhoto
                      ? `Photo upload is not available here yet. When it is: ${PHOTO_HINT}`
                      : photoFile
                        ? `${photoFile.name} will replace your photo when you save.`
                        : PHOTO_HINT}
                  </p>
                  {photoError && (
                    <p role="alert" className="text-sm text-danger">
                      {photoError}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="First name"
                  autoComplete="given-name"
                  error={friendlyError(errors.firstName?.message, 100)}
                  {...register("firstName")}
                />
                <TextField
                  label="Last name"
                  autoComplete="family-name"
                  error={friendlyError(errors.lastName?.message, 100)}
                  {...register("lastName")}
                />
                <TextField
                  label="Job title"
                  optional
                  autoComplete="organization-title"
                  error={friendlyError(errors.jobTitle?.message, 100)}
                  {...register("jobTitle")}
                />
                <TextField
                  label="Company"
                  optional
                  autoComplete="organization"
                  error={friendlyError(errors.company?.message, 120)}
                  {...register("company")}
                />
              </div>

              <TextAreaField
                label="Short bio"
                rows={6}
                hint={
                  <span className="flex flex-wrap justify-between gap-x-4">
                    <span>
                      Plain text. Write in the third person and leave a blank
                      line between paragraphs.
                    </span>
                    <span>
                      {values.bio.length} / {BIO_MAX_LENGTH}
                    </span>
                  </span>
                }
                error={friendlyError(errors.bio?.message, BIO_MAX_LENGTH)}
                {...register("bio")}
              />
            </div>
          </Card>

          <Card
            title="Expertise"
            description="Topics are used to recommend your sessions to attendees."
          >
            <Controller
              control={control}
              name="expertise"
              render={({ field }) => (
                <SpeakerTopicsField
                  value={field.value ?? []}
                  error={topicsError}
                  onChange={(topics) => {
                    field.onChange(topics);
                    // Tell about the 11th topic right away, not only when saving.
                    void trigger("expertise");
                  }}
                />
              )}
            />
          </Card>

          <Card
            title="Links"
            description="Optional. Shown as links on your public profile."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Website"
                type="url"
                autoComplete="url"
                placeholder="https://"
                error={linkError(errors.websiteUrl?.message)}
                {...register("websiteUrl")}
              />
              <TextField
                label="LinkedIn"
                type="url"
                autoComplete="off"
                placeholder="https://linkedin.com/in/"
                error={linkError(errors.linkedinUrl?.message)}
                {...register("linkedinUrl")}
              />
              <TextField
                label="X / Twitter"
                type="url"
                autoComplete="off"
                placeholder="https://x.com/"
                error={linkError(errors.twitterUrl?.message)}
                {...register("twitterUrl")}
              />
            </div>
          </Card>
        </div>

        <SpeakerProfilePreview values={values} />
      </div>
    </form>
  );
}
