import { Ban, KeyRound, UserCheck } from "lucide-react";
import { formatDate } from "@/src/core/format/format-date";
import { Avatar, Badge, Button, Card, DescriptionList } from "@/src/core/ui";
import type { UserDetailDto } from "../schemas/users.schema";
import {
  adminActionsFor,
  ROLE_DESCRIPTIONS,
  roleBadge,
  statusBadge,
  userFullName,
} from "../utils/user-display";

type Actions = {
  onSuspend: () => void;
  onReactivate: () => void;
  /** Reactivating is running: its button shows it and cannot be pressed twice. */
  isReactivating: boolean;
};

/** Who this is: name, status, email, role, and the suspend / reactivate action. */
export function ProfileHeaderCard({
  user,
  onSuspend,
  onReactivate,
  isReactivating,
}: { user: UserDetailDto } & Actions) {
  const name = userFullName(user);
  const status = statusBadge(user.status);
  const role = roleBadge(user.role);
  const actions = adminActionsFor(user);

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={name} className="size-16 text-xl" />
        <div className="min-w-0 flex-1 basis-72">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl font-semibold">{name}</h2>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p className="break-words text-muted">{user.email}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={role.tone}>{role.label}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {actions.canSuspend && (
            <Button variant="danger" onClick={onSuspend}>
              <Ban aria-hidden="true" className="size-4" />
              Suspend
            </Button>
          )}
          {actions.canReactivate && (
            <Button
              variant="secondary"
              onClick={onReactivate}
              isPending={isReactivating}
            >
              <UserCheck aria-hidden="true" className="size-4" />
              {isReactivating ? "Reactivating…" : "Reactivate"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/** The account itself: id, email, password, when it was created. */
export function AccountCard({ user }: { user: UserDetailDto }) {
  return (
    <Card title="Account">
      <DescriptionList
        labelWidth="sm"
        items={[
          {
            label: "User ID",
            value: (
              <code className="break-all rounded border border-line bg-surface-subtle px-1.5 py-0.5 font-mono text-xs">
                {user.id}
              </code>
            ),
          },
          {
            label: "Email",
            value: user.emailVerifiedAt ? (
              <>
                <Badge tone="success">Verified</Badge>{" "}
                <span className="font-normal text-muted">
                  {formatDate(user.emailVerifiedAt)}
                </span>
              </>
            ) : (
              <Badge tone="warning">Not verified</Badge>
            ),
          },
          {
            label: "Password",
            value: user.hasPassword ? "Set by user" : "Not set yet",
          },
          { label: "Joined", value: formatDate(user.createdAt, "long") },
        ]}
      />
    </Card>
  );
}

/**
 * The role and what it allows. One role per user. Permissions come from the role: they are not
 * edited per user.
 */
export function RolesCard({ user }: { user: UserDetailDto }) {
  const role = roleBadge(user.role);
  return (
    <Card
      title="Role and permissions"
      description="Permissions come from the role. They are not edited per user."
    >
      <div className="space-y-3.5">
        <div className="flex justify-between gap-3">
          <div>
            <p className="font-semibold">{role.label}</p>
            <p className="text-sm text-muted">
              {user.role ? ROLE_DESCRIPTIONS[user.role] : "No role assigned"}
            </p>
          </div>
          <Badge tone="success">Assigned</Badge>
        </div>
        <div className="border-t border-line pt-3.5">
          <p className="mb-1.5 text-sm font-semibold">Effective permissions</p>
          {user.permissions.length === 0 ? (
            <p className="text-sm text-muted">None.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {user.permissions.map((permission) => (
                <li
                  key={permission}
                  className="rounded border border-line bg-surface-subtle px-1.5 py-0.5 font-mono text-xs"
                >
                  {permission}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

/** The actions on this account. What is offered follows the rules the server enforces. */
export function AdminActionsCard({
  user,
  onSuspend,
  onReactivate,
  isReactivating,
  onSendResetLink,
}: { user: UserDetailDto; onSendResetLink: () => void } & Actions) {
  const actions = adminActionsFor(user);
  const hasNothing =
    !actions.canSuspend &&
    !actions.canReactivate &&
    !actions.canSendResetLink &&
    !actions.resetLinkUnavailable;

  return (
    <Card title="Admin actions" flush>
      {(actions.canSendResetLink || actions.resetLinkUnavailable) && (
        <div className="space-y-2.5 p-5">
          {actions.canSendResetLink && (
            <Button
              variant="secondary"
              fullWidth
              className="justify-start"
              onClick={onSendResetLink}
            >
              <KeyRound aria-hidden="true" className="size-4" />
              Send password reset link
            </Button>
          )}
          {actions.resetLinkUnavailable && (
            <p className="text-sm text-muted">{actions.resetLinkUnavailable}</p>
          )}
        </div>
      )}
      {actions.canSuspend && (
        <div className="border-t border-line bg-danger-soft/40 p-5 first:border-t-0">
          <p className="font-semibold text-danger">Suspend account</p>
          <p className="mb-2.5 text-sm text-muted">
            Blocks future log-ins. Their registrations stay on record.
          </p>
          <Button variant="danger" onClick={onSuspend}>
            Suspend user
          </Button>
        </div>
      )}
      {actions.canReactivate && (
        <div className="border-t border-line p-5">
          <p className="font-semibold">Account suspended</p>
          <p className="mb-2.5 text-sm text-muted">
            {user.firstName} cannot log in. Reactivate to let them back in.
          </p>
          <Button
            variant="secondary"
            onClick={onReactivate}
            isPending={isReactivating}
          >
            {isReactivating ? "Reactivating…" : "Reactivate user"}
          </Button>
        </div>
      )}
      {hasNothing && (
        <p className="p-5 text-sm text-muted">
          An administrator&apos;s account cannot be suspended or sent a reset
          link.
        </p>
      )}
    </Card>
  );
}
