import { formatDate } from "@/src/core/format/format-date";
import type { TimelineItem } from "@/src/core/ui";
import type {
  OrganizerDetailDto,
  OrganizerReviewStatus,
} from "../schemas/organizer.schemas";

/** Wording the admin can pick instead of typing; the reason box is filled in and can be edited. */
export const COMMON_REJECTION_REASONS = [
  {
    value: "unverified",
    label: "Organisation could not be verified",
    text: "We could not verify your organisation. Please reply with a website or a registration document that shows it is an events organisation.",
  },
  {
    value: "duplicate",
    label: "Duplicate application",
    text: "An organizer account already exists for this organisation. Please ask them to add you instead of applying again.",
  },
  {
    value: "not-events",
    label: "Not an events organisation",
    text: "EventSphere is for organisations that run events. Your application does not look like one.",
  },
] as const;

export type CheckState = "pass" | "fail" | "manual";

export type ReviewCheck = {
  key: string;
  state: CheckState;
  title: string;
  detail: string;
};

/**
 * The things an admin looks at before approving, worked out from the application. Only the first
 * one blocks approving (the API refuses an applicant whose email is not verified); the rest tell
 * the admin what to look at. A "manual" check is one EventSphere cannot do for them.
 */
export function buildChecks(review: OrganizerDetailDto): ReviewCheck[] {
  const { applicant } = review;

  const accountProblems: string[] = [];
  if (applicant.accountStatus === "suspended") {
    accountProblems.push("The account is suspended.");
  }
  if (applicant.accountStatus === "pending") {
    accountProblems.push("The account has not been set up yet.");
  }

  return [
    applicant.emailVerifiedAt
      ? {
          key: "email",
          state: "pass",
          title: "Email address verified",
          detail: `The applicant confirmed ${applicant.email}.`,
        }
      : {
          key: "email",
          state: "fail",
          title: "Email address not verified",
          detail:
            "The application cannot be approved until the applicant confirms their email.",
        },
    accountProblems.length === 0
      ? {
          key: "account",
          state: "pass",
          title: "Account is active",
          detail: "The account is set up and not suspended.",
        }
      : {
          key: "account",
          state: "fail",
          title: "Account needs a look",
          detail: accountProblems.join(" "),
        },
    review.hasDuplicate
      ? {
          key: "duplicate",
          state: "fail",
          title: "Possible duplicate organisation",
          detail: "Another organizer already uses this name or website.",
        }
      : {
          key: "duplicate",
          state: "pass",
          title: "No duplicate organisation",
          detail: "No existing organizer uses this name or website.",
        },
    review.organizationWebsite
      ? {
          key: "website",
          state: "manual",
          title: "Website needs a manual check",
          detail:
            "Open the site and confirm it belongs to the organisation. EventSphere does not check this automatically.",
        }
      : {
          key: "website",
          state: "manual",
          title: "No website given",
          detail:
            "Ask for one if you need more proof that the organisation is real.",
        },
  ];
}

/** Approving needs a verified email (the API says 409 otherwise) and a waiting application. */
export function canApprove(review: {
  status: OrganizerReviewStatus;
  applicant: { emailVerifiedAt: string | null };
}): boolean {
  return (
    review.status === "pending" && review.applicant.emailVerifiedAt !== null
  );
}

/** The application's story, newest first: the decision (or the wait for it), then what led to it. */
export function buildHistory(review: OrganizerDetailDto): TimelineItem[] {
  const items: TimelineItem[] = [];

  if (review.status === "pending") {
    items.push({
      title: "Waiting for admin decision",
      detail: "Applicants can’t create events until approved",
    });
  } else if (review.status === "verified") {
    items.push({
      title: "Approved",
      detail: review.approvedAt
        ? formatDate(review.approvedAt, "long")
        : undefined,
      done: true,
    });
  } else {
    items.push({
      title: "Rejected",
      detail: [
        review.rejectedAt ? formatDate(review.rejectedAt, "long") : null,
        review.rejectionReason,
      ]
        .filter(Boolean)
        .join(" · "),
      done: true,
    });
  }

  if (review.applicant.emailVerifiedAt) {
    items.push({
      title: "Email verified",
      detail: formatDate(review.applicant.emailVerifiedAt, "long"),
      done: true,
    });
  }
  items.push({
    title: "Application submitted",
    detail: `${formatDate(review.appliedAt, "long")} · from the organizer sign-up form`,
    done: true,
  });

  return items;
}
