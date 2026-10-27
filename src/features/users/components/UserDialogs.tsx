"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  TextAreaField,
  TextField,
} from "@/src/core/ui";
import { ACCOUNT_SETUP_TOKEN_TTL_HOURS } from "@/src/features/auth";
import {
  changeUserRoleBodySchema,
  INVITE_ROLES,
  inviteUserBodySchema,
  SUSPEND_REASON_MAX,
  suspendUserBodySchema,
  type ChangeUserRoleBody,
  type InviteUserBody,
  type SuspendUserBody,
} from "../../schemas/admin-users.schemas";
import type { AdminUser, UserRole } from "../../types/admin-users";
import { roleLabel } from "../../utils/role-label";
import { userFullName } from "../../utils/user-display";

type UserDialogProps = {
  /** The user the dialog is about; null = closed. */
  user: AdminUser | null;
  onClose: () => void;
};

// ---------------------------------------------------------------- Suspend

export function SuspendUserDialog({
  user,
  onClose,
  onConfirm,
}: UserDialogProps & { onConfirm: (body: SuspendUserBody) => void }) {
  return (
    <Dialog
      open={user !== null}
      onClose={onClose}
      title={user ? `Suspend ${userFullName(user)}?` : "Suspend user"}
    >
      {/* Mounted only while open (and so is the form): it starts empty each time. */}
      {user && (
        <SuspendForm user={user} onClose={onClose} onConfirm={onConfirm} />
      )}
    </Dialog>
  );
}

function SuspendForm({
  user,
  onClose,
  onConfirm,
}: {
  user: AdminUser;
  onClose: () => void;
  onConfirm: (body: SuspendUserBody) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SuspendUserBody>({
    resolver: zodResolver(suspendUserBodySchema),
    defaultValues: { reason: "", notifyUser: true },
  });

  return (
    <form noValidate onSubmit={handleSubmit(onConfirm)}>
      <DialogBody>
        <p>
          {user.firstName} will not be able to log in. Their event registrations
          stay on record.
        </p>
        <TextAreaField
          label="Reason"
          rows={3}
          hint={`Kept in the audit log. Up to ${SUSPEND_REASON_MAX} characters.`}
          error={errors.reason?.message}
          {...register("reason")}
        />
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4"
            {...register("notifyUser")}
          />
          <span>Email {user.firstName} to say the account was suspended</span>
        </label>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="danger">
          Suspend user
        </Button>
      </DialogFooter>
    </form>
  );
}

// ---------------------------------------------------------------- Change role

const ROLE_OPTIONS: readonly { role: UserRole; description: string }[] = [
  {
    role: "user",
    description:
      "Browse and register for events, build an agenda, vote in polls",
  },
  {
    role: "speaker",
    description: "Can edit their speaker profile and see their sessions",
  },
  {
    role: "organizer",
    description:
      "Create and publish events. Normally set by approving an application.",
  },
  {
    role: "admin",
    description: "Full platform access, including approvals and suspensions",
  },
];

export function ChangeRoleDialog({
  user,
  onClose,
  onConfirm,
}: UserDialogProps & { onConfirm: (body: ChangeUserRoleBody) => void }) {
  return (
    <Dialog
      open={user !== null}
      onClose={onClose}
      title={user ? `Change role for ${userFullName(user)}` : "Change role"}
    >
      {user && (
        <ChangeRoleForm user={user} onClose={onClose} onConfirm={onConfirm} />
      )}
    </Dialog>
  );
}

function ChangeRoleForm({
  user,
  onClose,
  onConfirm,
}: {
  user: AdminUser;
  onClose: () => void;
  onConfirm: (body: ChangeUserRoleBody) => void;
}) {
  const { register, handleSubmit, control } = useForm<ChangeUserRoleBody>({
    resolver: zodResolver(changeUserRoleBodySchema),
    defaultValues: { role: user.role },
  });
  const selected = useWatch({ control, name: "role" });

  return (
    <form noValidate onSubmit={handleSubmit(onConfirm)}>
      <DialogBody>
        <fieldset className="space-y-2">
          <legend className="sr-only">Role</legend>
          {ROLE_OPTIONS.map((option) => (
            <label
              key={option.role}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-line p-3 has-checked:border-brand has-checked:bg-brand-soft"
            >
              <input
                type="radio"
                value={option.role}
                className="mt-1 size-4"
                {...register("role")}
              />
              <span>
                <span className="block font-semibold">
                  {roleLabel(option.role)}
                </span>
                <span className="block text-xs text-muted">
                  {option.description}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <p className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2.5 text-sm text-warning">
          Changes apply the next time {user.firstName} opens EventSphere.
        </p>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        {/* Nothing to save until a different role is picked. */}
        <Button type="submit" disabled={selected === user.role}>
          Save role
        </Button>
      </DialogFooter>
    </form>
  );
}

// ---------------------------------------------------------------- Invite

export function InviteUserDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (body: InviteUserBody) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Invite a user">
      <InviteForm onClose={onClose} onConfirm={onConfirm} />
    </Dialog>
  );
}

function InviteForm({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (body: InviteUserBody) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InviteUserBody>({
    resolver: zodResolver(inviteUserBodySchema),
    defaultValues: { firstName: "", lastName: "", email: "", role: "speaker" },
  });

  return (
    <form noValidate onSubmit={handleSubmit(onConfirm)}>
      <DialogBody>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="First name"
            autoComplete="off"
            error={errors.firstName?.message}
            {...register("firstName")}
          />
          <TextField
            label="Last name"
            autoComplete="off"
            error={errors.lastName?.message}
            {...register("lastName")}
          />
        </div>
        <TextField
          label="Email address"
          type="email"
          autoComplete="off"
          placeholder="name@company.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <div className="space-y-1.5">
          <label htmlFor="invite-role" className="block text-sm font-semibold">
            Role
          </label>
          <select
            id="invite-role"
            className="w-full rounded-md border border-field bg-surface px-3 py-2 text-sm"
            {...register("role")}
          >
            {INVITE_ROLES.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </select>
        </div>
        <p className="flex gap-2.5 rounded-md bg-info-soft px-3 py-2.5 text-sm text-info">
          <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            We email a password setup link. It stays valid for{" "}
            {ACCOUNT_SETUP_TOKEN_TTL_HOURS} hours, then you can resend it.
          </span>
        </p>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Send invitation</Button>
      </DialogFooter>
    </form>
  );
}
