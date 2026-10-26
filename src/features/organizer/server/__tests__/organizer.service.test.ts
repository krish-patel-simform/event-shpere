import {
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
} from "../../../../core/http/errors";
import { createOrganizerBodySchema } from "../../schemas/organizer.schemas";
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

// What findForVerify returns for an organizer that is not verified yet.
const unverifiedOrganizer = {
  email: "olga@acme.test",
  firstName: "Olga",
  lastName: "Organizer",
  verifiedAt: null,
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
