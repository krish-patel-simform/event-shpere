import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
} from "../../../../core/http/errors";
import {
  createOrganizerBodySchema,
  REJECTION_REASON_MAX,
  rejectOrganizerBodySchema,
} from "../../schemas/organizer.schemas";
import {
  createOrganizerService,
  type OrganizerServiceDeps,
} from "../organizer.service";

// Empty factories: env, DB, Redis and the other features' server code are never loaded.
jest.mock("../../../../config/env", () => ({ env: {} }));
jest.mock("../organizer.repository", () => ({}));
jest.mock("../../../auth/server", () => ({}));
jest.mock("../../../email/server", () => ({}));
jest.mock("../../../cms/server", () => ({}));

const createdAt = new Date("2026-10-17T10:00:00.000Z");
const user = {
  id: "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10",
  firstName: "Olga",
  lastName: "Organizer",
  email: "olga@acme.test",
  passwordHash: null,
  emailVerifiedAt: null,
  status: "pending" as const,
  createdAt,
  updatedAt: createdAt,
};
const profile = {
  id: "0b7c2d1e-3f4a-4b5c-8d6e-7f8091a2b3c4",
  userId: user.id,
  organizationName: "Acme Events",
  organizationWebsite: "https://acme.test",
  verifiedAt: null,
  verifiedBy: null,
  createdAt,
  updatedAt: createdAt,
};
const setupToken = {
  token: "raw-token/with+chars",
  tokenHash: "hashed-token",
  expiresAt: new Date("2026-10-18T10:00:00.000Z"),
};

const verifiedRow = {
  organizerId: profile.id,
  organizationName: "Acme Events",
  organizerFirstName: "Olga",
  organizerLastName: "Organizer",
  verifiedAt: new Date("2026-10-19T09:00:00.000Z"),
  verifiedBy: "Ada Admin",
  justVerified: true,
};

// What findForVerify returns for an organizer that is not verified yet (email already confirmed).
const unverifiedOrganizer = {
  email: "olga@acme.test",
  firstName: "Olga",
  lastName: "Organizer",
  emailVerifiedAt: new Date("2026-10-17T10:05:00.000Z"),
  verifiedAt: null,
  rejectedAt: null as Date | null,
};

// What rejectPendingOrganizer returns after it rejected the applicant.
const rejectedRow = {
  organizerId: profile.id,
  organizationName: "Acme Events",
  organizerFirstName: "Olga",
  organizerLastName: "Organizer",
  email: "olga@acme.test",
  verifiedAt: null as Date | null,
  rejectedAt: new Date("2026-10-20T09:00:00.000Z") as Date | null,
  rejectionReason: "Website could not be verified" as string | null,
  rejectedBy: "Ada Admin" as string | null,
  justRejected: true,
};

// What reopenRejectedOrganizer returns after it cleared the rejection.
const reopenedRow = {
  organizerId: profile.id,
  organizationName: "Acme Events",
  organizerFirstName: "Olga",
  organizerLastName: "Organizer",
  justReopened: true,
};

// What findApplicationByUserId returns for a pending application.
const applicationRow = {
  organizationName: "Acme Events",
  organizationWebsite: "https://acme.test" as string | null,
  appliedAt: createdAt,
  emailVerifiedAt: new Date("2026-10-17T10:05:00.000Z") as Date | null,
  verifiedAt: null as Date | null,
  rejectedAt: null as Date | null,
  rejectionReason: null as string | null,
};

// What findDetail returns for a waiting application (Date objects, the applicant's role).
const detailRow = {
  id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e15",
  organizationName: "Acme Events",
  organizationWebsite: "https://acme.test" as string | null,
  appliedAt: createdAt,
  verifiedAt: null as Date | null,
  rejectedAt: null as Date | null,
  rejectionReason: null as string | null,
  hasDuplicate: false,
  userId: "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10",
  firstName: "Olga",
  lastName: "Organizer",
  email: "olga@acme.test",
  emailVerifiedAt: new Date("2026-10-17T10:05:00.000Z") as Date | null,
  accountStatus: "active" as "active" | "pending" | "suspended",
  role: "user" as "user" | "organizer" | null,
  userCreatedAt: new Date("2026-10-17T09:55:00.000Z"),
};

const input = {
  firstName: "Olga",
  lastName: "Organizer",
  email: "olga@acme.test",
  organizationName: "Acme Events",
  organizationWebsite: "https://acme.test",
};

function setup(overrides: Partial<OrganizerServiceDeps> = {}) {
  const deps = {
    organizerRepository: {
      createOrganizerAccount: jest
        .fn()
        .mockResolvedValue({ ok: true, user, profile }),
      listOrganizers: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
      verifyOrganizer: jest.fn().mockResolvedValue(verifiedRow),
      findForVerify: jest.fn().mockResolvedValue(unverifiedOrganizer),
      findInviteeById: jest.fn().mockResolvedValue({ userId: user.id }),
      deleteUnverifiedOrganizer: jest.fn().mockResolvedValue("deleted"),
      findVerificationByUserId: jest.fn().mockResolvedValue({
        verifiedAt: verifiedRow.verifiedAt,
        rejectedAt: null,
      }),
      rejectPendingOrganizer: jest.fn().mockResolvedValue(rejectedRow),
      reopenRejectedOrganizer: jest.fn().mockResolvedValue(reopenedRow),
      findApplicationByUserId: jest.fn().mockResolvedValue(applicationRow),
      findDetail: jest.fn().mockResolvedValue(detailRow),
    },
    createAccountSetupToken: jest.fn().mockReturnValue(setupToken),
    enqueueAccountSetupEmail: jest.fn().mockResolvedValue(undefined),
    accountInviteService: {
      resendAccountSetup: jest.fn().mockResolvedValue({
        setupEmailQueued: true,
        expiresAt: "2026-10-26T10:00:00.000Z",
      }),
    },
    strapiClient: {
      provisionOrganizerAccess: jest
        .fn()
        .mockResolvedValue({ id: 7, registrationToken: "reg-token" }),
      registerUrl: jest.fn(
        (token: string) =>
          `http://cms.test/admin/auth/register?registrationToken=${token}`,
      ),
    },
    enqueueCmsAccessEmail: jest.fn().mockResolvedValue(undefined),
    enqueueOrganizerRejectedEmail: jest.fn().mockResolvedValue(undefined),
    appUrl: "http://localhost:3000",
    ...overrides,
  } satisfies OrganizerServiceDeps;
  return { deps, service: createOrganizerService(deps) };
}

describe("organizerService.createOrganizer", () => {
  it("stores only the token hash and returns a pending organizer without secrets", async () => {
    const { deps, service } = setup();

    const result = await service.createOrganizer(input);

    expect(
      deps.organizerRepository.createOrganizerAccount,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "olga@acme.test",
        setupToken: {
          tokenHash: "hashed-token",
          expiresAt: setupToken.expiresAt,
        },
      }),
    );
    expect(result).toEqual({
      id: profile.id,
      userId: user.id,
      firstName: "Olga",
      lastName: "Organizer",
      email: "olga@acme.test",
      status: "pending",
      organizationName: "Acme Events",
      organizationWebsite: "https://acme.test",
      isVerified: false,
      createdAt: "2026-10-17T10:00:00.000Z",
      setupEmailQueued: true,
    });
    expect(JSON.stringify(result)).not.toContain("raw-token");
  });

  it("queues the setup email with an encoded 24h link and the login link", async () => {
    const { deps, service } = setup();

    await service.createOrganizer(input);

    expect(deps.enqueueAccountSetupEmail).toHaveBeenCalledWith({
      to: "olga@acme.test",
      firstName: "Olga",
      passwordSetupUrl:
        "http://localhost:3000/set-password?token=raw-token%2Fwith%2Bchars",
      loginUrl: "http://localhost:3000/login",
      expiresInHours: 24,
    });
  });

  it("returns 409 EMAIL_TAKEN and sends no email for a duplicate email", async () => {
    const { deps, service } = setup({
      organizerRepository: {
        createOrganizerAccount: jest
          .fn()
          .mockResolvedValue({ ok: false, reason: "EMAIL_TAKEN" }),
        listOrganizers: jest.fn(),
        verifyOrganizer: jest.fn(),
        findForVerify: jest.fn(),
        findInviteeById: jest.fn(),
        deleteUnverifiedOrganizer: jest.fn(),
        findVerificationByUserId: jest.fn(),
        rejectPendingOrganizer: jest.fn(),
        reopenRejectedOrganizer: jest.fn(),
        findApplicationByUserId: jest.fn(),
        findDetail: jest.fn(),
      },
    });

    const error = await service.createOrganizer(input).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ status: 409, code: "EMAIL_TAKEN" });
    expect(deps.enqueueAccountSetupEmail).not.toHaveBeenCalled();
  });

  it("still creates the account when the email cannot be queued, and says so", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const { service } = setup({
      enqueueAccountSetupEmail: jest
        .fn()
        .mockRejectedValue(new Error("Redis down")),
    });

    const result = await service.createOrganizer(input);

    expect(result.setupEmailQueued).toBe(false);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe("createOrganizerBodySchema", () => {
  it("lowercases the email and trims names", () => {
    const parsed = createOrganizerBodySchema.parse({
      ...input,
      firstName: "  Olga ",
      email: " Olga@ACME.test ",
    });

    expect(parsed.firstName).toBe("Olga");
    expect(parsed.email).toBe("olga@acme.test");
  });

  it("rejects a non-http website (e.g. javascript:)", () => {
    expect(
      createOrganizerBodySchema.safeParse({
        ...input,
        organizationWebsite: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });

  it("allows the website to be left out", () => {
    expect(
      createOrganizerBodySchema.safeParse({
        ...input,
        organizationWebsite: undefined,
      }).success,
    ).toBe(true);
  });
});

describe("rejectOrganizerBodySchema", () => {
  it("trims the reason", () => {
    expect(
      rejectOrganizerBodySchema.parse({ reason: "  Website down  " }),
    ).toEqual({ reason: "Website down" });
  });

  it("refuses an empty or blank reason", () => {
    expect(rejectOrganizerBodySchema.safeParse({ reason: "   " }).success).toBe(
      false,
    );
    expect(rejectOrganizerBodySchema.safeParse({}).success).toBe(false);
  });

  it(`refuses a reason over ${REJECTION_REASON_MAX} characters`, () => {
    const reason = "x".repeat(REJECTION_REASON_MAX + 1);
    expect(rejectOrganizerBodySchema.safeParse({ reason }).success).toBe(false);
  });
});

describe("organizerService.verifyOrganizer", () => {
  const adminId = "5d1c3a4b-7e8f-4a1b-9c2d-3e4f5a6b7c8d";

  // Repository with verifyOrganizer/findForVerify answers swapped, the rest unused.
  function repoWith(
    overrides: Partial<OrganizerServiceDeps["organizerRepository"]>,
  ) {
    return {
      createOrganizerAccount: jest.fn(),
      listOrganizers: jest.fn(),
      verifyOrganizer: jest.fn().mockResolvedValue(verifiedRow),
      findForVerify: jest.fn().mockResolvedValue(unverifiedOrganizer),
      findInviteeById: jest.fn(),
      deleteUnverifiedOrganizer: jest.fn(),
      findVerificationByUserId: jest.fn(),
      rejectPendingOrganizer: jest.fn(),
      reopenRejectedOrganizer: jest.fn(),
      findApplicationByUserId: jest.fn(),
      findDetail: jest.fn(),
      ...overrides,
    };
  }

  it("creates the Strapi user first, then saves its id in the same verify update", async () => {
    const { deps, service } = setup();

    await service.verifyOrganizer(profile.id, adminId);

    expect(deps.strapiClient.provisionOrganizerAccess).toHaveBeenCalledWith({
      email: "olga@acme.test",
      firstName: "Olga",
      lastName: "Organizer",
    });
    // The admin id comes from the token (currentUser.id), never from the request.
    expect(deps.organizerRepository.verifyOrganizer).toHaveBeenCalledWith({
      organizerId: profile.id,
      verifierId: adminId,
      cmsOrganizerId: 7,
    });
  });

  it("returns the organizer with an ISO date and the verifier's name, without CMS secrets", async () => {
    const { service } = setup();

    const result = await service.verifyOrganizer(profile.id, adminId);

    expect(result).toEqual({
      organizerId: profile.id,
      organizationName: "Acme Events",
      organizerFirstName: "Olga",
      organizerLastName: "Organizer",
      verifiedAt: "2026-10-19T09:00:00.000Z",
      verifiedBy: "Ada Admin",
    });
    expect(JSON.stringify(result)).not.toContain("reg-token");
  });

  it("queues the content-access email with the Strapi register link", async () => {
    const { deps, service } = setup();

    await service.verifyOrganizer(profile.id, adminId);

    expect(deps.enqueueCmsAccessEmail).toHaveBeenCalledWith(
      {
        to: "olga@acme.test",
        firstName: "Olga",
        registerUrl:
          "http://cms.test/admin/auth/register?registrationToken=reg-token",
      },
      profile.id,
    );
  });

  it("does not call Strapi or send an email when the organizer is already verified", async () => {
    const { deps, service } = setup({
      organizerRepository: repoWith({
        findForVerify: jest.fn().mockResolvedValue({
          ...unverifiedOrganizer,
          verifiedAt: verifiedRow.verifiedAt,
        }),
        verifyOrganizer: jest
          .fn()
          .mockResolvedValue({ ...verifiedRow, justVerified: false }),
      }),
    });

    const result = await service.verifyOrganizer(profile.id, adminId);

    expect(result.verifiedBy).toBe("Ada Admin");
    expect(deps.strapiClient.provisionOrganizerAccess).not.toHaveBeenCalled();
    expect(deps.organizerRepository.verifyOrganizer).toHaveBeenCalledWith({
      organizerId: profile.id,
      verifierId: adminId,
      cmsOrganizerId: undefined,
    });
    expect(deps.enqueueCmsAccessEmail).not.toHaveBeenCalled();
  });

  it("returns 503 and saves nothing when Strapi is unavailable", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const { deps, service } = setup({
      strapiClient: {
        provisionOrganizerAccess: jest
          .fn()
          .mockRejectedValue(new Error("fetch failed")),
        registerUrl: jest.fn(),
      },
    });

    const error = await service
      .verifyOrganizer(profile.id, adminId)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableError);
    expect(error).toMatchObject({ status: 503, code: "CMS_UNAVAILABLE" });
    expect(deps.organizerRepository.verifyOrganizer).not.toHaveBeenCalled();
    expect(deps.enqueueCmsAccessEmail).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("sends no email when another click verified it first (lost the race)", async () => {
    const { deps, service } = setup({
      organizerRepository: repoWith({
        verifyOrganizer: jest
          .fn()
          .mockResolvedValue({ ...verifiedRow, justVerified: false }),
      }),
    });

    await service.verifyOrganizer(profile.id, adminId);

    expect(deps.enqueueCmsAccessEmail).not.toHaveBeenCalled();
  });

  it("sends no email when the organizer already registered in Strapi (no token)", async () => {
    const { deps, service } = setup({
      strapiClient: {
        provisionOrganizerAccess: jest
          .fn()
          .mockResolvedValue({ id: 7, registrationToken: null }),
        registerUrl: jest.fn(),
      },
    });

    await service.verifyOrganizer(profile.id, adminId);

    expect(deps.organizerRepository.verifyOrganizer).toHaveBeenCalledWith(
      expect.objectContaining({ cmsOrganizerId: 7 }),
    );
    expect(deps.enqueueCmsAccessEmail).not.toHaveBeenCalled();
  });

  it("still verifies when the email cannot be queued, and never logs the link", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const { service } = setup({
      enqueueCmsAccessEmail: jest
        .fn()
        .mockRejectedValue(new Error("Redis down")),
    });

    const result = await service.verifyOrganizer(profile.id, adminId);

    expect(result.verifiedBy).toBe("Ada Admin");
    expect(log).toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain("reg-token");
    log.mockRestore();
  });

  it("returns 404 for an unknown organizer without calling Strapi", async () => {
    const { deps, service } = setup({
      organizerRepository: repoWith({
        findForVerify: jest.fn().mockResolvedValue(null),
      }),
    });

    const error = await service
      .verifyOrganizer(profile.id, adminId)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
    expect(deps.strapiClient.provisionOrganizerAccess).not.toHaveBeenCalled();
  });

  it("refuses (409) an organizer whose email is not verified, before Strapi or the update", async () => {
    const { deps, service } = setup({
      organizerRepository: repoWith({
        findForVerify: jest
          .fn()
          .mockResolvedValue({ ...unverifiedOrganizer, emailVerifiedAt: null }),
      }),
    });

    const error = await service
      .verifyOrganizer(profile.id, adminId)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ status: 409, code: "EMAIL_NOT_VERIFIED" });
    expect(deps.strapiClient.provisionOrganizerAccess).not.toHaveBeenCalled();
    expect(deps.organizerRepository.verifyOrganizer).not.toHaveBeenCalled();
    expect(deps.enqueueCmsAccessEmail).not.toHaveBeenCalled();
  });

  it("refuses (409 ORGANIZER_REJECTED) a rejected organizer: no CMS account, no update", async () => {
    const { deps, service } = setup({
      organizerRepository: repoWith({
        findForVerify: jest.fn().mockResolvedValue({
          ...unverifiedOrganizer,
          rejectedAt: new Date("2026-10-20T09:00:00.000Z"),
        }),
      }),
    });

    const error = await service
      .verifyOrganizer(profile.id, adminId)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ status: 409, code: "ORGANIZER_REJECTED" });
    expect(deps.strapiClient.provisionOrganizerAccess).not.toHaveBeenCalled();
    expect(deps.organizerRepository.verifyOrganizer).not.toHaveBeenCalled();
  });

  it("refuses (409) when a reject was saved just before the update, and sends no email", async () => {
    const { deps, service } = setup({
      organizerRepository: repoWith({
        verifyOrganizer: jest.fn().mockResolvedValue({
          ...verifiedRow,
          verifiedAt: null,
          verifiedBy: null,
          rejectedAt: new Date("2026-10-20T09:00:00.000Z"),
          justVerified: false,
        }),
      }),
    });

    await expect(
      service.verifyOrganizer(profile.id, adminId),
    ).rejects.toMatchObject({ status: 409, code: "ORGANIZER_REJECTED" });
    expect(deps.enqueueCmsAccessEmail).not.toHaveBeenCalled();
  });
});

describe("organizerService.resendInvite", () => {
  it("finds the organizer's account and re-sends the invite to it", async () => {
    const { deps, service } = setup();

    const result = await service.resendInvite(profile.id);

    expect(deps.organizerRepository.findInviteeById).toHaveBeenCalledWith(
      profile.id,
    );
    expect(deps.accountInviteService.resendAccountSetup).toHaveBeenCalledWith(
      user.id,
    );
    expect(result).toEqual({
      setupEmailQueued: true,
      expiresAt: "2026-10-26T10:00:00.000Z",
    });
  });

  it("returns 404 for an unknown organizer without sending anything", async () => {
    const { deps, service } = setup({
      organizerRepository: {
        createOrganizerAccount: jest.fn(),
        listOrganizers: jest.fn(),
        verifyOrganizer: jest.fn(),
        findForVerify: jest.fn(),
        findInviteeById: jest.fn().mockResolvedValue(null),
        deleteUnverifiedOrganizer: jest.fn(),
        findVerificationByUserId: jest.fn(),
        rejectPendingOrganizer: jest.fn(),
        reopenRejectedOrganizer: jest.fn(),
        findApplicationByUserId: jest.fn(),
        findDetail: jest.fn(),
      },
    });

    await expect(service.resendInvite(profile.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(deps.accountInviteService.resendAccountSetup).not.toHaveBeenCalled();
  });

  it("passes the invite service's answer on (e.g. 409 already active)", async () => {
    const alreadyActive = new ConflictError("ACCOUNT_ALREADY_ACTIVE", "done");
    const { service } = setup({
      accountInviteService: {
        resendAccountSetup: jest.fn().mockRejectedValue(alreadyActive),
      },
    });

    await expect(service.resendInvite(profile.id)).rejects.toBe(alreadyActive);
  });
});

describe("organizerService.getOrganizerListItem", () => {
  // One row as the repository returns it (Date objects, the email-verified timestamp).
  const listRow = {
    id: profile.id,
    organizerFirstName: "Olga",
    organizerLastName: "Organizer",
    email: "olga@acme.test",
    emailVerifiedAt: new Date("2026-10-17T10:05:00.000Z") as Date | null,
    accountStatus: "active" as const,
    organizationName: "Acme Events",
    organizationWebsite: "https://acme.test",
    appliedAt: createdAt,
    verifiedAt: null,
    verifiedBy: null,
    rejectedAt: null,
    rejectionReason: null,
  };

  function setupList(rows = [listRow], total = rows.length) {
    return setup({
      organizerRepository: {
        createOrganizerAccount: jest.fn(),
        listOrganizers: jest.fn().mockResolvedValue({ rows, total }),
        verifyOrganizer: jest.fn(),
        findForVerify: jest.fn(),
        findInviteeById: jest.fn(),
        deleteUnverifiedOrganizer: jest.fn(),
        findVerificationByUserId: jest.fn(),
        rejectPendingOrganizer: jest.fn(),
        reopenRejectedOrganizer: jest.fn(),
        findApplicationByUserId: jest.fn(),
        findDetail: jest.fn(),
      },
    });
  }

  it("returns each row as a DTO: ISO dates and a yes/no for the email, nothing else", async () => {
    const { service } = setupList();

    const { items } = await service.getOrganizerListItem({
      page: 1,
      pageSize: 10,
      sort: "newest",
    });

    expect(items).toEqual([
      {
        id: profile.id,
        organizerFirstName: "Olga",
        organizerLastName: "Organizer",
        email: "olga@acme.test",
        emailVerified: true,
        accountStatus: "active",
        organizationName: "Acme Events",
        organizationWebsite: "https://acme.test",
        appliedAt: "2026-10-17T10:00:00.000Z",
        verifiedAt: null,
        verifiedBy: null,
        rejectedAt: null,
        rejectionReason: null,
      },
    ]);
  });

  it("an applicant without a confirmed email is emailVerified: false", async () => {
    const { service } = setupList([{ ...listRow, emailVerifiedAt: null }]);

    const { items } = await service.getOrganizerListItem({
      page: 1,
      pageSize: 10,
      sort: "newest",
    });

    expect(items[0].emailVerified).toBe(false);
  });

  it("passes the filters on and turns page/pageSize into limit/offset", async () => {
    const { deps, service } = setupList([listRow], 23);

    const { meta } = await service.getOrganizerListItem({
      page: 3,
      pageSize: 10,
      verification: "pending",
      search: "acme",
      emailVerified: false,
      sort: "oldest",
    });

    expect(deps.organizerRepository.listOrganizers).toHaveBeenCalledWith({
      search: "acme",
      verification: "pending",
      emailVerified: false,
      sort: "oldest",
      limit: 10,
      offset: 20,
    });
    expect(meta).toEqual({ page: 3, pageSize: 10, total: 23 });
  });

  it("no filter in the query = no filter in the repository call", async () => {
    const { deps, service } = setupList();

    await service.getOrganizerListItem({
      page: 1,
      pageSize: 10,
      sort: "newest",
    });

    expect(deps.organizerRepository.listOrganizers).toHaveBeenCalledWith(
      expect.objectContaining({
        search: undefined,
        verification: undefined,
        emailVerified: undefined,
      }),
    );
  });

  it("an empty search is not a search", async () => {
    const { deps, service } = setupList();

    await service.getOrganizerListItem({
      page: 1,
      pageSize: 10,
      search: "",
      sort: "newest",
    });

    expect(deps.organizerRepository.listOrganizers).toHaveBeenCalledWith(
      expect.objectContaining({ search: undefined }),
    );
  });
});

describe("organizerService.getOrganizerDetail", () => {
  const organizerId = detailRow.id;

  it("looks the application up by the id it was given", async () => {
    const { deps, service } = setup();

    await service.getOrganizerDetail(organizerId);

    expect(deps.organizerRepository.findDetail).toHaveBeenCalledWith(
      organizerId,
    );
  });

  it("404 when there is no such application", async () => {
    const { service } = setup({
      organizerRepository: {
        ...setup().deps.organizerRepository,
        findDetail: jest.fn().mockResolvedValue(null),
      },
    });

    await expect(
      service.getOrganizerDetail(organizerId),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns a waiting application as a DTO: ISO dates, status pending, nothing decided yet", async () => {
    const { service } = setup();

    const detail = await service.getOrganizerDetail(organizerId);

    expect(detail).toEqual({
      id: organizerId,
      organizationName: "Acme Events",
      organizationWebsite: "https://acme.test",
      appliedAt: "2026-10-17T10:00:00.000Z",
      status: "pending",
      approvedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      hasDuplicate: false,
      applicant: {
        userId: detailRow.userId,
        firstName: "Olga",
        lastName: "Organizer",
        email: "olga@acme.test",
        emailVerifiedAt: "2026-10-17T10:05:00.000Z",
        accountStatus: "active",
        role: "user",
        createdAt: "2026-10-17T09:55:00.000Z",
      },
    });
  });

  it("an approved application is verified, with the time of the approval", async () => {
    const verifiedAt = new Date("2026-10-20T12:00:00.000Z");
    const { service } = setup({
      organizerRepository: {
        ...setup().deps.organizerRepository,
        findDetail: jest.fn().mockResolvedValue({ ...detailRow, verifiedAt }),
      },
    });

    const detail = await service.getOrganizerDetail(organizerId);

    expect(detail.status).toBe("verified");
    expect(detail.approvedAt).toBe("2026-10-20T12:00:00.000Z");
    expect(detail.rejectedAt).toBeNull();
    expect(detail.rejectionReason).toBeNull();
  });

  it("a rejected application is rejected, with the time and the reason the applicant was given", async () => {
    const rejectedAt = new Date("2026-10-21T08:30:00.000Z");
    const { service } = setup({
      organizerRepository: {
        ...setup().deps.organizerRepository,
        findDetail: jest.fn().mockResolvedValue({
          ...detailRow,
          rejectedAt,
          rejectionReason: "Duplicate application",
        }),
      },
    });

    const detail = await service.getOrganizerDetail(organizerId);

    expect(detail.status).toBe("rejected");
    expect(detail.rejectedAt).toBe("2026-10-21T08:30:00.000Z");
    expect(detail.approvedAt).toBeNull();
    expect(detail.rejectionReason).toBe("Duplicate application");
  });

  it("passes on whether another organizer uses the same name or website, and a missing role or verification", async () => {
    const { service } = setup({
      organizerRepository: {
        ...setup().deps.organizerRepository,
        findDetail: jest.fn().mockResolvedValue({
          ...detailRow,
          hasDuplicate: true,
          role: null,
          emailVerifiedAt: null,
          organizationWebsite: null,
        }),
      },
    });

    const detail = await service.getOrganizerDetail(organizerId);

    expect(detail.hasDuplicate).toBe(true);
    expect(detail.applicant.role).toBeNull();
    expect(detail.applicant.emailVerifiedAt).toBeNull();
    expect(detail.organizationWebsite).toBeNull();
  });

  it("never lets anything but the listed fields out (no password hash, no verifier id)", async () => {
    const { service } = setup({
      organizerRepository: {
        ...setup().deps.organizerRepository,
        findDetail: jest.fn().mockResolvedValue({
          ...detailRow,
          passwordHash: "secret-hash",
          verifiedBy: "admin-id",
        }),
      },
    });

    const detail = await service.getOrganizerDetail(organizerId);

    expect(JSON.stringify(detail)).not.toContain("secret-hash");
    expect(JSON.stringify(detail)).not.toContain("admin-id");
  });
});

describe("organizerService.deleteOrganizer", () => {
  function setupDelete(result: "deleted" | "not_found" | "already_verified") {
    return setup({
      organizerRepository: {
        createOrganizerAccount: jest.fn(),
        listOrganizers: jest.fn(),
        verifyOrganizer: jest.fn(),
        findForVerify: jest.fn(),
        findInviteeById: jest.fn(),
        deleteUnverifiedOrganizer: jest.fn().mockResolvedValue(result),
        findVerificationByUserId: jest.fn(),
        rejectPendingOrganizer: jest.fn(),
        reopenRejectedOrganizer: jest.fn(),
        findApplicationByUserId: jest.fn(),
        findDetail: jest.fn(),
      },
    });
  }

  it("deletes the unverified applicant's account", async () => {
    const { deps, service } = setupDelete("deleted");

    await expect(service.deleteOrganizer(profile.id)).resolves.toBeUndefined();
    expect(
      deps.organizerRepository.deleteUnverifiedOrganizer,
    ).toHaveBeenCalledWith(profile.id);
  });

  it("returns 404 for an unknown organizer", async () => {
    const { service } = setupDelete("not_found");

    await expect(service.deleteOrganizer(profile.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("refuses (409) to delete an organizer who is already verified", async () => {
    const { service } = setupDelete("already_verified");

    const error = await service
      .deleteOrganizer(profile.id)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({
      status: 409,
      code: "ORGANIZER_ALREADY_VERIFIED",
    });
  });
});

describe("organizerService.rejectOrganizer", () => {
  const adminId = "5d1c3a4b-7e8f-4a1b-9c2d-3e4f5a6b7c8d";
  const reason = "Website could not be verified";

  function setupReject(row: typeof rejectedRow | null) {
    const { deps } = setup();
    jest
      .mocked(deps.organizerRepository.rejectPendingOrganizer)
      .mockResolvedValue(row);
    return { deps, service: createOrganizerService(deps) };
  }

  it("saves the rejection with the admin id from the token and the reason", async () => {
    const { deps, service } = setupReject(rejectedRow);

    await service.rejectOrganizer(profile.id, adminId, reason);

    expect(
      deps.organizerRepository.rejectPendingOrganizer,
    ).toHaveBeenCalledWith({
      organizerId: profile.id,
      rejecterId: adminId,
      reason,
    });
    // Rejecting keeps the account: nothing is deleted.
    expect(
      deps.organizerRepository.deleteUnverifiedOrganizer,
    ).not.toHaveBeenCalled();
  });

  it("returns the rejection with an ISO date and the admin's name, without the email", async () => {
    const { service } = setupReject(rejectedRow);

    const result = await service.rejectOrganizer(profile.id, adminId, reason);

    expect(result).toEqual({
      organizerId: profile.id,
      organizationName: "Acme Events",
      organizerFirstName: "Olga",
      organizerLastName: "Organizer",
      rejectedAt: "2026-10-20T09:00:00.000Z",
      rejectedBy: "Ada Admin",
      rejectionReason: reason,
      rejectionEmailQueued: true,
    });
  });

  it("queues the rejection email with the reason, keyed by organizer and rejection time", async () => {
    const { deps, service } = setupReject(rejectedRow);

    await service.rejectOrganizer(profile.id, adminId, reason);

    // The time is in the key: after a reopen, a second rejection must send its own email.
    expect(deps.enqueueOrganizerRejectedEmail).toHaveBeenCalledWith(
      {
        to: "olga@acme.test",
        firstName: "Olga",
        organizationName: "Acme Events",
        reason,
        loginUrl: "http://localhost:3000/login",
      },
      `${profile.id}-${new Date("2026-10-20T09:00:00.000Z").getTime()}`,
    );
  });

  it("still rejects when the email cannot be queued, and says so", async () => {
    const { deps, service } = setupReject(rejectedRow);
    jest
      .mocked(deps.enqueueOrganizerRejectedEmail)
      .mockRejectedValue(new Error("Redis down"));
    const log = jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await service.rejectOrganizer(profile.id, adminId, reason);

    expect(result.rejectionEmailQueued).toBe(false);
    log.mockRestore();
  });

  it("returns 404 for an unknown organizer and sends no email", async () => {
    const { deps, service } = setupReject(null);

    await expect(
      service.rejectOrganizer(profile.id, adminId, reason),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(deps.enqueueOrganizerRejectedEmail).not.toHaveBeenCalled();
  });

  it("refuses (409 ORGANIZER_ALREADY_VERIFIED) a verified organizer and sends no email", async () => {
    const { deps, service } = setupReject({
      ...rejectedRow,
      verifiedAt: new Date("2026-10-19T09:00:00.000Z"),
      rejectedAt: null,
      rejectionReason: null,
      rejectedBy: null,
      justRejected: false,
    });

    await expect(
      service.rejectOrganizer(profile.id, adminId, reason),
    ).rejects.toMatchObject({
      status: 409,
      code: "ORGANIZER_ALREADY_VERIFIED",
    });
    expect(deps.enqueueOrganizerRejectedEmail).not.toHaveBeenCalled();
  });

  it("refuses (409 ORGANIZER_ALREADY_REJECTED) a second rejection: the first reason stays", async () => {
    const { deps, service } = setupReject({
      ...rejectedRow,
      justRejected: false,
    });

    await expect(
      service.rejectOrganizer(profile.id, adminId, "another reason"),
    ).rejects.toMatchObject({
      status: 409,
      code: "ORGANIZER_ALREADY_REJECTED",
    });
    expect(deps.enqueueOrganizerRejectedEmail).not.toHaveBeenCalled();
  });
});

describe("organizerService.reopenOrganizer", () => {
  function setupReopen(row: typeof reopenedRow | null) {
    const { deps } = setup();
    jest
      .mocked(deps.organizerRepository.reopenRejectedOrganizer)
      .mockResolvedValue(row);
    return { deps, service: createOrganizerService(deps) };
  }

  it("reopens the organizer by id and returns it as pending", async () => {
    const { deps, service } = setupReopen(reopenedRow);

    const result = await service.reopenOrganizer(profile.id);

    expect(
      deps.organizerRepository.reopenRejectedOrganizer,
    ).toHaveBeenCalledWith(profile.id);
    expect(result).toEqual({
      organizerId: profile.id,
      organizationName: "Acme Events",
      organizerFirstName: "Olga",
      organizerLastName: "Organizer",
      status: "pending",
    });
  });

  it("does not email the applicant", async () => {
    const { deps, service } = setupReopen(reopenedRow);

    await service.reopenOrganizer(profile.id);

    expect(deps.enqueueOrganizerRejectedEmail).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown organizer", async () => {
    const { service } = setupReopen(null);

    await expect(service.reopenOrganizer(profile.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("refuses (409 ORGANIZER_NOT_REJECTED) an organizer that is not rejected", async () => {
    const { service } = setupReopen({ ...reopenedRow, justReopened: false });

    const error = await service
      .reopenOrganizer(profile.id)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({
      status: 409,
      code: "ORGANIZER_NOT_REJECTED",
    });
  });
});

describe("organizerService.getOwnApplication", () => {
  function setupApplication(row: typeof applicationRow | null) {
    const { deps } = setup();
    jest
      .mocked(deps.organizerRepository.findApplicationByUserId)
      .mockResolvedValue(row);
    return { deps, service: createOrganizerService(deps) };
  }

  it("looks up the application of the signed-in user and returns it as pending", async () => {
    const { deps, service } = setupApplication(applicationRow);

    const result = await service.getOwnApplication(user.id);

    expect(
      deps.organizerRepository.findApplicationByUserId,
    ).toHaveBeenCalledWith(user.id);
    expect(result).toEqual({
      status: "pending",
      organizationName: "Acme Events",
      organizationWebsite: "https://acme.test",
      appliedAt: "2026-10-17T10:00:00.000Z",
      emailVerifiedAt: "2026-10-17T10:05:00.000Z",
      verifiedAt: null,
      rejectedAt: null,
      rejectionReason: null,
    });
  });

  it("a rejected application has status rejected and carries the reason", async () => {
    const { service } = setupApplication({
      ...applicationRow,
      rejectedAt: new Date("2026-10-20T09:00:00.000Z"),
      rejectionReason: "Website could not be verified",
    });

    const result = await service.getOwnApplication(user.id);

    expect(result).toMatchObject({
      status: "rejected",
      rejectedAt: "2026-10-20T09:00:00.000Z",
      rejectionReason: "Website could not be verified",
    });
  });

  it("a verified application has status verified", async () => {
    const { service } = setupApplication({
      ...applicationRow,
      verifiedAt: new Date("2026-10-19T09:00:00.000Z"),
    });

    expect((await service.getOwnApplication(user.id)).status).toBe("verified");
  });

  it("returns 404 for a user without an organizer profile", async () => {
    const { service } = setupApplication(null);

    await expect(service.getOwnApplication(user.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("organizerService.assertVerifiedOrganizer", () => {
  const organizer = { id: user.id, role: "organizer" as const };

  function setupVerification(
    profileRow: { verifiedAt: Date | null; rejectedAt: Date | null } | null,
  ) {
    return setup({
      organizerRepository: {
        createOrganizerAccount: jest.fn(),
        listOrganizers: jest.fn(),
        verifyOrganizer: jest.fn(),
        findForVerify: jest.fn(),
        findInviteeById: jest.fn(),
        deleteUnverifiedOrganizer: jest.fn(),
        findVerificationByUserId: jest.fn().mockResolvedValue(profileRow),
        rejectPendingOrganizer: jest.fn(),
        reopenRejectedOrganizer: jest.fn(),
        findApplicationByUserId: jest.fn(),
        findDetail: jest.fn(),
      },
    });
  }

  it("lets an approved organizer through", async () => {
    const { deps, service } = setupVerification({
      verifiedAt: verifiedRow.verifiedAt,
      rejectedAt: null,
    });

    await expect(
      service.assertVerifiedOrganizer(organizer),
    ).resolves.toBeUndefined();
    expect(
      deps.organizerRepository.findVerificationByUserId,
    ).toHaveBeenCalledWith(user.id);
  });

  it("refuses (403 ORGANIZER_NOT_VERIFIED) an organizer still waiting for approval", async () => {
    const { service } = setupVerification({
      verifiedAt: null,
      rejectedAt: null,
    });

    const error = await service
      .assertVerifiedOrganizer(organizer)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error).toMatchObject({
      status: 403,
      code: "ORGANIZER_NOT_VERIFIED",
    });
  });

  it("refuses (403 ORGANIZER_REJECTED) a rejected organizer", async () => {
    const { service } = setupVerification({
      verifiedAt: null,
      rejectedAt: new Date("2026-10-20T09:00:00.000Z"),
    });

    await expect(
      service.assertVerifiedOrganizer(organizer),
    ).rejects.toMatchObject({ status: 403, code: "ORGANIZER_REJECTED" });
  });

  it("refuses an organizer with no organizer profile (deny by default)", async () => {
    const { service } = setupVerification(null);

    await expect(
      service.assertVerifiedOrganizer(organizer),
    ).rejects.toMatchObject({ code: "ORGANIZER_NOT_VERIFIED" });
  });

  it("never blocks an admin, and does not even look them up", async () => {
    const { deps, service } = setupVerification(null);

    await expect(
      service.assertVerifiedOrganizer({ id: user.id, role: "admin" }),
    ).resolves.toBeUndefined();
    expect(
      deps.organizerRepository.findVerificationByUserId,
    ).not.toHaveBeenCalled();
  });
});
