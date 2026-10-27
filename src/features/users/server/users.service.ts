import "server-only";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../../core/http/errors";
import type { PageMeta } from "../../../core/http/response";
import type {
  GetUsersQuery,
  UserDetailDto,
  UserListItemDto,
  UserStatusDto,
} from "../schemas/users.schema";
import {
  toUserDetailDto,
  toUserListItemDto,
  toUserStatusDto,
} from "./users.dto";
import { userRepository, type UserRepository } from "./users.repository";

export type UserServiceDeps = {
  userRepository: Pick<
    UserRepository,
    | "findForStatusChange"
    | "suspendUser"
    | "reActiveUser"
    | "getUsers"
    | "findDetail"
  >;
};

export function createUserService(deps: UserServiceDeps) {
  return {
    /**
     * One page of users for the admin, filtered by role / status / search and sorted. The query
     * is already validated (whitelisted filters and sort); this turns it into the repository call
     * and the rows into DTOs.
     */
    async getUsers(
      query: GetUsersQuery,
    ): Promise<{ items: UserListItemDto[]; meta: PageMeta }> {
      const { users, meta } = await deps.userRepository.getUsers({
        role: query.role,
        status: query.status,
        // An empty search (after trim) counts as no search.
        search: query.search || undefined,
        sort: query.sort,
        page: query.page,
        pageSize: query.pageSize,
      });

      return { items: users.map(toUserListItemDto), meta };
    },

    /**
     * The admin's profile page for one user, whatever their role (attendee, speaker, organizer,
     * admin): the account, the role and what it allows. 404 if there is no such user. Read-only:
     * suspending and reactivating have their own methods.
     */
    async getUserDetail(userId: string): Promise<UserDetailDto> {
      const row = await deps.userRepository.findDetail({ userId });
      if (!row) throw new NotFoundError("User not found");
      return toUserDetailDto(row);
    },

    async suspendUser(userId: string, actorId: string): Promise<UserStatusDto> {
      if (userId === actorId) {
        throw new ForbiddenError(
          "You cannot suspend your own account",
          "CANNOT_SUSPEND_SELF",
        );
      }

      const target = await deps.userRepository.findForStatusChange({ userId });
      if (!target) throw new NotFoundError("User not found");
      if (target.role === "admin") {
        throw new ForbiddenError(
          "An administrator cannot be suspended",
          "CANNOT_SUSPEND_ADMIN",
        );
      }

      // The WHERE of the update checks "active" again, so this is safe against two clicks at once.
      const user = await deps.userRepository.suspendUser({ userId });
      if (!user) {
        throw new ConflictError(
          "USER_NOT_ACTIVE",
          "Only an active user can be suspended",
        );
      }
      return toUserStatusDto(user);
    },

    /**
     * ADM-8: the admin lets a suspended user back in. Only a suspended user can be reactivated
     * (409): a pending one has no password yet, so `active` would be wrong for them.
     */
    async reactivateUser(userId: string): Promise<UserStatusDto> {
      const target = await deps.userRepository.findForStatusChange({ userId });
      if (!target) throw new NotFoundError("User not found");

      const user = await deps.userRepository.reActiveUser({ userId });
      if (!user) {
        throw new ConflictError(
          "USER_NOT_SUSPENDED",
          "Only a suspended user can be reactivated",
        );
      }
      return toUserStatusDto(user);
    },
  };
}

export type UserService = ReturnType<typeof createUserService>;

export const userService = createUserService({ userRepository });
