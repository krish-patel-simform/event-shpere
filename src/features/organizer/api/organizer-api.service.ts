// Calls to the admin organizer API, built on the shared axios instance. React Query hooks
// (../hooks) wrap these; components use the hooks.
import {
  apiRequest,
  apiRequestPage,
} from "../../../core/api-client/base-api.service";
import {
  createOrganizerResponseSchema,
  getOrganizersResponseSchema,
  organizerDetailResponseSchema,
  rejectOrganizerResponseSchema,
  reopenOrganizerResponseSchema,
  verifyOrganizerResponseSchema,
  type CreateOrganizerBody,
  type CreateOrganizerResponseDto,
  type OrganizerDetailDto,
  type OrganizerSort,
  type OrganizerVerificationFilter,
  type RejectOrganizerBody,
  type RejectOrganizerResponseDto,
  type ReopenOrganizerResponseDto,
  type VerifyOrganizerResponseDto,
} from "../schemas/organizer.schemas";

export type ListOrganizersParams = {
  /** Which list: waiting for a decision, approved or rejected. Left out = every organizer. */
  verification?: OrganizerVerificationFilter;
  /** Matches organisation, applicant name or email. An empty text means no search. */
  search?: string;
  /** Only applicants who did (true) or did not (false) confirm their email. */
  emailVerified?: boolean;
  /** By the date of the list: applied, approved or rejected. The server defaults to newest. */
  sort?: OrganizerSort;
  page?: number;
  pageSize: number;
};

export const organizerApiService = {
  /** One page of organizers and how many match in total. */
  list({
    verification,
    search,
    emailVerified,
    sort,
    page = 1,
    pageSize,
  }: ListOrganizersParams) {
    return apiRequestPage(
      {
        method: "GET",
        url: "/admin/organizers",
        params: {
          page,
          pageSize,
          // Left out when not set, so the server does not filter or reorder by it.
          ...(verification ? { verification } : {}),
          ...(search ? { search } : {}),
          ...(emailVerified === undefined ? {} : { emailVerified }),
          ...(sort ? { sort } : {}),
        },
      },
      getOrganizersResponseSchema,
    );
  },

  /** One application for the review page: the organisation and its applicant (404 if unknown). */
  get(organizerId: string): Promise<OrganizerDetailDto> {
    return apiRequest(
      { method: "GET", url: `/admin/organizers/${organizerId}` },
      organizerDetailResponseSchema,
    );
  },

  /**
   * Creates a pending organizer account; the organizer is emailed a link to set their password.
   * 409 if the email already has an account.
   */
  create(body: CreateOrganizerBody): Promise<CreateOrganizerResponseDto> {
    return apiRequest(
      { method: "POST", url: "/admin/organizers", data: body },
      createOrganizerResponseSchema,
    );
  },

  /** Approves a pending organizer (409 if their email is not verified or they were rejected). */
  verify(organizerId: string): Promise<VerifyOrganizerResponseDto> {
    return apiRequest(
      { method: "POST", url: `/admin/organizers/${organizerId}/verify` },
      verifyOrganizerResponseSchema,
    );
  },

  /** Rejects a pending organizer with the reason the applicant is emailed. */
  reject(
    organizerId: string,
    body: RejectOrganizerBody,
  ): Promise<RejectOrganizerResponseDto> {
    return apiRequest(
      {
        method: "POST",
        url: `/admin/organizers/${organizerId}/reject`,
        data: body,
      },
      rejectOrganizerResponseSchema,
    );
  },

  /** Puts a rejected application back in the approval queue. */
  reopen(organizerId: string): Promise<ReopenOrganizerResponseDto> {
    return apiRequest(
      { method: "POST", url: `/admin/organizers/${organizerId}/reopen` },
      reopenOrganizerResponseSchema,
    );
  },
};
