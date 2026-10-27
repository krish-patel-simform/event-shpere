"use client";

import { Alert, Button, Dialog, DialogBody, DialogFooter } from "@/src/core/ui";
import type { UserListItemDto } from "../schemas/users.schema";
import { userFullName } from "../utils/user-display";

/**
 * Suspend: a plain confirmation that says what it does. There is nothing to type: the API takes
 * no reason. `user` is the person the dialog is about; null = closed.
 */
export function SuspendUserDialog({
  user,
  onClose,
  onConfirm,
  isPending,
  error,
}: {
  user: Pick<UserListItemDto, "firstName" | "lastName"> | null;
  onClose: () => void;
  onConfirm: () => void;
  /** The request is running: the confirm button shows it and cannot be pressed twice. */
  isPending: boolean;
  /** Why the last attempt failed; the dialog stays open to try again. */
  error: string | undefined;
}) {
  return (
    <Dialog
      open={user !== null}
      onClose={onClose}
      title={user ? `Suspend ${userFullName(user)}?` : "Suspend user"}
    >
      {user && (
        <>
          <DialogBody>
            {error && (
              <Alert tone="error" title="We couldn't suspend this user">
                {error}
              </Alert>
            )}
            <p>
              {user.firstName} will not be able to log in, and every device they
              are signed in on is signed out. Their event registrations stay on
              record.
            </p>
            <p className="text-muted">You can reactivate them at any time.</p>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onConfirm} isPending={isPending}>
              {isPending ? "Suspending…" : "Suspend user"}
            </Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  );
}

/**
 * Send password reset link: a confirmation that says what the person gets. It is the same
 * one-time link and email as "forgot password". `user` is the person the dialog is about;
 * null = closed.
 */
export function SendResetLinkDialog({
  user,
  onClose,
  onConfirm,
  isPending,
  error,
}: {
  user: { firstName: string; lastName: string; email: string } | null;
  onClose: () => void;
  onConfirm: () => void;
  /** The request is running: the confirm button shows it and cannot be pressed twice. */
  isPending: boolean;
  /** Why the last attempt failed (e.g. a link was sent a moment ago); the dialog stays open. */
  error: string | undefined;
}) {
  return (
    <Dialog
      open={user !== null}
      onClose={onClose}
      title={
        user
          ? `Send a reset link to ${userFullName(user)}?`
          : "Send password reset link"
      }
    >
      {user && (
        <>
          <DialogBody>
            {error && (
              <Alert tone="error" title="We couldn't send the reset link">
                {error}
              </Alert>
            )}
            <p>
              We email <strong>{user.email}</strong> a one-time link to choose a
              new password. The link works once and expires soon.
            </p>
            <p className="text-muted">
              {user.firstName}&apos;s current password keeps working until they
              use the link. When they do, they are signed out everywhere.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onConfirm} isPending={isPending}>
              {isPending ? "Sending…" : "Send reset link"}
            </Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  );
}
