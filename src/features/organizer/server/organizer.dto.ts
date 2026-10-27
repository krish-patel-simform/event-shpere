import "server-only";
import type { OrganizerProfile, RoleName, User } from "../../../db/schemas";
import type {
  CreateOrganizerResponseDto,
  OrganizerDetailDto,
  OrganizerListItemDto,
  OrganizerReviewStatus,
  OwnOrganizerApplicationDto,
  RejectOrganizerResponseDto,
  ReopenOrganizerResponseDto,
  VerifyOrganizerResponseDto,
} from "../schemas/organizer.schemas";

/** The application's status from its timestamps (the check constraint forbids both set). */
export function toOrganizerReviewStatus(row: {
  verifiedAt: Date | null;
  rejectedAt: Date | null;
}): OrganizerReviewStatus {
  if (row.verifiedAt) return "verified";
  if (row.rejectedAt) return "rejected";
  return "pending";
}

// Picks fields one by one: passwordHash, the verifier's user id and other internals never leave.
export function toOrganizerDto(
  user: User,
  profile: OrganizerProfile,
  setupEmailQueued: boolean,
): CreateOrganizerResponseDto {
  return {
    id: profile.id,
    userId: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    status: user.status,
    organizationName: profile.organizationName,
    organizationWebsite: profile.organizationWebsite,
    isVerified: profile.verifiedAt !== null,
    createdAt: profile.createdAt.toISOString(),
    setupEmailQueued,
  };
}

type OrganizerListRow = {
  id: string;
  organizerFirstName: string;
  organizerLastName: string;
  email: string;
  emailVerifiedAt: Date | null;
  accountStatus: User["status"];
  organizationName: string;
  organizationWebsite: string | null;
  appliedAt: Date;
  verifiedAt: Date | null;
  verifiedBy: string | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
};

export function toOrganizerListItemDto(
  row: OrganizerListRow,
): OrganizerListItemDto {
  return {
    id: row.id,
    organizerFirstName: row.organizerFirstName,
    organizerLastName: row.organizerLastName,
    email: row.email,
    // The admin only needs yes/no, not when.
    emailVerified: row.emailVerifiedAt !== null,
    accountStatus: row.accountStatus,
    organizationName: row.organizationName,
    organizationWebsite: row.organizationWebsite,
    appliedAt: row.appliedAt.toISOString(),
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    verifiedBy: row.verifiedBy,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
  };
}

type OrganizerDetailRow = {
  id: string;
  organizationName: string;
  organizationWebsite: string | null;
  appliedAt: Date;
  verifiedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  hasDuplicate: boolean;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerifiedAt: Date | null;
  accountStatus: User["status"];
  role: RoleName | null;
  userCreatedAt: Date;
};

// Picks fields one by one: passwordHash, the verifier's id and other internals never leave.
export function toOrganizerDetailDto(
  row: OrganizerDetailRow,
): OrganizerDetailDto {
  return {
    id: row.id,
    organizationName: row.organizationName,
    organizationWebsite: row.organizationWebsite,
    appliedAt: row.appliedAt.toISOString(),
    status: toOrganizerReviewStatus(row),
    approvedAt: row.verifiedAt?.toISOString() ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
    hasDuplicate: row.hasDuplicate,
    applicant: {
      userId: row.userId,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      emailVerifiedAt: row.emailVerifiedAt?.toISOString() ?? null,
      accountStatus: row.accountStatus,
      role: row.role,
      createdAt: row.userCreatedAt.toISOString(),
    },
  };
}

// A verified organizer: by now verifiedAt and verifiedBy are known to be set.
type VerifiedOrganizerRow = {
  organizerId: string;
  organizationName: string;
  organizerFirstName: string;
  organizerLastName: string;
  verifiedAt: Date;
  verifiedBy: string;
};

export function toVerifyOrganizerResponseDto(
  row: VerifiedOrganizerRow,
): VerifyOrganizerResponseDto {
  return {
    organizerId: row.organizerId,
    organizationName: row.organizationName,
    organizerFirstName: row.organizerFirstName,
    organizerLastName: row.organizerLastName,
    verifiedAt: row.verifiedAt.toISOString(),
    verifiedBy: row.verifiedBy,
  };
}

// A rejected organizer: by now the rejection fields are known to be set. No email here.
type RejectedOrganizerRow = {
  organizerId: string;
  organizationName: string;
  organizerFirstName: string;
  organizerLastName: string;
  rejectedAt: Date;
  rejectedBy: string;
  rejectionReason: string;
};

export function toRejectOrganizerResponseDto(
  row: RejectedOrganizerRow,
  rejectionEmailQueued: boolean,
): RejectOrganizerResponseDto {
  return {
    organizerId: row.organizerId,
    organizationName: row.organizationName,
    organizerFirstName: row.organizerFirstName,
    organizerLastName: row.organizerLastName,
    rejectedAt: row.rejectedAt.toISOString(),
    rejectedBy: row.rejectedBy,
    rejectionReason: row.rejectionReason,
    rejectionEmailQueued,
  };
}

export function toReopenOrganizerResponseDto(row: {
  organizerId: string;
  organizationName: string;
  organizerFirstName: string;
  organizerLastName: string;
}): ReopenOrganizerResponseDto {
  return {
    organizerId: row.organizerId,
    organizationName: row.organizationName,
    organizerFirstName: row.organizerFirstName,
    organizerLastName: row.organizerLastName,
    status: "pending",
  };
}

type OwnApplicationRow = {
  organizationName: string;
  organizationWebsite: string | null;
  appliedAt: Date;
  emailVerifiedAt: Date | null;
  verifiedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
};

export function toOwnOrganizerApplicationDto(
  row: OwnApplicationRow,
): OwnOrganizerApplicationDto {
  return {
    status: toOrganizerReviewStatus(row),
    organizationName: row.organizationName,
    organizationWebsite: row.organizationWebsite,
    appliedAt: row.appliedAt.toISOString(),
    emailVerifiedAt: row.emailVerifiedAt?.toISOString() ?? null,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
  };
}
