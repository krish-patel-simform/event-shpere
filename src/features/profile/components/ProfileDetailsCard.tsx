"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { roleLabel } from "@/src/core/auth/role-label";
import { Alert, Avatar, Badge, Button, Card, TextField } from "@/src/core/ui";
import {
  profileFormSchema,
  type ProfileFormValues,
} from "../schemas/profile.schemas";
import type { ProfileDetails } from "../types/profile";
import { SAMPLE_SAVED_NOTE } from "../utils/profile.sample";

type ProfileDetailsCardProps = {
  profile: ProfileDetails;
  /** False when the person may only look (no PROFILE_MANAGE): fields are read-only, no button. */
  canEdit: boolean;
  /** Gets the checked values. The default does nothing: nothing is sent to a server yet. */
  onSubmit?: (values: ProfileFormValues) => void | Promise<void>;
};

/** Name, role and email of the signed-in person, and the form to change their name. */
export function ProfileDetailsCard({
  profile,
  canEdit,
  onSubmit = () => undefined,
}: ProfileDetailsCardProps) {
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { firstName: profile.firstName, lastName: profile.lastName },
  });

  const fullName = `${profile.firstName} ${profile.lastName}`;

  const submit = handleSubmit(async (values) => {
    setSaved(false);
    setFailed(false);
    try {
      await onSubmit(values);
      setSaved(true);
    } catch {
      setFailed(true);
    }
  });

  return (
    <Card title="Profile" description="The name other people see">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={fullName} className="size-16 text-xl" />
          <div className="min-w-0 flex-1 basis-60">
            <p className="break-words text-lg font-semibold">{fullName}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge tone="brand">{roleLabel(profile.role)}</Badge>
              <span className="text-sm text-muted">
                Photo upload is not available yet. Your initials are used
                instead.
              </span>
            </div>
          </div>
        </div>

        <form noValidate onSubmit={submit} className="space-y-4">
          {saved && (
            <Alert tone="success" title={SAMPLE_SAVED_NOTE}>
              Your name stays as you typed it until you leave this page.
            </Alert>
          )}
          {failed && (
            <Alert tone="error" title="We couldn't save your profile">
              Nothing was changed. Try again in a moment.
            </Alert>
          )}
          {!canEdit && (
            <Alert tone="info">Your account cannot change these details.</Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="First name"
              autoComplete="given-name"
              error={errors.firstName?.message}
              readOnly={!canEdit || isSubmitting}
              {...register("firstName")}
            />
            <TextField
              label="Last name"
              autoComplete="family-name"
              error={errors.lastName?.message}
              readOnly={!canEdit || isSubmitting}
              {...register("lastName")}
            />
            <TextField
              label="Email address"
              type="email"
              defaultValue={profile.email}
              readOnly
              hint={
                <>
                  {profile.emailVerified && (
                    <Badge tone="success" className="mr-1.5">
                      Verified
                    </Badge>
                  )}
                  Your email cannot be changed here.
                </>
              }
              className="sm:col-span-2"
            />
          </div>
          {canEdit && (
            <div className="flex justify-end">
              <Button type="submit" isPending={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save profile"}
              </Button>
            </div>
          )}
        </form>
      </div>
    </Card>
  );
}
