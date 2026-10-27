// Calls to the admin users API, built on the shared axios instance. React Query hooks
// (../hooks) wrap these; components use the hooks.
import {
  apiRequest,
  apiRequestPage,
} from "../../../core/api-client/base-api.service";
import {
  resendInviteResponseSchema,
  sendResetLinkResponseSchema,
  type ResendInviteResponseDto,
  type SendResetLinkResponseDto,
} from "../../auth";
import {
  getUsersResponseSchema,
  userDetailResponseSchema,
  userStatusResponseSchema,
  type GetUsersQuery,
  type UserDetailDto,
  type UserStatusDto,
} from "../schemas/users.schema";

export type ListUsersParams = Pick<GetUsersQuery, "pageSize"> &
  Partial<Pick<GetUsersQuery, "page" | "role" | "status" | "search" | "sort">>;

export const usersApiService = {
  /** One page of users, filtered and sorted by the server, and how many match in total. */
  list({
    role,
    status,
    search,
    sort = "newest",
    page = 1,
    pageSize,
  }: ListUsersParams) {
    return apiRequestPage(
      {
        method: "GET",
        url: "/admin/users",
        // Only what is set goes into the URL: no filter means the server does not filter.
        params: {
          page,
          pageSize,
          sort,
          ...(role ? { role } : {}),
          ...(status ? { status } : {}),
          ...(search ? { search } : {}),
        },
      },
      getUsersResponseSchema,
    );
  },

  /** One user for the profile page: the account, the role and what it allows (404 if unknown). */
  get(userId: string): Promise<UserDetailDto> {
    return apiRequest(
      { method: "GET", url: `/admin/users/${userId}` },
      userDetailResponseSchema,
    );
  },

  /**
   * Emails the user the one-time link to choose a new password (the same as "forgot password",
   * started by the admin). Only active, non-admin accounts; 429 within a minute of the last link.
   * The answer is only when the link expires: it never contains the link.
   */
  sendResetLink(userId: string): Promise<SendResetLinkResponseDto> {
    return apiRequest(
      { method: "POST", url: `/admin/users/${userId}/send-reset-link` },
      sendResetLinkResponseSchema,
    );
  },

  /**
   * Emails a NEW set-password invite to an account that has not set a password yet (any role).
   * The old link stops working. 409 if the account is already active or suspended, 429 within a
   * minute of the last invite. The answer is only when the link expires: never the link.
   */
  resendInvite(userId: string): Promise<ResendInviteResponseDto> {
    return apiRequest(
      { method: "POST", url: `/admin/users/${userId}/resend-invite` },
      resendInviteResponseSchema,
    );
  },

  /** Suspends an active user: no more login, their sessions end. No body. */
  suspend(userId: string): Promise<UserStatusDto> {
    return apiRequest(
      { method: "POST", url: `/admin/users/${userId}/suspend` },
      userStatusResponseSchema,
    );
  },

  /** Lets a suspended user back in. No body. */
  reactivate(userId: string): Promise<UserStatusDto> {
    return apiRequest(
      { method: "POST", url: `/admin/users/${userId}/reactivate` },
      userStatusResponseSchema,
    );
  },
};
