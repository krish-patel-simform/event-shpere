"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import type { ApiError } from "@/src/core/api-client/base-api.service";
import {
  Alert,
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  TextField,
} from "@/src/core/ui";
import {
  createSpeakerBodySchema,
  type CreateSpeakerBody,
} from "../schemas/speaker.schemas";

type CreateSpeakerDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: CreateSpeakerBody) => void;
  /** The request is running: the button shows it and cannot be pressed twice. */
  isPending: boolean;
  /** Why the last attempt failed; the dialog stays open so the form can be fixed and sent again. */
  error: ApiError | null;
};

/** Codes where the problem is the email itself: shown under that field, not in a box on top. */
const EMAIL_PROBLEMS = new Set(["EMAIL_TAKEN", "SPEAKER_EXISTS"]);

/**
 * Invite a speaker: name and email. The speaker gets an email with a link to set their own
 * password and then fills in their profile (photo, bio, links), so none of that is asked here.
 */
export function CreateSpeakerDialog({
  open,
  onClose,
  onSubmit,
  isPending,
  error,
}: CreateSpeakerDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title="Add a speaker">
      {/* Mounted only while open (and so is the form): the fields start empty each time. */}
      <CreateSpeakerForm
        onClose={onClose}
        onSubmit={onSubmit}
        isPending={isPending}
        error={error}
      />
    </Dialog>
  );
}

function CreateSpeakerForm({
  onClose,
  onSubmit,
  isPending,
  error,
}: Omit<CreateSpeakerDialogProps, "open">) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateSpeakerBody>({
    resolver: zodResolver(createSpeakerBodySchema),
    defaultValues: { firstName: "", lastName: "", email: "" },
  });

  // What the server said about one field: a 400 names the field, a used email is a 409.
  const fromServer = (field: keyof CreateSpeakerBody) =>
    error?.fieldErrors[field]?.[0] ??
    (field === "email" && error && EMAIL_PROBLEMS.has(error.code)
      ? error.message
      : undefined);
  // Anything that is not about one field goes in the box on top.
  const generalError =
    error &&
    !EMAIL_PROBLEMS.has(error.code) &&
    Object.keys(error.fieldErrors).length === 0
      ? error.message
      : undefined;

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)}>
      <DialogBody>
        {generalError && (
          <Alert tone="error" title="We couldn't add this speaker">
            {generalError}
          </Alert>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="First name"
            autoComplete="off"
            error={errors.firstName?.message ?? fromServer("firstName")}
            readOnly={isPending}
            {...register("firstName")}
          />
          <TextField
            label="Last name"
            autoComplete="off"
            error={errors.lastName?.message ?? fromServer("lastName")}
            readOnly={isPending}
            {...register("lastName")}
          />
        </div>
        <TextField
          label="Email address"
          type="email"
          autoComplete="off"
          placeholder="name@company.com"
          error={errors.email?.message ?? fromServer("email")}
          readOnly={isPending}
          {...register("email")}
        />
        <p className="flex gap-2.5 rounded-md bg-info-soft px-3 py-2.5 text-sm text-info">
          <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            We email a link to set a password. The speaker then fills in their
            own photo, bio and links.
          </span>
        </p>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" isPending={isPending}>
          {isPending ? "Adding…" : "Add speaker"}
        </Button>
      </DialogFooter>
    </form>
  );
}
