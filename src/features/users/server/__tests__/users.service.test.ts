import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../../../core/http/errors";
import { createUserService, type UserServiceDeps } from "../users.service";

// Empty factory: the database client is never loaded.
jest.mock("../users.repository", () => ({}));

const adminId = "5d1c3a4b-7e8f-4a1b-9c2d-3e4f5a6b7c8d";
const userId = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";

const changed = {
  id: userId,
  firstName: "Rahul",
  lastName: "Sharma",
  status: "suspended" as const,
};

// What findDetail returns: the account (Date objects, whether there is a password) and the
// permission keys of the role.
const detailRow = {
  id: userId,
  firstName: "Ananya",
  lastName: "Rao",
  email: "ananya.rao@example.com",
  status: "active" as "active" | "pending" | "suspended",
  role: "user" as "user" | "speaker" | "organizer" | "admin" | null,
  emailVerifiedAt: new Date("2026-10-20T09:21:00.000Z") as Date | null,
  createdAt: new Date("2026-10-20T09:18:00.000Z"),
  hasPassword: true,
  permissions: ["PROFILE_MANAGE", "PROFILE_VIEW", "REGISTRATION_CREATE"],
};

function setup(overrides: Partial<UserServiceDeps["userRepository"]> = {}) {
  const userRepository = {
    findForStatusChange: jest
      .fn()
      .mockResolvedValue({ id: userId, status: "active", role: "user" }),
    suspendUser: jest.fn().mockResolvedValue(changed),
    reActiveUser: jest.fn().mockResolvedValue({ ...changed, status: "active" }),
    getUsers: jest.fn().mockResolvedValue({
      users: [],
      meta: { page: 1, pageSize: 10, total: 0 },
    }),
    findDetail: jest.fn().mockResolvedValue(detailRow),
    ...overrides,
  } satisfies UserServiceDeps["userRepository"];
  return { userRepository, service: createUserService({ userRepository }) };
}

// One row as the repository returns it (Date objects, the email-verified time).
const listRow = {
  id: userId,
  firstName: "Rahul",
  lastName: "Sharma",
  email: "rahul.sharma@example.com",
  status: "active" as const,
  role: "user" as "user" | null,
  emailVerifiedAt: new Date("2026-10-11T08:05:00.000Z") as Date | null,
  createdAt: new Date("2026-10-11T08:00:00.000Z"),
  updatedAt: new Date("2026-10-12T08:00:00.000Z"),
};

// The query as the route hands it over: already validated, defaults filled in.
const defaultQuery = {
  page: 1,
  pageSize: 10,
  sort: "newest" as const,
};

describe("userService.getUsers", () => {
  function setupList(rows = [listRow], total = rows.length) {
    return setup({
      getUsers: jest.fn().mockResolvedValue({
        users: rows,
        meta: { page: 1, pageSize: 10, total },
      }),
    });
  }

  it("returns each row as a DTO: ISO dates and a yes/no for the email, nothing else", async () => {
    const { service } = setupList();

    const { items } = await service.getUsers(defaultQuery);

    expect(items).toEqual([
      {
        id: userId,
        firstName: "Rahul",
        lastName: "Sharma",
        email: "rahul.sharma@example.com",
        role: "user",
        status: "active",
        emailVerified: true,
        createdAt: "2026-10-11T08:00:00.000Z",
        updatedAt: "2026-10-12T08:00:00.000Z",
      },
    ]);
  });

  it("never lets a column the repository might add one day (a password hash) out", async () => {
    const { service } = setupList([
      { ...listRow, passwordHash: "secret" } as typeof listRow,
    ]);

    const { items } = await service.getUsers(defaultQuery);

    expect(Object.keys(items[0]).sort()).toEqual([
      "createdAt",
      "email",
      "emailVerified",
      "firstName",
      "id",
      "lastName",
      "role",
      "status",
      "updatedAt",
    ]);
  });

  it("an account whose email is not confirmed is emailVerified: false", async () => {
    const { service } = setupList([{ ...listRow, emailVerifiedAt: null }]);

    const { items } = await service.getUsers(defaultQuery);

    expect(items[0].emailVerified).toBe(false);
  });

  it("an account with no role has role null", async () => {
    const { service } = setupList([{ ...listRow, role: null }]);

    const { items } = await service.getUsers(defaultQuery);

    expect(items[0].role).toBeNull();
  });

  it("passes the filters, sort and paging on to the repository", async () => {
    const { service, userRepository } = setupList();

    await service.getUsers({
      page: 3,
      pageSize: 8,
      role: "speaker",
      status: "suspended",
      search: "meera",
      sort: "name",
    });

    expect(userRepository.getUsers).toHaveBeenCalledWith({
      role: "speaker",
      status: "suspended",
      search: "meera",
      sort: "name",
      page: 3,
      pageSize: 8,
    });
  });

  it("no filters in the query = no filters in the repository call", async () => {
    const { service, userRepository } = setupList();

    await service.getUsers(defaultQuery);

    expect(userRepository.getUsers).toHaveBeenCalledWith({
      role: undefined,
      status: undefined,
      search: undefined,
      sort: "newest",
      page: 1,
      pageSize: 10,
    });
  });

  it("an empty search counts as no search", async () => {
    const { service, userRepository } = setupList();

    await service.getUsers({ ...defaultQuery, search: "" });

    expect(userRepository.getUsers).toHaveBeenCalledWith(
      expect.objectContaining({ search: undefined }),
    );
  });

  it("returns the paging meta from the repository (page, pageSize and the matching total)", async () => {
    const { service } = setup({
      getUsers: jest.fn().mockResolvedValue({
        users: [listRow],
        meta: { page: 2, pageSize: 10, total: 23 },
      }),
    });

    const { meta } = await service.getUsers({ ...defaultQuery, page: 2 });

    expect(meta).toEqual({ page: 2, pageSize: 10, total: 23 });
  });

  it("an empty page is fine: no items, total 0", async () => {
    const { service } = setupList([], 0);

    const result = await service.getUsers(defaultQuery);

    expect(result.items).toEqual([]);
    expect(result.meta.total).toBe(0);
  });
});

describe("userService.getUserDetail", () => {
  it("looks the user up by the id it was given", async () => {
    const { userRepository, service } = setup();

    await service.getUserDetail(userId);

    expect(userRepository.findDetail).toHaveBeenCalledWith({ userId });
  });

  it("404 when there is no such user", async () => {
    const { service } = setup({
      findDetail: jest.fn().mockResolvedValue(null),
    });

    await expect(service.getUserDetail(userId)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("returns the account as a DTO: ISO dates, the role, whether a password is set, the permissions", async () => {
    const { service } = setup();

    const detail = await service.getUserDetail(userId);

    expect(detail).toEqual({
      id: userId,
      firstName: "Ananya",
      lastName: "Rao",
      email: "ananya.rao@example.com",
      status: "active",
      role: "user",
      emailVerifiedAt: "2026-10-20T09:21:00.000Z",
      createdAt: "2026-10-20T09:18:00.000Z",
      hasPassword: true,
      permissions: ["PROFILE_MANAGE", "PROFILE_VIEW", "REGISTRATION_CREATE"],
    });
  });

  it.each(["user", "speaker", "organizer", "admin"] as const)(
    "gives the same answer for a %s: only the user's own account, nothing a role adds",
    async (role) => {
      const { service } = setup({
        findDetail: jest.fn().mockResolvedValue({ ...detailRow, role }),
      });

      const detail = await service.getUserDetail(userId);

      expect(detail.role).toBe(role);
      expect(Object.keys(detail).sort()).toEqual([
        "createdAt",
        "email",
        "emailVerifiedAt",
        "firstName",
        "hasPassword",
        "id",
        "lastName",
        "permissions",
        "role",
        "status",
      ]);
    },
  );

  it("an account with no role has no permissions (and says so with a null role)", async () => {
    const { service } = setup({
      findDetail: jest
        .fn()
        .mockResolvedValue({ ...detailRow, role: null, permissions: [] }),
    });

    const detail = await service.getUserDetail(userId);

    expect(detail.role).toBeNull();
    expect(detail.permissions).toEqual([]);
  });

  it("an invited account has no password yet and no verified email", async () => {
    const { service } = setup({
      findDetail: jest.fn().mockResolvedValue({
        ...detailRow,
        status: "pending",
        hasPassword: false,
        emailVerifiedAt: null,
      }),
    });

    const detail = await service.getUserDetail(userId);

    expect(detail).toMatchObject({
      status: "pending",
      hasPassword: false,
      emailVerifiedAt: null,
    });
  });

  it("never lets anything but the listed fields out (no password hash)", async () => {
    const { service } = setup({
      findDetail: jest
        .fn()
        .mockResolvedValue({ ...detailRow, passwordHash: "secret-hash" }),
    });

    const detail = await service.getUserDetail(userId);

    expect(JSON.stringify(detail)).not.toContain("secret-hash");
  });
});

describe("userService.suspendUser", () => {
  it("suspends an active user and returns only id, names and status", async () => {
    const { service, userRepository } = setup();

    const result = await service.suspendUser(userId, adminId);

    expect(userRepository.suspendUser).toHaveBeenCalledWith({ userId });
    expect(result).toEqual({
      id: userId,
      firstName: "Rahul",
      lastName: "Sharma",
      status: "suspended",
    });
  });

  it("does not leak extra columns the repository might return one day", async () => {
    const { service } = setup({
      suspendUser: jest.fn().mockResolvedValue({
        ...changed,
        passwordHash: "secret",
        email: "a@b.c",
      }),
    });

    const result = await service.suspendUser(userId, adminId);

    expect(Object.keys(result).sort()).toEqual([
      "firstName",
      "id",
      "lastName",
      "status",
    ]);
  });

  it("refuses (403 CANNOT_SUSPEND_SELF) suspending yourself, before touching the database", async () => {
    const { service, userRepository } = setup();

    const error = await service
      .suspendUser(adminId, adminId)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error).toMatchObject({ status: 403, code: "CANNOT_SUSPEND_SELF" });
    expect(userRepository.findForStatusChange).not.toHaveBeenCalled();
    expect(userRepository.suspendUser).not.toHaveBeenCalled();
  });

  it("refuses (403 CANNOT_SUSPEND_ADMIN) suspending an administrator", async () => {
    const { service, userRepository } = setup({
      findForStatusChange: jest
        .fn()
        .mockResolvedValue({ id: userId, status: "active", role: "admin" }),
    });

    const error = await service
      .suspendUser(userId, adminId)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error).toMatchObject({ status: 403, code: "CANNOT_SUSPEND_ADMIN" });
    expect(userRepository.suspendUser).not.toHaveBeenCalled();
  });

  it("can suspend an organizer, a speaker and an account without a role", async () => {
    for (const role of ["organizer", "speaker", null]) {
      const { service } = setup({
        findForStatusChange: jest
          .fn()
          .mockResolvedValue({ id: userId, status: "active", role }),
      });

      await expect(service.suspendUser(userId, adminId)).resolves.toMatchObject(
        {
          status: "suspended",
        },
      );
    }
  });

  it("returns 404 for an unknown user", async () => {
    const { service, userRepository } = setup({
      findForStatusChange: jest.fn().mockResolvedValue(null),
    });

    await expect(service.suspendUser(userId, adminId)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(userRepository.suspendUser).not.toHaveBeenCalled();
  });

  it("returns 409 USER_NOT_ACTIVE when the update changed nothing (not active, or lost a race)", async () => {
    const { service } = setup({
      suspendUser: jest.fn().mockResolvedValue(undefined),
    });

    const error = await service
      .suspendUser(userId, adminId)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ status: 409, code: "USER_NOT_ACTIVE" });
  });
});

describe("userService.reactivateUser", () => {
  it("reactivates a suspended user and returns only id, names and status", async () => {
    const { service, userRepository } = setup();

    const result = await service.reactivateUser(userId);

    expect(userRepository.reActiveUser).toHaveBeenCalledWith({ userId });
    expect(result).toEqual({
      id: userId,
      firstName: "Rahul",
      lastName: "Sharma",
      status: "active",
    });
  });

  it("returns 404 for an unknown user", async () => {
    const { service, userRepository } = setup({
      findForStatusChange: jest.fn().mockResolvedValue(null),
    });

    await expect(service.reactivateUser(userId)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(userRepository.reActiveUser).not.toHaveBeenCalled();
  });

  it("returns 409 USER_NOT_SUSPENDED when the user is not suspended (e.g. pending: no password yet)", async () => {
    const { service } = setup({
      reActiveUser: jest.fn().mockResolvedValue(undefined),
    });

    const error = await service.reactivateUser(userId).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ status: 409, code: "USER_NOT_SUSPENDED" });
  });
});
