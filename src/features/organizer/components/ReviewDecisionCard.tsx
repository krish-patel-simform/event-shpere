"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId } from "react";
import { useForm } from "react-hook-form";
import { formatDate } from "@/src/core/format/format-date";
import { Alert, Button, Card, TextAreaField } from "@/src/core/ui";
import {
  REJECTION_REASON_MAX,
  rejectOrganizerBodySchema,
  type OrganizerReviewStatus,
  type RejectOrganizerBody,
} from "../schemas/organizer.schemas";
import { COMMON_REJECTION_REASONS } from "../utils/organizer-review";

type ReviewDecisionCardProps = {
  status: OrganizerReviewStatus;
  /** The applicant's first name, for the sentences. */
  firstName: string;
  /** The applicant verified their email: the API refuses to approve anyone who has not. */
  canApprove: boolean;
  /** When it was approved or rejected (ISO). */
  decidedAt: string | null;
  /** What the applicant was told; only for a rejected application. */
  rejectionReason: string | null;
  /** Asks for confirmation: the page opens the approve dialog. */
  onApprove: () => void;
  onReject: (reason: string) => void;
  /** The reject request is running: its button shows it and cannot be pressed twice. */
  isRejecting: boolean;
  /** Why the last reject failed; the form keeps what was typed. */
  rejectError: string | undefined;
  /** Puts a rejected application back in the queue. */
  onReconsider: () => void;
  isReconsidering: boolean;
  reconsiderError: string | undefined;
};

/**
 * The right-hand card: approve, or reject with a reason. Once decided it shows the outcome
 * instead (and a rejected application can be reconsidered).
 */
export function ReviewDecisionCard({
  status,
  firstName,
  canApprove,
  decidedAt,
  rejectionReason,
  onApprove,
  onReject,
  isRejecting,
  rejectError,
  onReconsider,
  isReconsidering,
  reconsiderError,
}: ReviewDecisionCardProps) {
  return (
    <Card title="Your decision" className="lg:sticky lg:top-4">
      {status === "pending" && (
        <div className="space-y-4">
          <div>
            <Button
              fullWidth
              onClick={onApprove}
              disabled={!canApprove}
              aria-describedby="approve-note"
            >
              Approve organizer
            </Button>
            <p id="approve-note" className="mt-1.5 text-sm text-muted">
              {canApprove
                ? `Adds the organizer role and emails ${firstName}. They can create events straight away.`
                : `${firstName} has not verified their email yet. Approve is available once they do.`}
            </p>
          </div>
          <div className="border-t border-line pt-4">
            <RejectForm
              firstName={firstName}
              onReject={onReject}
              isPending={isRejecting}
              error={rejectError}
            />
          </div>
        </div>
      )}

      {status === "verified" && (
        <Alert tone="success" title="Approved">
          {decidedAt ? `${formatDate(decidedAt, "long")}. ` : ""}
          {firstName} has the organizer role and can create events.
        </Alert>
      )}

      {status === "rejected" && (
        <div className="space-y-4">
          <Alert tone="error" title="Rejected">
            {decidedAt ? `${formatDate(decidedAt, "long")}. ` : ""}
            {rejectionReason && (
              <span className="block pt-1">
                Reason sent to {firstName}: {rejectionReason}
              </span>
            )}
          </Alert>
          {reconsiderError && (
            <Alert tone="error" title="We couldn't reconsider this application">
              {reconsiderError}
            </Alert>
          )}
          <div>
            <Button
              variant="secondary"
              fullWidth
              onClick={onReconsider}
              isPending={isReconsidering}
            >
              {isReconsidering ? "Reconsidering…" : "Reconsider application"}
            </Button>
            <p className="mt-1.5 text-sm text-muted">
              Puts it back in the queue so it can be approved or rejected again.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

function RejectForm({
  firstName,
  onReject,
  isPending,
  error,
}: {
  firstName: string;
  onReject: (reason: string) => void;
  isPending: boolean;
  error: string | undefined;
}) {
  const selectId = useId();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RejectOrganizerBody>({
    resolver: zodResolver(rejectOrganizerBodySchema),
    defaultValues: { reason: "" },
  });

  return (
    <form noValidate onSubmit={handleSubmit(({ reason }) => onReject(reason))}>
      <div className="space-y-3">
        {error && (
          <Alert tone="error" title="We couldn't reject this application">
            {error}
          </Alert>
        )}
        <div className="space-y-1.5">
          <label htmlFor={selectId} className="block text-sm font-semibold">
            Reject this application
          </label>
          <select
            id={selectId}
            defaultValue=""
            disabled={isPending}
            onChange={(event) => {
              // A common reason fills the box; the admin can still change the words.
              const picked = COMMON_REJECTION_REASONS.find(
                (reason) => reason.value === event.target.value,
              );
              if (picked) {
                setValue("reason", picked.text, { shouldValidate: true });
              }
            }}
            className="w-full rounded-md border border-field bg-surface px-3 py-2 text-sm"
          >
            <option value="">Choose a common reason (optional)</option>
            {COMMON_REJECTION_REASONS.map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </select>
        </div>
        <TextAreaField
          label="Reason shared with the applicant"
          placeholder="Explain what is missing or why the application cannot be approved."
          hint={`Required. Up to ${REJECTION_REASON_MAX} characters.`}
          error={errors.reason?.message}
          readOnly={isPending}
          {...register("reason")}
        />
        <Button type="submit" variant="danger" fullWidth isPending={isPending}>
          {isPending ? "Rejecting…" : "Reject application"}
        </Button>
        <p className="text-sm text-muted">
          {firstName} keeps their attendee account and receives this reason by
          email.
        </p>
      </div>
    </form>
  );
}
