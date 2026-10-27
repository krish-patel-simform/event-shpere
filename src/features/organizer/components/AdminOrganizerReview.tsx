"use client";

import Link from "next/link";
import { useLayoutEffect, useState, type ReactNode } from "react";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { formatDate } from "@/src/core/format/format-date";
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  buttonStyles,
  type BreadcrumbItem,
} from "@/src/core/ui";
import { useResendInvite } from "@/src/features/users";
import { useGetOrganizerDetail } from "../hooks/useGetOrganizerDetail";
import { useReopenOrganizer } from "../hooks/useReopenOrganizer";
import { useRejectOrganizer } from "../hooks/useRejectOrganizer";
import { useVerifyOrganizer } from "../hooks/useVerifyOrganizer";
import { ORGANIZER_ROUTES } from "../routes";
import type { OrganizerDetailDto } from "../schemas/organizer.schemas";
import type { PendingOrganizer } from "../types/admin-organizers";
import { STATUS_BADGES } from "../utils/organizer-display";
import { canApprove } from "../utils/organizer-review";
import { ApproveOrganizerDialog } from "./OrganizerDecisionDialogs";
import {
  ApplicantCard,
  ChecksCard,
  HistoryCard,
  OrganisationCard,
} from "./OrganizerReviewCards";
import { ReviewDecisionCard } from "./ReviewDecisionCard";

const ORGANIZERS_CRUMB: BreadcrumbItem = {
  label: "Organizers",
  href: ORGANIZER_ROUTES.list,
};

/**
 * The admin's page for one organizer application: the organisation, the applicant, what to check
 * before approving, the history, and the decision (approve, or reject with a reason; a rejected
 * one can be reconsidered). It loads the application from GET /api/admin/organizers/[id], and a
 * decision reloads it, so the page always shows what the server says.
 */
export function AdminOrganizerReview({
  organizerId,
  applicantProfileBase,
}: {
  organizerId: string;
  /**
   * The path of the users page (the users feature owns it, so the page gives it in): the link to
   * the applicant's profile is `${applicantProfileBase}/${userId}`. Left out, there is no link.
   */
  applicantProfileBase?: string;
}) {
  const detail = useGetOrganizerDetail(organizerId);

  if (detail.isPending) {
    return (
      <PageFrame crumb="Application">
        <div
          role="status"
          aria-label="Loading application"
          className="animate-pulse space-y-4 motion-reduce:animate-none"
        >
          <div className="h-28 rounded-lg bg-surface-subtle" />
          <div className="h-48 rounded-lg bg-surface-subtle" />
        </div>
      </PageFrame>
    );
  }

  if (detail.isError) {
    const notFound =
      detail.error instanceof ApiError && detail.error.status === 404;
    return (
      <PageFrame crumb="Application">
        {notFound ? (
          <Alert tone="warning" title="Application not found">
            This application does not exist, or was deleted.
            <Link
              href={ORGANIZER_ROUTES.list}
              className={buttonStyles({ variant: "secondary" }) + " mt-3"}
            >
              Back to organizers
            </Link>
          </Alert>
        ) : (
          <Alert tone="error" title="We couldn't load this application">
            {detail.error.message}
            <Button
              variant="secondary"
              onClick={() => void detail.refetch()}
              className="mt-3"
            >
              Try again
            </Button>
          </Alert>
        )}
      </PageFrame>
    );
  }

  return (
    <ReviewView
      review={detail.data}
      applicantProfileHref={
        applicantProfileBase
          ? `${applicantProfileBase}/${detail.data.applicant.userId}`
          : undefined
      }
    />
  );
}

/** The breadcrumb and the page title for the loading and error views. */
function PageFrame({
  crumb,
  children,
}: {
  crumb: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="space-y-2.5">
        <Breadcrumb items={[ORGANIZERS_CRUMB, { label: crumb }]} />
        <h1 className="text-2xl font-semibold">Organizer application</h1>
      </div>
      {children}
    </div>
  );
}

function ReviewView({
  review,
  applicantProfileHref,
}: {
  review: OrganizerDetailDto;
  applicantProfileHref: string | undefined;
}) {
  const [isApproving, setIsApproving] = useState(false);

  const verify = useVerifyOrganizer();
  const reject = useRejectOrganizer();
  const reopen = useReopenOrganizer();
  // One invite for every role: the users feature owns it (by user id).
  const resendInvite = useResendInvite();
  // The invite sent last: the message under the title says what happened.
  const [inviteSent, setInviteSent] = useState<boolean | null>(null);

  // Leaving the page hides it (React <Activity>) instead of unmounting it, so an open dialog
  // would still be open when the admin comes back. Close it as the page is hidden.
  useLayoutEffect(() => () => setIsApproving(false), []);

  const status = STATUS_BADGES[review.status];
  const { applicant } = review;

  // The same shape the Organizers list gives its approve dialog.
  const forDialog: PendingOrganizer = {
    id: review.id,
    organizerFirstName: applicant.firstName,
    organizerLastName: applicant.lastName,
    email: applicant.email,
    emailVerified: applicant.emailVerifiedAt !== null,
    organizationName: review.organizationName,
    organizationWebsite: review.organizationWebsite,
    appliedAt: review.appliedAt,
  };

  const closeApprove = () => {
    verify.reset();
    setIsApproving(false);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="space-y-2.5">
        <Breadcrumb
          items={[ORGANIZERS_CRUMB, { label: review.organizationName }]}
        />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              {review.organizationName}
            </h1>
            <p className="text-muted">
              Organizer application · applied {formatDate(review.appliedAt)}
            </p>
          </div>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
      </div>

      {inviteSent !== null &&
        (inviteSent ? (
          <Alert tone="success" title={`Invite sent to ${applicant.email}`}>
            The earlier link no longer works. They set a password from this one.
          </Alert>
        ) : (
          <Alert
            tone="warning"
            title="The new invite was saved, but the email was not sent"
          >
            We couldn&apos;t queue the email to {applicant.email}. Try again in
            a minute.
          </Alert>
        ))}
      {resendInvite.isError && (
        <Alert tone="error" title="We couldn't send the invite">
          {resendInvite.error.message}
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0 space-y-5">
          <OrganisationCard review={review} />
          <ApplicantCard
            review={review}
            profileHref={applicantProfileHref}
            onResendInvite={() => {
              setInviteSent(null);
              resendInvite.reset();
              resendInvite.mutate(applicant.userId, {
                onSuccess: (result) => setInviteSent(result.setupEmailQueued),
              });
            }}
            isResendingInvite={resendInvite.isPending}
          />
          <ChecksCard review={review} />
          <HistoryCard review={review} />
        </div>
        <ReviewDecisionCard
          status={review.status}
          firstName={applicant.firstName}
          canApprove={canApprove(review)}
          decidedAt={review.approvedAt ?? review.rejectedAt}
          rejectionReason={review.rejectionReason}
          onApprove={() => setIsApproving(true)}
          onReject={(reason) =>
            reject.mutate({ organizerId: review.id, body: { reason } })
          }
          isRejecting={reject.isPending}
          rejectError={reject.error?.message}
          onReconsider={() => reopen.mutate(review.id)}
          isReconsidering={reopen.isPending}
          reconsiderError={reopen.error?.message}
        />
      </div>

      <ApproveOrganizerDialog
        organizer={isApproving ? forDialog : null}
        isPending={verify.isPending}
        error={verify.error?.message}
        onClose={closeApprove}
        onConfirm={() => verify.mutate(review.id, { onSuccess: closeApprove })}
      />
    </div>
  );
}
