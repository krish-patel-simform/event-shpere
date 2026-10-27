"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  TextAreaField,
} from "@/src/core/ui";
import {
  REJECTION_REASON_MAX,
  rejectOrganizerBodySchema,
  type RejectOrganizerBody,
} from "@/src/features/organizer";
import type { PendingOrganizer } from "../../types/admin-overview";

type DecisionDialogProps = {
  /** The applicant the dialog is about; null = closed. */
  organizer: PendingOrganizer | null;
  onClose: () => void;
};

/** Approve: a plain confirmation that says what the applicant gets. */
export function ApproveOrganizerDialog({
  organizer,
  onClose,
  onConfirm,
}: DecisionDialogProps & { onConfirm: () => void }) {
  return (
    <Dialog
      open={organizer !== null}
      onClose={onClose}
      title={organizer ? `Approve ${organizer.organizationName}?` : "Approve"}
    >
      {organizer && (
        <>
          <DialogBody>
            <p>
              {organizer.organizerFirstName} {organizer.organizerLastName} will
              get the organizer role, and an email to set up their content
              access.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-muted">
              <li>They can create, edit and publish their own events.</li>
              <li>You can still suspend their account later.</li>
            </ul>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onConfirm}>Approve organizer</Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  );
}

/** Reject: the reason is required, because the applicant is emailed it and sees it on their dashboard. */
export function RejectOrganizerDialog({
  organizer,
  onClose,
  onConfirm,
}: DecisionDialogProps & { onConfirm: (reason: string) => void }) {
  return (
    <Dialog
      open={organizer !== null}
      onClose={onClose}
      title={organizer ? `Reject ${organizer.organizationName}?` : "Reject"}
    >
      {/* Mounted only while open (and so is the form): the reason starts empty each time. */}
      {organizer && (
        <RejectForm
          organizer={organizer}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      )}
    </Dialog>
  );
}

function RejectForm({
  organizer,
  onClose,
  onConfirm,
}: {
  organizer: PendingOrganizer;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RejectOrganizerBody>({
    resolver: zodResolver(rejectOrganizerBodySchema),
    defaultValues: { reason: "" },
  });

  return (
    <form noValidate onSubmit={handleSubmit(({ reason }) => onConfirm(reason))}>
      <DialogBody>
        <TextAreaField
          label="Reason shared with the applicant"
          placeholder="Explain what is missing or why the application cannot be approved."
          hint={`Up to ${REJECTION_REASON_MAX} characters.`}
          error={errors.reason?.message}
          {...register("reason")}
        />
        <p className="text-sm text-muted">
          {organizer.organizerFirstName} keeps their attendee account. The
          reason is emailed to them and shown on their dashboard. They are not
          told which admin made the decision.
        </p>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="danger">
          Reject application
        </Button>
      </DialogFooter>
    </form>
  );
}
