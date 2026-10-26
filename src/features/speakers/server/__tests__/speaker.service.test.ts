import {
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from "../../../../core/http/errors";
import type { CmsSpeaker } from "../../../cms";
import {
  createSpeakerBodySchema,
  getSpeakersResponseSchema,
  listSpeakersQuerySchema,
  ownSpeakerProfileResponseSchema,
  speakerExistsDetailsSchema,
  speakerProfileResponseSchema,
  speakerSlugParamsSchema,
  updateOwnSpeakerProfileBodySchema,
} from "../../schemas/speaker.schemas";
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

// What findAccountByEmail returns when the email already belongs to a speaker.
const existingSpeakerAccount = {
  speaker: {
    id: profile.id,
    firstName: "Ankit",
    lastName: "Sharma",
    email: "ankit@speaker.test",
    slug: "ankit-sharma-3f9a1c",
    status: "pending" as const,
  },
};
// ...and when it belongs to an account with another role (user, organizer, admin).
const otherRoleAccount = { speaker: null };

type SetupOverrides = Partial<
  Omit<SpeakerServiceDeps, "speakerRepository" | "strapiClient">
> & {
  /** Replace only these repository methods; the rest keep their defaults. */
  repo?: Partial<SpeakerServiceDeps["speakerRepository"]>;
  /** Replace only these Strapi client methods. */
  strapi?: Partial<SpeakerServiceDeps["strapiClient"]>;
};

function setup({ repo, strapi, ...overrides }: SetupOverrides = {}) {
  const deps = {
    speakerRepository: {
      findAccountByEmail: jest.fn().mockResolvedValue(null),
      createSpeaker: jest.fn().mockResolvedValue({ ok: true, user, profile }),
      listSpeakers: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
      findBySlug: jest.fn().mockResolvedValue(null),
      findOwnSpeaker: jest.fn().mockResolvedValue(null),
      updateNames: jest.fn().mockResolvedValue(undefined),
      setCmsSpeakerId: jest.fn().mockResolvedValue(undefined),
      findInviteeBySlug: jest.fn().mockResolvedValue(null),
      ...repo,
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
      createSpeaker: jest
        .fn()
        .mockResolvedValue({ documentId: "strapi-doc-1" }),
      deleteSpeaker: jest.fn().mockResolvedValue(undefined),
      findSpeakersByIds: jest.fn().mockResolvedValue([]),
      findSpeakerById: jest.fn().mockResolvedValue(null),
      updateSpeaker: jest.fn().mockResolvedValue(null),
      uploadFiles: jest.fn().mockResolvedValue({ ok: true, files: [] }),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      ...strapi,
    },
    createSlug: jest.fn().mockReturnValue("ankit-sharma-3f9a1c"),
    appUrl: "http://localhost:3000",
    ...overrides,
  } satisfies SpeakerServiceDeps;
  return { deps, service: createSpeakerService(deps) };
}

describe("speakerService.createSpeaker", () => {
  it("creates the Strapi entry first, then saves its documentId with the inviter", async () => {
    const { deps, service } = setup();

    await service.createSpeaker(input, organizerId);

    expect(deps.strapiClient.createSpeaker).toHaveBeenCalledWith({
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

  it("returns 409 SPEAKER_EXISTS with the speaker's basic details when the speaker exists", async () => {
    const { deps, service } = setup({
      repo: {
        findAccountByEmail: jest.fn().mockResolvedValue(existingSpeakerAccount),
        createSpeaker: jest.fn(),
      },
    });

    const error = await service
      .createSpeaker(input, organizerId)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({
      status: 409,
      code: "SPEAKER_EXISTS",
      details: { speaker: existingSpeakerAccount.speaker },
    });
    // The details match the schema the UI will parse them with.
    expect(
      speakerExistsDetailsSchema.safeParse((error as ConflictError).details)
        .success,
    ).toBe(true);
    expect(deps.strapiClient.createSpeaker).not.toHaveBeenCalled();
    expect(deps.speakerRepository.createSpeaker).not.toHaveBeenCalled();
  });

  it("returns 409 EMAIL_TAKEN with no details when the email has another role", async () => {
    const { deps, service } = setup({
      repo: {
        findAccountByEmail: jest.fn().mockResolvedValue(otherRoleAccount),
        createSpeaker: jest.fn(),
      },
    });

    const error = await service
      .createSpeaker(input, organizerId)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ status: 409, code: "EMAIL_TAKEN" });
    expect((error as ConflictError).details).toBeUndefined();
    // Never says which role owns the email.
    expect((error as ConflictError).message).not.toMatch(/organizer|admin/i);
    expect(deps.strapiClient.createSpeaker).not.toHaveBeenCalled();
    expect(deps.speakerRepository.createSpeaker).not.toHaveBeenCalled();
  });

  it("returns 503 and saves nothing when Strapi is unavailable", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const { deps, service } = setup({
      strapi: {
        createSpeaker: jest.fn().mockRejectedValue(new Error("fetch failed")),
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

  it("deletes the Strapi entry and returns SPEAKER_EXISTS when another invite won the race", async () => {
    const { deps, service } = setup({
      repo: {
        // Free at the first look; taken by the other invite at the second.
        findAccountByEmail: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(existingSpeakerAccount),
        createSpeaker: jest
          .fn()
          .mockResolvedValue({ ok: false, reason: "EMAIL_TAKEN" }),
      },
    });

    const error = await service
      .createSpeaker(input, organizerId)
      .catch((e: unknown) => e);

    expect(error).toMatchObject({
      status: 409,
      code: "SPEAKER_EXISTS",
      details: { speaker: existingSpeakerAccount.speaker },
    });
    expect(deps.strapiClient.deleteSpeaker).toHaveBeenCalledWith(
      "strapi-doc-1",
    );
    expect(deps.enqueueAccountSetupEmail).not.toHaveBeenCalled();
  });

  it("returns EMAIL_TAKEN after a lost race when the winner has another role", async () => {
    const { deps, service } = setup({
      repo: {
        findAccountByEmail: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(otherRoleAccount),
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
  });

  it("deletes the Strapi entry and rethrows when the DB insert fails", async () => {
    const dbError = new Error("connection lost");
    const { deps, service } = setup({
      repo: {
        findAccountByEmail: jest.fn().mockResolvedValue(null),
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
      repo: {
        findAccountByEmail: jest.fn().mockResolvedValue(null),
        createSpeaker: jest.fn().mockRejectedValue(dbError),
      },
      strapi: {
        createSpeaker: jest
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

// ---------- public reads ----------

const ankitRow = {
  slug: "ankit-sharma-3f9a1c",
  firstName: "Ankit",
  lastName: "Sharma",
  cmsSpeakerId: "doc-ankit",
};
const priyaRow = {
  slug: "priya-rao-7b2e4d",
  firstName: "Priya",
  lastName: "Rao",
  cmsSpeakerId: "doc-priya",
};
// A speaker whose CMS entry was never linked.
const unlinkedRow = {
  slug: "ravi-k-1a2b3c",
  firstName: "Ravi",
  lastName: "K",
  cmsSpeakerId: null,
};

const ankitCms: CmsSpeaker = {
  documentId: "doc-ankit",
  bio: [{ type: "paragraph", children: [{ type: "text", text: "Hi" }] }],
  photo: {
    id: 9,
    url: "http://cms.test/uploads/ankit.jpg",
    alt: null,
    width: 400,
    height: 400,
  },
  company: "Acme",
  jobTitle: "Staff Engineer",
  linkedinUrl: "https://linkedin.com/in/ankit",
  twitterUrl: "javascript:alert(1)",
  websiteUrl: null,
  expertise: ["TypeScript", "Postgres"],
};

describe("speakerService.listSpeakers", () => {
  const query = { page: 2, pageSize: 2 };

  it("pages Postgres and merges CMS content fetched in ONE call", async () => {
    const { deps, service } = setup({
      repo: {
        listSpeakers: jest
          .fn()
          .mockResolvedValue({ rows: [ankitRow, priyaRow], total: 5 }),
      },
      strapi: { findSpeakersByIds: jest.fn().mockResolvedValue([ankitCms]) },
    });

    const result = await service.listSpeakers(query);

    expect(deps.speakerRepository.listSpeakers).toHaveBeenCalledWith({
      search: undefined,
      limit: 2,
      offset: 2,
    });
    expect(deps.strapiClient.findSpeakersByIds).toHaveBeenCalledTimes(1);
    expect(deps.strapiClient.findSpeakersByIds).toHaveBeenCalledWith([
      "doc-ankit",
      "doc-priya",
    ]);
    expect(result.meta).toEqual({ page: 2, pageSize: 2, total: 5 });
    expect(result.items).toEqual([
      {
        slug: "ankit-sharma-3f9a1c",
        firstName: "Ankit",
        lastName: "Sharma",
        profile: {
          // No alt in the CMS → the speaker's name.
          photo: {
            url: "http://cms.test/uploads/ankit.jpg",
            alt: "Ankit Sharma",
            width: 400,
            height: 400,
          },
          jobTitle: "Staff Engineer",
          company: "Acme",
        },
      },
      // In Postgres but not returned by Strapi → name only.
      {
        slug: "priya-rao-7b2e4d",
        firstName: "Priya",
        lastName: "Rao",
        profile: null,
      },
    ]);
    expect(getSpeakersResponseSchema.safeParse(result.items).success).toBe(
      true,
    );
  });

  it("does not ask Strapi for speakers without a CMS id", async () => {
    const { deps, service } = setup({
      repo: {
        listSpeakers: jest
          .fn()
          .mockResolvedValue({ rows: [unlinkedRow, ankitRow], total: 2 }),
      },
    });

    await service.listSpeakers(query);

    expect(deps.strapiClient.findSpeakersByIds).toHaveBeenCalledWith([
      "doc-ankit",
    ]);
  });

  it("passes the search on, and treats an empty one as no search", async () => {
    const { deps, service } = setup();

    await service.listSpeakers({ ...query, search: "ank" });
    await service.listSpeakers({ ...query, search: "" });

    expect(deps.speakerRepository.listSpeakers).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ search: "ank" }),
    );
    expect(deps.speakerRepository.listSpeakers).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ search: undefined }),
    );
  });

  it("still lists every speaker by name when Strapi is down (ERR-4)", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const { service } = setup({
      repo: {
        listSpeakers: jest
          .fn()
          .mockResolvedValue({ rows: [ankitRow, priyaRow], total: 2 }),
      },
      strapi: {
        findSpeakersByIds: jest.fn().mockRejectedValue(new Error("timeout")),
      },
    });

    const result = await service.listSpeakers(query);

    expect(result.items.map((item) => item.profile)).toEqual([null, null]);
    expect(result.items.map((item) => item.firstName)).toEqual([
      "Ankit",
      "Priya",
    ]);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("never exposes CMS ids or other internals", async () => {
    const { service } = setup({
      repo: {
        listSpeakers: jest
          .fn()
          .mockResolvedValue({ rows: [ankitRow], total: 1 }),
      },
      strapi: { findSpeakersByIds: jest.fn().mockResolvedValue([ankitCms]) },
    });

    const result = await service.listSpeakers(query);

    expect(JSON.stringify(result)).not.toContain("doc-ankit");
  });
});

describe("speakerService.getSpeakerBySlug", () => {
  it("returns the full profile: bio, expertise and only safe links", async () => {
    const { deps, service } = setup({
      repo: { findBySlug: jest.fn().mockResolvedValue(ankitRow) },
      strapi: { findSpeakerById: jest.fn().mockResolvedValue(ankitCms) },
    });

    const result = await service.getSpeakerBySlug("ankit-sharma-3f9a1c");

    expect(deps.strapiClient.findSpeakerById).toHaveBeenCalledWith("doc-ankit");
    expect(result.profile).toMatchObject({
      jobTitle: "Staff Engineer",
      company: "Acme",
      bio: ankitCms.bio,
      expertise: ["TypeScript", "Postgres"],
      links: {
        linkedin: "https://linkedin.com/in/ankit",
        // "javascript:" is dropped, never sent to the page.
        twitter: null,
        website: null,
      },
    });
    expect(speakerProfileResponseSchema.safeParse(result).success).toBe(true);
    expect(JSON.stringify(result)).not.toContain("doc-ankit");
  });

  it("returns 404 for an unknown slug without calling Strapi", async () => {
    const { deps, service } = setup();

    const error = await service
      .getSpeakerBySlug("nobody-000000")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
    expect(deps.strapiClient.findSpeakerById).not.toHaveBeenCalled();
  });

  it("returns the name with profile null when the CMS entry is missing", async () => {
    const { service } = setup({
      repo: { findBySlug: jest.fn().mockResolvedValue(ankitRow) },
      strapi: { findSpeakerById: jest.fn().mockResolvedValue(null) },
    });

    const result = await service.getSpeakerBySlug("ankit-sharma-3f9a1c");

    expect(result).toEqual({
      slug: "ankit-sharma-3f9a1c",
      firstName: "Ankit",
      lastName: "Sharma",
      profile: null,
    });
  });

  it("returns the name with profile null when Strapi is down (ERR-4)", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const { service } = setup({
      repo: { findBySlug: jest.fn().mockResolvedValue(ankitRow) },
      strapi: {
        findSpeakerById: jest.fn().mockRejectedValue(new Error("timeout")),
      },
    });

    const result = await service.getSpeakerBySlug("ankit-sharma-3f9a1c");

    expect(result.profile).toBeNull();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("does not call Strapi for a speaker without a CMS id", async () => {
    const { deps, service } = setup({
      repo: { findBySlug: jest.fn().mockResolvedValue(unlinkedRow) },
    });

    const result = await service.getSpeakerBySlug("ravi-k-1a2b3c");

    expect(result.profile).toBeNull();
    expect(deps.strapiClient.findSpeakerById).not.toHaveBeenCalled();
  });
});

describe("listSpeakersQuerySchema", () => {
  it("defaults to page 1 with 5 speakers", () => {
    expect(listSpeakersQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 5,
    });
  });

  it("coerces strings and trims the search", () => {
    expect(
      listSpeakersQuerySchema.parse({
        page: "3",
        pageSize: "20",
        search: " ank ",
      }),
    ).toEqual({ page: 3, pageSize: 20, search: "ank" });
  });

  it("rejects a page size over 50", () => {
    expect(listSpeakersQuerySchema.safeParse({ pageSize: "500" }).success).toBe(
      false,
    );
  });
});

describe("speakerSlugParamsSchema", () => {
  it("accepts a slug as createSpeakerSlug makes it", () => {
    expect(
      speakerSlugParamsSchema.safeParse({ slug: "ankit-sharma-3f9a1c" })
        .success,
    ).toBe(true);
  });

  it.each(["Ankit", "ankit sharma", "../etc", "-ankit", "ankit--sharma", ""])(
    "rejects %p",
    (slug) => {
      expect(speakerSlugParamsSchema.safeParse({ slug }).success).toBe(false);
    },
  );
});

// ---------- the speaker's own profile ----------

const userId = user.id;
// What findOwnSpeaker returns for the logged-in speaker.
const ownRow = { id: profile.id, ...ankitRow };

describe("speakerService.getOwnProfile", () => {
  it("returns the form values: bio as text, links as stored, photo without its file id", async () => {
    const { deps, service } = setup({
      repo: { findOwnSpeaker: jest.fn().mockResolvedValue(ownRow) },
      strapi: { findSpeakerById: jest.fn().mockResolvedValue(ankitCms) },
    });

    const result = await service.getOwnProfile(userId);

    expect(deps.speakerRepository.findOwnSpeaker).toHaveBeenCalledWith(userId);
    expect(result).toEqual({
      slug: "ankit-sharma-3f9a1c",
      firstName: "Ankit",
      lastName: "Sharma",
      jobTitle: "Staff Engineer",
      company: "Acme",
      bio: "Hi",
      expertise: ["TypeScript", "Postgres"],
      linkedinUrl: "https://linkedin.com/in/ankit",
      // Shown as stored, so the speaker can see and fix it.
      twitterUrl: "javascript:alert(1)",
      websiteUrl: null,
      photo: {
        url: "http://cms.test/uploads/ankit.jpg",
        alt: "Ankit Sharma",
        width: 400,
        height: 400,
      },
    });
    expect(ownSpeakerProfileResponseSchema.safeParse(result).success).toBe(
      true,
    );
  });

  it("returns 404 when the user is not a speaker", async () => {
    const { service } = setup();

    await expect(service.getOwnProfile(userId)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("returns 503 instead of an empty form when Strapi is down", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const { service } = setup({
      repo: { findOwnSpeaker: jest.fn().mockResolvedValue(ownRow) },
      strapi: {
        findSpeakerById: jest.fn().mockRejectedValue(new Error("timeout")),
      },
    });

    // An empty form saved back would wipe the real profile.
    await expect(service.getOwnProfile(userId)).rejects.toMatchObject({
      status: 503,
      code: "CMS_UNAVAILABLE",
    });
    log.mockRestore();
  });

  it("starts with an empty form when no Strapi entry is linked yet", async () => {
    const { deps, service } = setup({
      repo: {
        findOwnSpeaker: jest
          .fn()
          .mockResolvedValue({ ...ownRow, cmsSpeakerId: null }),
      },
    });

    const result = await service.getOwnProfile(userId);

    expect(result).toMatchObject({ bio: "", expertise: [], photo: null });
    expect(deps.strapiClient.findSpeakerById).not.toHaveBeenCalled();
  });
});

describe("speakerService.updateOwnProfile", () => {
  const parse = (body: unknown) =>
    updateOwnSpeakerProfileBodySchema.parse(body);

  it("sends only the changed content to Strapi, bio as blocks, and leaves names alone", async () => {
    const { deps, service } = setup({
      repo: { findOwnSpeaker: jest.fn().mockResolvedValue(ownRow) },
      strapi: {
        updateSpeaker: jest
          .fn()
          .mockResolvedValue({ ...ankitCms, company: "NewCo" }),
      },
    });

    const result = await service.updateOwnProfile(
      userId,
      parse({ company: "NewCo", bio: "Line one.\n\nLine two." }),
    );

    expect(deps.strapiClient.updateSpeaker).toHaveBeenCalledWith("doc-ankit", {
      company: "NewCo",
      bio: [
        { type: "paragraph", children: [{ type: "text", text: "Line one." }] },
        { type: "paragraph", children: [{ type: "text", text: "Line two." }] },
      ],
    });
    expect(deps.speakerRepository.updateNames).not.toHaveBeenCalled();
    expect(result.company).toBe("NewCo");
  });

  it("renames in Postgres, keeps Strapi's name in sync, and never changes the slug", async () => {
    const { deps, service } = setup({
      repo: { findOwnSpeaker: jest.fn().mockResolvedValue(ownRow) },
      strapi: { updateSpeaker: jest.fn().mockResolvedValue(ankitCms) },
    });

    const result = await service.updateOwnProfile(
      userId,
      parse({ firstName: "Ankita" }),
    );

    expect(deps.strapiClient.updateSpeaker).toHaveBeenCalledWith("doc-ankit", {
      name: "Ankita Sharma",
    });
    expect(deps.speakerRepository.updateNames).toHaveBeenCalledWith(userId, {
      firstName: "Ankita",
      lastName: "Sharma",
    });
    expect(result).toMatchObject({
      firstName: "Ankita",
      slug: "ankit-sharma-3f9a1c",
    });
  });

  it("clears fields sent as null or empty", async () => {
    const { deps, service } = setup({
      repo: { findOwnSpeaker: jest.fn().mockResolvedValue(ownRow) },
      strapi: { updateSpeaker: jest.fn().mockResolvedValue(ankitCms) },
    });

    await service.updateOwnProfile(
      userId,
      parse({ jobTitle: "", bio: null, twitterUrl: "" }),
    );

    expect(deps.strapiClient.updateSpeaker).toHaveBeenCalledWith("doc-ankit", {
      jobTitle: null,
      bio: null,
      twitterUrl: null,
    });
  });

  it("does not touch Strapi or Postgres when the same name is sent again", async () => {
    const { deps, service } = setup({
      repo: { findOwnSpeaker: jest.fn().mockResolvedValue(ownRow) },
      strapi: { findSpeakerById: jest.fn().mockResolvedValue(ankitCms) },
    });

    await service.updateOwnProfile(userId, parse({ firstName: "Ankit" }));

    expect(deps.strapiClient.updateSpeaker).not.toHaveBeenCalled();
    expect(deps.speakerRepository.updateNames).not.toHaveBeenCalled();
  });

  it("returns 503 and leaves Postgres untouched when Strapi is down", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const { deps, service } = setup({
      repo: { findOwnSpeaker: jest.fn().mockResolvedValue(ownRow) },
      strapi: {
        updateSpeaker: jest.fn().mockRejectedValue(new Error("timeout")),
      },
    });

    const error = await service
      .updateOwnProfile(userId, parse({ firstName: "Ankita", company: "X" }))
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableError);
    expect(deps.speakerRepository.updateNames).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("creates and links a Strapi entry first when none is linked", async () => {
    const { deps, service } = setup({
      repo: {
        findOwnSpeaker: jest
          .fn()
          .mockResolvedValue({ ...ownRow, cmsSpeakerId: null }),
      },
      strapi: {
        createSpeaker: jest.fn().mockResolvedValue({ documentId: "doc-new" }),
        updateSpeaker: jest.fn().mockResolvedValue(ankitCms),
      },
    });

    await service.updateOwnProfile(userId, parse({ company: "Acme" }));

    expect(deps.strapiClient.createSpeaker).toHaveBeenCalledWith({
      name: "Ankit Sharma",
    });
    expect(deps.speakerRepository.setCmsSpeakerId).toHaveBeenCalledWith(
      profile.id,
      "doc-new",
    );
    expect(deps.strapiClient.updateSpeaker).toHaveBeenCalledWith("doc-new", {
      company: "Acme",
    });
  });

  it("re-creates and re-links the entry when it was deleted in Strapi", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const { deps, service } = setup({
      repo: { findOwnSpeaker: jest.fn().mockResolvedValue(ownRow) },
      strapi: {
        createSpeaker: jest.fn().mockResolvedValue({ documentId: "doc-new" }),
        // The linked entry is gone (404 → null); the new one works.
        updateSpeaker: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(ankitCms),
      },
    });

    await service.updateOwnProfile(userId, parse({ company: "Acme" }));

    expect(deps.speakerRepository.setCmsSpeakerId).toHaveBeenCalledWith(
      profile.id,
      "doc-new",
    );
    expect(deps.strapiClient.updateSpeaker).toHaveBeenLastCalledWith(
      "doc-new",
      {
        company: "Acme",
      },
    );
    log.mockRestore();
  });

  it("returns 404 when the user is not a speaker", async () => {
    const { deps, service } = setup();

    await expect(
      service.updateOwnProfile(userId, parse({ company: "X" })),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(deps.strapiClient.updateSpeaker).not.toHaveBeenCalled();
  });
});

describe("speakerService.replaceOwnPhoto", () => {
  const upload = (bytes = 10) => ({
    body: new Blob([new Uint8Array(bytes)]).stream(),
    contentType: "multipart/form-data; boundary=abc",
  });
  const newFile = {
    id: 31,
    mime: "image/jpeg",
    size: 300,
    width: 800,
    height: 800,
  };
  const cmsWithNewPhoto: CmsSpeaker = {
    ...ankitCms,
    photo: {
      id: 31,
      url: "http://cms.test/uploads/new.jpg",
      alt: null,
      width: 800,
      height: 800,
    },
  };

  // A speaker whose current photo is file 9.
  function photoSetup(
    strapi: Partial<SpeakerServiceDeps["strapiClient"]> = {},
  ) {
    return setup({
      repo: { findOwnSpeaker: jest.fn().mockResolvedValue(ownRow) },
      strapi: {
        findSpeakerById: jest.fn().mockResolvedValue(ankitCms),
        uploadFiles: jest
          .fn()
          .mockResolvedValue({ ok: true, files: [newFile] }),
        updateSpeaker: jest.fn().mockResolvedValue(cmsWithNewPhoto),
        ...strapi,
      },
    });
  }

  it("streams the upload to Strapi, sets it as the photo, then deletes the old one", async () => {
    const { deps, service } = photoSetup();
    const photoUpload = upload();

    const result = await service.replaceOwnPhoto(userId, photoUpload);

    expect(deps.strapiClient.uploadFiles).toHaveBeenCalledWith(
      expect.any(ReadableStream),
      "multipart/form-data; boundary=abc",
    );
    expect(deps.strapiClient.updateSpeaker).toHaveBeenCalledWith("doc-ankit", {
      photo: 31,
    });
    expect(deps.strapiClient.deleteFile).toHaveBeenCalledWith(9);
    expect(deps.strapiClient.deleteFile).not.toHaveBeenCalledWith(31);
    expect(result).toEqual({
      photo: {
        url: "http://cms.test/uploads/new.jpg",
        alt: "Ankit Sharma",
        width: 800,
        height: 800,
      },
    });
  });

  it("deletes the upload and returns 400 when it is not an image (e.g. a PDF)", async () => {
    const { deps, service } = photoSetup({
      uploadFiles: jest.fn().mockResolvedValue({
        ok: true,
        files: [
          { ...newFile, mime: "application/pdf", width: null, height: null },
        ],
      }),
    });

    const error = await service
      .replaceOwnPhoto(userId, upload())
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(deps.strapiClient.deleteFile).toHaveBeenCalledWith(31);
    expect(deps.strapiClient.updateSpeaker).not.toHaveBeenCalled();
  });

  it("deletes every file and returns 400 when more than one was sent", async () => {
    const { deps, service } = photoSetup({
      uploadFiles: jest.fn().mockResolvedValue({
        ok: true,
        files: [newFile, { ...newFile, id: 32 }],
      }),
    });

    await expect(
      service.replaceOwnPhoto(userId, upload()),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(deps.strapiClient.deleteFile).toHaveBeenCalledWith(31);
    expect(deps.strapiClient.deleteFile).toHaveBeenCalledWith(32);
  });

  it("returns 400 when Strapi itself refuses the file", async () => {
    const { deps, service } = photoSetup({
      uploadFiles: jest.fn().mockResolvedValue({ ok: false, status: 415 }),
    });

    await expect(
      service.replaceOwnPhoto(userId, upload()),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(deps.strapiClient.updateSpeaker).not.toHaveBeenCalled();
  });

  it("cuts off a body over the size limit while streaming → 400", async () => {
    const { deps, service } = photoSetup({
      // Like real fetch: reads the (size-limited) stream, which errors past the limit.
      uploadFiles: jest.fn(async (body: ReadableStream<Uint8Array>) => {
        const reader = body.getReader();
        for (;;) {
          const { done } = await reader.read();
          if (done) return { ok: true as const, files: [newFile] };
        }
      }),
    });

    const error = await service
      .replaceOwnPhoto(userId, upload(3 * 1024 * 1024))
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(deps.strapiClient.updateSpeaker).not.toHaveBeenCalled();
  });

  it("returns 503 when the upload to Strapi fails", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const { service } = photoSetup({
      uploadFiles: jest.fn().mockRejectedValue(new Error("connection reset")),
    });

    await expect(
      service.replaceOwnPhoto(userId, upload()),
    ).rejects.toMatchObject({
      status: 503,
    });
    log.mockRestore();
  });

  it("deletes the new file and keeps the old photo when setting it fails", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const { deps, service } = photoSetup({
      updateSpeaker: jest.fn().mockRejectedValue(new Error("timeout")),
    });

    await expect(
      service.replaceOwnPhoto(userId, upload()),
    ).rejects.toMatchObject({
      status: 503,
    });
    expect(deps.strapiClient.deleteFile).toHaveBeenCalledWith(31);
    expect(deps.strapiClient.deleteFile).not.toHaveBeenCalledWith(9);
    log.mockRestore();
  });

  it("deletes nothing old when the speaker had no photo", async () => {
    const { deps, service } = photoSetup({
      findSpeakerById: jest
        .fn()
        .mockResolvedValue({ ...ankitCms, photo: null }),
    });

    await service.replaceOwnPhoto(userId, upload());

    expect(deps.strapiClient.deleteFile).not.toHaveBeenCalled();
  });

  it("returns 404 for a non-speaker before sending anything to Strapi", async () => {
    const { deps, service } = setup();

    await expect(
      service.replaceOwnPhoto(userId, upload()),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(deps.strapiClient.uploadFiles).not.toHaveBeenCalled();
  });
});

describe("updateOwnSpeakerProfileBodySchema", () => {
  const parse = (body: unknown) =>
    updateOwnSpeakerProfileBodySchema.safeParse(body);

  it("rejects an empty body", () => {
    expect(parse({}).success).toBe(false);
  });

  it("ignores fields that are not editable here (email, slug, ids)", () => {
    const result = parse({ company: "Acme", email: "x@y.z", slug: "admin" });

    expect(result.success && result.data).toEqual({ company: "Acme" });
  });

  it("rejects a body with only non-editable fields", () => {
    expect(parse({ email: "x@y.z" }).success).toBe(false);
  });

  it("turns empty text into null (clear) and leaves missing fields undefined", () => {
    const result = parse({ jobTitle: "  ", linkedinUrl: "" });

    expect(result.success && result.data).toEqual({
      jobTitle: null,
      linkedinUrl: null,
    });
  });

  it("rejects a javascript: link", () => {
    expect(parse({ websiteUrl: "javascript:alert(1)" }).success).toBe(false);
  });

  it("does not allow clearing a name", () => {
    expect(parse({ firstName: " " }).success).toBe(false);
  });

  it("limits expertise to 10 topics and removes duplicates", () => {
    expect(parse({ expertise: Array(11).fill("x") }).success).toBe(false);

    const result = parse({ expertise: ["Go", "go", " Rust "] });
    expect(result.success && result.data.expertise).toEqual(["Go", "Rust"]);
  });
});

describe("speakerService.resendInvite", () => {
  it("finds the speaker's account by slug and re-sends the invite to it", async () => {
    const { deps, service } = setup({
      repo: { findInviteeBySlug: jest.fn().mockResolvedValue({ userId }) },
    });

    const result = await service.resendInvite("ankit-sharma-3f9a1c");

    expect(deps.speakerRepository.findInviteeBySlug).toHaveBeenCalledWith(
      "ankit-sharma-3f9a1c",
    );
    expect(deps.accountInviteService.resendAccountSetup).toHaveBeenCalledWith(
      userId,
    );
    expect(result).toEqual({
      setupEmailQueued: true,
      expiresAt: "2026-10-26T10:00:00.000Z",
    });
  });

  it("returns 404 for an unknown slug without sending anything", async () => {
    const { deps, service } = setup();

    await expect(service.resendInvite("nobody-000000")).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(deps.accountInviteService.resendAccountSetup).not.toHaveBeenCalled();
  });

  it("passes the invite service's answer on (e.g. 409 already active)", async () => {
    const alreadyActive = new ConflictError("ACCOUNT_ALREADY_ACTIVE", "done");
    const { service } = setup({
      repo: { findInviteeBySlug: jest.fn().mockResolvedValue({ userId }) },
      accountInviteService: {
        resendAccountSetup: jest.fn().mockRejectedValue(alreadyActive),
      },
    });

    await expect(service.resendInvite("ankit-sharma-3f9a1c")).rejects.toBe(
      alreadyActive,
    );
  });
});
