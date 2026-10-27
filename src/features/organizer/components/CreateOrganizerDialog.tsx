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
  createOrganizerFormSchema,
  type CreateOrganizerBody,
  type CreateOrganizerFormValues,
} from "../schemas/organizer.schemas";

type CreateOrganizerDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Gets the body the API takes (a blank website is already left out). */
  onSubmit: (body: CreateOrganizerBody) => void;
  /** The request is running: the button shows it and cannot be pressed twice. */
  isPending: boolean;
  /** Why the last attempt failed; the dialog stays open so the admin can fix it and try again. */
  error: ApiError | null;
};

/**
 * ADM-1: the admin creates an organizer account. The organizer gets an email with a link to set
 * their own password, so there is no password to type here.
 */
export function CreateOrganizerDialog({
  open,
  onClose,
  onSubmit,
  isPending,
  error,
}: CreateOrganizerDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title="Create an organizer">
      {/* Mounted only while open (and so is the form): the fields start empty each time. */}
      <CreateOrganizerForm
        onClose={onClose}
        onSubmit={onSubmit}
        isPending={isPending}
        error={error}
      />
    </Dialog>
  );
}

function CreateOrganizerForm({
  onClose,
  onSubmit,
  isPending,
  error,
}: Omit<CreateOrganizerDialogProps, "open">) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateOrganizerFormValues>({
    resolver: zodResolver(createOrganizerFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      organizationName: "",
      organizationWebsite: "",
    },
  });

  // What the server said about one field: a 400 names the field, a taken email is a 409.
  const fromServer = (field: keyof CreateOrganizerFormValues) =>
    error?.fieldErrors[field]?.[0] ??
    (field === "email" && error?.code === "EMAIL_TAKEN"
      ? error.message
      : undefined);
  // Anything that is not about one field goes in the box on top.
  const generalError =
    error &&
    error.code !== "EMAIL_TAKEN" &&
    Object.keys(error.fieldErrors).length === 0
      ? error.message
      : undefined;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) =>
        onSubmit({
          ...values,
          organizationWebsite: values.organizationWebsite || undefined,
        }),
      )}
    >
      <DialogBody>
        {generalError && (
          <Alert tone="error" title="We couldn't create this organizer">
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
        <TextField
          label="Organisation name"
          autoComplete="off"
          error={
            errors.organizationName?.message ?? fromServer("organizationName")
          }
          readOnly={isPending}
          {...register("organizationName")}
        />
        <TextField
          label="Organisation website"
          optional
          type="url"
          autoComplete="off"
          placeholder="https://acme.com"
          error={
            errors.organizationWebsite?.message ??
            fromServer("organizationWebsite")
          }
          readOnly={isPending}
          {...register("organizationWebsite")}
        />
        <p className="flex gap-2.5 rounded-md bg-info-soft px-3 py-2.5 text-sm text-info">
          <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            We email a link to set a password. They set their own password, then
            you approve the application.
          </span>
        </p>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" isPending={isPending}>
          {isPending ? "Creating…" : "Create organizer"}
        </Button>
      </DialogFooter>
    </form>
  );
}
