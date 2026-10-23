import {
  ConflictError,
  ServiceUnavailableError,
} from "../../../../core/http/errors";
import { createSpeakerBodySchema } from "../../schemas/speaker.schemas";
import {
  createSpeakerService,
  type SpeakerServiceDeps,
} from "../speaker.service";

// Empty factories: env, DB, Redis and the other features' server code are never loaded.
jest.mock("../../../../config/env", () => ({ env: {} }));
jest.mock("../speaker.repository", () => ({}));
jest.mock("../../../auth/server", () => ({}));
jest.mock("../../../email/server", () => ({}));
jest.mock("../../../cms/server", () => ({}));

const createdAt = new Date("2026-10-23T10:00:00.000Z");
const organizerId = "5d1c3a4b-7e8f-4a1b-9c2d-3e4f5a6b7c8d";
const user = {
  id: "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10",
  firstName: "Ankit",
  lastName: "Sharma",
  email: "ankit@speaker.test",
  passwordHash: null,
  emailVerifiedAt: null,
  status: "pending" as const,
  createdAt,
  updatedAt: createdAt,
};
const profile = {
  id: "0b7c2d1e-3f4a-4b5c-8d6e-7f8091a2b3c4",
  userId: user.id,
  slug: "ankit-sharma-3f9a1c",
  cmsSpeakerId: "strapi-doc-1",
  createdBy: organizerId,
  createdAt,
  updatedAt: createdAt,
};
const setupToken = {
  token: "raw-token/with+chars",
  tokenHash: "hashed-token",
  expiresAt: new Date("2026-10-24T10:00:00.000Z"),
};
const input = {
  firstName: "Ankit",
  lastName: "Sharma",
  email: "ankit@speaker.test",
};

function setup(overrides: Partial<SpeakerServiceDeps> = {}) {
  const deps = {
    speakerRepository: {
      emailExists: jest.fn().mockResolvedValue(false),
      createSpeaker: jest.fn().mockResolvedValue({ ok: true, user, profile }),
    },
    createAccountSetupToken: jest.fn().mockReturnValue(setupToken),
    enqueueAccountSetupEmail: jest.fn().mockResolvedValue(undefined),
    strapiClient: {
      createDraftSpeaker: jest
        .fn()
        .mockResolvedValue({ documentId: "strapi-doc-1" }),
      deleteSpeaker: jest.fn().mockResolvedValue(undefined),
    },
    createSlug: jest.fn().mockReturnValue("ankit-sharma-3f9a1c"),
    appUrl: "http://localhost:3000",
    ...overrides,
  } satisfies SpeakerServiceDeps;
  return { deps, service: createSpeakerService(deps) };
}

describe("speakerService.createSpeaker", () => {
  it("creates the Strapi draft first, then saves its documentId with the inviter", async () => {
    const { deps, service } = setup();

    await service.createSpeaker(input, organizerId);

    expect(deps.strapiClient.createDraftSpeaker).toHaveBeenCalledWith({
      name: "Ankit Sharma",
    });
    expect(deps.speakerRepository.createSpeaker).toHaveBeenCalledWith({
      firstName: "Ankit",
      lastName: "Sharma",
      email: "ankit@speaker.test",
      slug: "ankit-sharma-3f9a1c",
      cmsSpeakerId: "strapi-doc-1",
      createdBy: organizerId,
      setupToken: {
        tokenHash: "hashed-token",
        expiresAt: setupToken.expiresAt,
      },
    });
  });

  it("returns a pending speaker without secrets or CMS ids", async () => {
    const { service } = setup();

    const result = await service.createSpeaker(input, organizerId);

    expect(result).toEqual({
      id: profile.id,
      userId: user.id,
      firstName: "Ankit",
      lastName: "Sharma",
      email: "ankit@speaker.test",
      status: "pending",
      slug: "ankit-sharma-3f9a1c",
      createdAt: "2026-10-23T10:00:00.000Z",
      setupEmailQueued: true,
    });
    expect(JSON.stringify(result)).not.toContain("raw-token");
    expect(JSON.stringify(result)).not.toContain("strapi-doc-1");
  });

  it("queues the existing account-setup email with an encoded link", async () => {
    const { deps, service } = setup();

    await service.createSpeaker(input, organizerId);

    expect(deps.enqueueAccountSetupEmail).toHaveBeenCalledWith({
      to: "ankit@speaker.test",
      firstName: "Ankit",
      passwordSetupUrl:
        "http://localhost:3000/set-password?token=raw-token%2Fwith%2Bchars",
      loginUrl: "http://localhost:3000/login",
      expiresInHours: 24,
    });
  });

  it("returns 409 EMAIL_TAKEN without touching Strapi when the email is used", async () => {
    const { deps, service } = setup({
      speakerRepository: {
        emailExists: jest.fn().mockResolvedValue(true),
        createSpeaker: jest.fn(),
      },
    });

    const error = await service
      .createSpeaker(input, organizerId)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ status: 409, code: "EMAIL_TAKEN" });
    expect(deps.strapiClient.createDraftSpeaker).not.toHaveBeenCalled();
    expect(deps.speakerRepository.createSpeaker).not.toHaveBeenCalled();
  });

  it("returns 503 and saves nothing when Strapi is unavailable", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const { deps, service } = setup({
      strapiClient: {
        createDraftSpeaker: jest
          .fn()
          .mockRejectedValue(new Error("fetch failed")),
        deleteSpeaker: jest.fn(),
      },
    });

    const error = await service
      .createSpeaker(input, organizerId)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableError);
    expect(error).toMatchObject({ status: 503, code: "CMS_UNAVAILABLE" });
    expect(deps.speakerRepository.createSpeaker).not.toHaveBeenCalled();
    expect(deps.enqueueAccountSetupEmail).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("deletes the Strapi draft and returns 409 when another invite won the race", async () => {
    const { deps, service } = setup({
      speakerRepository: {
        emailExists: jest.fn().mockResolvedValue(false),
        createSpeaker: jest
          .fn()
          .mockResolvedValue({ ok: false, reason: "EMAIL_TAKEN" }),
      },
    });

    const error = await service
      .createSpeaker(input, organizerId)
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 409, code: "EMAIL_TAKEN" });
    expect(deps.strapiClient.deleteSpeaker).toHaveBeenCalledWith(
      "strapi-doc-1",
    );
    expect(deps.enqueueAccountSetupEmail).not.toHaveBeenCalled();
  });

  it("deletes the Strapi draft and rethrows when the DB insert fails", async () => {
    const dbError = new Error("connection lost");
    const { deps, service } = setup({
      speakerRepository: {
        emailExists: jest.fn().mockResolvedValue(false),
        createSpeaker: jest.fn().mockRejectedValue(dbError),
      },
    });

    await expect(service.createSpeaker(input, organizerId)).rejects.toBe(
      dbError,
    );
    expect(deps.strapiClient.deleteSpeaker).toHaveBeenCalledWith(
      "strapi-doc-1",
    );
  });

  it("keeps the original error when the Strapi cleanup fails too", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const dbError = new Error("connection lost");
    const { service } = setup({
      speakerRepository: {
        emailExists: jest.fn().mockResolvedValue(false),
        createSpeaker: jest.fn().mockRejectedValue(dbError),
      },
      strapiClient: {
        createDraftSpeaker: jest
          .fn()
          .mockResolvedValue({ documentId: "strapi-doc-1" }),
        deleteSpeaker: jest.fn().mockRejectedValue(new Error("Strapi down")),
      },
    });

    await expect(service.createSpeaker(input, organizerId)).rejects.toBe(
      dbError,
    );
    expect(JSON.stringify(log.mock.calls)).toContain("strapi-doc-1");
    log.mockRestore();
  });

  it("still creates the speaker when the email cannot be queued, and says so", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const { deps, service } = setup({
      enqueueAccountSetupEmail: jest
        .fn()
        .mockRejectedValue(new Error("Redis down")),
    });

    const result = await service.createSpeaker(input, organizerId);

    expect(result.setupEmailQueued).toBe(false);
    expect(deps.strapiClient.deleteSpeaker).not.toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain("raw-token");
    log.mockRestore();
  });
});

describe("createSpeakerBodySchema", () => {
  it("lowercases the email and trims names", () => {
    const parsed = createSpeakerBodySchema.parse({
      firstName: "  Ankit ",
      lastName: "Sharma",
      email: " Ankit@SPEAKER.test ",
    });

    expect(parsed.firstName).toBe("Ankit");
    expect(parsed.email).toBe("ankit@speaker.test");
  });

  it("rejects a blank name", () => {
    expect(
      createSpeakerBodySchema.safeParse({ ...input, firstName: "   " }).success,
    ).toBe(false);
  });

  it("drops a slug sent by the client (the server makes it)", () => {
    const parsed = createSpeakerBodySchema.parse({ ...input, slug: "admin" });

    expect(parsed).not.toHaveProperty("slug");
  });
});
