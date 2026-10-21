import { ConflictError, NotFoundError } from "../../../../core/http/errors";
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
    },
    createAccountSetupToken: jest.fn().mockReturnValue(setupToken),
    enqueueAccountSetupEmail: jest.fn().mockResolvedValue(undefined),
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

  it("passes the organizer id and the admin id (from the token) to the repository", async () => {
    const { deps, service } = setup();

    await service.verifyOrganizer(profile.id, adminId);

    expect(deps.organizerRepository.verifyOrganizer).toHaveBeenCalledWith({
      organizerId: profile.id,
      verifierId: adminId,
    });
  });

  it("returns the organizer with an ISO date and the verifier's name", async () => {
    const { service } = setup();

    expect(await service.verifyOrganizer(profile.id, adminId)).toEqual({
      organizerId: profile.id,
      organizationName: "Acme Events",
      organizerFirstName: "Olga",
      organizerLastName: "Organizer",
      verifiedAt: "2026-10-19T09:00:00.000Z",
      verifiedBy: "Ada Admin",
    });
  });

  it("returns 404 for an unknown organizer", async () => {
    const { service } = setup({
      organizerRepository: {
        createOrganizerAccount: jest.fn(),
        listOrganizers: jest.fn(),
        verifyOrganizer: jest.fn().mockResolvedValue(null),
      },
    });

    const error = await service
      .verifyOrganizer(profile.id, adminId)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
  });
});
