import { ZodError } from "zod";
import { StrapiRequestError } from "../strapi-organizer.client";
import { createStrapiSpeakerClient } from "../strapi-speaker.client";

// The real env is never loaded: each test builds its own client.
jest.mock("../../../../config/env", () => ({ env: {} }));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function setup(response: Response, apiToken: string | undefined = "api-token") {
  const fetchMock = jest.fn().mockResolvedValue(response);
  const client = createStrapiSpeakerClient({
    baseUrl: "http://cms.test",
    apiToken,
    fetch: fetchMock,
  });
  return { client, fetchMock };
}

describe("strapiSpeakerClient.createSpeaker", () => {
  it("POSTs a PUBLISHED entry with the Bearer token and returns the documentId", async () => {
    const { client, fetchMock } = setup(
      jsonResponse(201, {
        data: {
          id: 3,
          documentId: "doc-1",
          name: "Ankit Sharma",
          publishedAt: "2026-10-23T10:00:00.000Z",
        },
        meta: {},
      }),
    );

    const result = await client.createSpeaker({ name: "Ankit Sharma" });

    expect(result).toEqual({ documentId: "doc-1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    // Published on purpose: the speaker is usable before they ever log in.
    expect(url).toBe("http://cms.test/api/speakers?status=published");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ authorization: "Bearer api-token" });
    expect(JSON.parse(init.body as string)).toEqual({
      data: { name: "Ankit Sharma" },
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("refuses to call Strapi without an API token", async () => {
    // "" = not set (an `undefined` argument would fall back to the default token).
    const { client, fetchMock } = setup(jsonResponse(201, {}), "");

    await expect(
      client.createSpeaker({ name: "Ankit Sharma" }),
    ).rejects.toThrow("STRAPI_API_TOKEN");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws a non-retryable error for a 403 (token lacks the permission)", async () => {
    const { client } = setup(jsonResponse(403, { error: "Forbidden" }));

    const error = await client
      .createSpeaker({ name: "Ankit Sharma" })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(StrapiRequestError);
    expect(error).toMatchObject({ status: 403, retryable: false });
  });

  it("rejects an unexpected response shape", async () => {
    const { client } = setup(jsonResponse(201, { data: { id: 3 } }));

    await expect(
      client.createSpeaker({ name: "Ankit Sharma" }),
    ).rejects.toBeInstanceOf(ZodError);
  });
});

describe("strapiSpeakerClient.deleteSpeaker", () => {
  it("DELETEs the document by its encoded documentId", async () => {
    const { client, fetchMock } = setup(new Response(null, { status: 204 }));

    await client.deleteSpeaker("doc/1");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://cms.test/api/speakers/doc%2F1");
    expect(init.method).toBe("DELETE");
    expect(init.headers).toMatchObject({ authorization: "Bearer api-token" });
  });

  it("treats 404 (already gone) as done", async () => {
    const { client } = setup(jsonResponse(404, { error: "Not Found" }));

    await expect(client.deleteSpeaker("doc-1")).resolves.toBeUndefined();
  });

  it("throws on a 5xx answer", async () => {
    const { client } = setup(jsonResponse(500, { error: "boom" }));

    await expect(client.deleteSpeaker("doc-1")).rejects.toMatchObject({
      status: 500,
      retryable: true,
    });
  });
});

// A filled-in entry as Strapi 5 returns it (flat, no data.attributes).
const ankitEntry = {
  id: 3,
  documentId: "doc-ankit",
  name: "Ankit Sharma",
  bio: [{ type: "paragraph", children: [{ type: "text", text: "Hi" }] }],
  photo: {
    id: 9,
    url: "/uploads/ankit.jpg",
    alternativeText: "",
    width: 400,
    height: 400,
  },
  company: "Acme",
  jobTitle: "",
  linkedinUrl: "https://linkedin.com/in/ankit",
  twitterUrl: null,
  websiteUrl: null,
  expertise: ["TypeScript"],
  publishedAt: "2026-10-23T10:00:00.000Z",
};

describe("strapiSpeakerClient.findSpeakersByIds", () => {
  it("asks for all ids in ONE published request with the photo populated", async () => {
    const { client, fetchMock } = setup(
      jsonResponse(200, { data: [ankitEntry], meta: {} }),
    );

    await client.findSpeakersByIds(["doc-ankit", "doc-priya"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const { origin, pathname, searchParams } = new URL(url);
    expect(`${origin}${pathname}`).toBe("http://cms.test/api/speakers");
    expect(searchParams.get("filters[documentId][$in][0]")).toBe("doc-ankit");
    expect(searchParams.get("filters[documentId][$in][1]")).toBe("doc-priya");
    expect(searchParams.get("pagination[pageSize]")).toBe("2");
    expect(searchParams.get("populate[photo]")).toBe("true");
    expect(searchParams.get("status")).toBe("published");
    expect(init.headers).toMatchObject({ authorization: "Bearer api-token" });
  });

  it("cleans the entry up: absolute photo URL, empty strings → null", async () => {
    const { client } = setup(jsonResponse(200, { data: [ankitEntry] }));

    const [speaker] = await client.findSpeakersByIds(["doc-ankit"]);

    expect(speaker).toEqual({
      documentId: "doc-ankit",
      bio: ankitEntry.bio,
      photo: {
        id: 9,
        url: "http://cms.test/uploads/ankit.jpg",
        alt: null,
        width: 400,
        height: 400,
      },
      company: "Acme",
      jobTitle: null,
      linkedinUrl: "https://linkedin.com/in/ankit",
      twitterUrl: null,
      websiteUrl: null,
      expertise: ["TypeScript"],
    });
  });

  it("skips (and logs) an invalid entry but keeps the others", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const { client } = setup(
      jsonResponse(200, {
        data: [ankitEntry, { documentId: "doc-bad", company: 42 }],
      }),
    );

    const speakers = await client.findSpeakersByIds(["doc-ankit", "doc-bad"]);

    expect(speakers.map((s) => s.documentId)).toEqual(["doc-ankit"]);
    expect(JSON.stringify(log.mock.calls)).toContain("doc-bad");
    log.mockRestore();
  });

  it("treats a non-list expertise as no expertise instead of a broken entry", async () => {
    const { client } = setup(
      jsonResponse(200, { data: [{ ...ankitEntry, expertise: "TypeScript" }] }),
    );

    const [speaker] = await client.findSpeakersByIds(["doc-ankit"]);

    expect(speaker.expertise).toEqual([]);
  });

  it("returns [] for no ids without calling Strapi", async () => {
    const { client, fetchMock } = setup(jsonResponse(200, { data: [] }));

    expect(await client.findSpeakersByIds([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws on an error status (the service falls back to names only)", async () => {
    const { client } = setup(jsonResponse(403, { error: "Forbidden" }));

    await expect(
      client.findSpeakersByIds(["doc-ankit"]),
    ).rejects.toBeInstanceOf(StrapiRequestError);
  });
});

describe("strapiSpeakerClient.findSpeakerById", () => {
  it("GETs the encoded documentId, published, with the photo", async () => {
    const { client, fetchMock } = setup(
      jsonResponse(200, { data: ankitEntry, meta: {} }),
    );

    const speaker = await client.findSpeakerById("doc/ankit");

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    const { pathname, searchParams } = new URL(url);
    expect(pathname).toBe("/api/speakers/doc%2Fankit");
    expect(searchParams.get("status")).toBe("published");
    expect(searchParams.get("populate[photo]")).toBe("true");
    expect(speaker?.company).toBe("Acme");
  });

  it("returns null when the entry does not exist (404)", async () => {
    const { client } = setup(jsonResponse(404, { data: null }));

    expect(await client.findSpeakerById("doc-gone")).toBeNull();
  });

  it("throws on a 5xx answer", async () => {
    const { client } = setup(jsonResponse(500, { error: "boom" }));

    await expect(client.findSpeakerById("doc-ankit")).rejects.toMatchObject({
      status: 500,
    });
  });
});

describe("strapiSpeakerClient.updateSpeaker", () => {
  it("PUTs only the given fields, publishes, and returns the cleaned entry", async () => {
    const { client, fetchMock } = setup(
      jsonResponse(200, { data: { ...ankitEntry, company: "NewCo" } }),
    );

    const speaker = await client.updateSpeaker("doc-ankit", {
      company: "NewCo",
      twitterUrl: null,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const { pathname, searchParams } = new URL(url);
    expect(pathname).toBe("/api/speakers/doc-ankit");
    // Without status=published the edit would sit in an unpublished draft.
    expect(searchParams.get("status")).toBe("published");
    expect(searchParams.get("populate[photo]")).toBe("true");
    expect(init.method).toBe("PUT");
    expect(init.headers).toMatchObject({ authorization: "Bearer api-token" });
    expect(JSON.parse(init.body as string)).toEqual({
      data: { company: "NewCo", twitterUrl: null },
    });
    expect(speaker?.company).toBe("NewCo");
  });

  it("returns null when the entry no longer exists (404)", async () => {
    const { client } = setup(jsonResponse(404, { data: null }));

    expect(await client.updateSpeaker("doc-gone", { company: "X" })).toBeNull();
  });

  it("throws on a 5xx answer", async () => {
    const { client } = setup(jsonResponse(500, { error: "boom" }));

    await expect(
      client.updateSpeaker("doc-ankit", { company: "X" }),
    ).rejects.toBeInstanceOf(StrapiRequestError);
  });
});

describe("strapiSpeakerClient.uploadFiles", () => {
  const contentType = "multipart/form-data; boundary=abc";
  const body = () => new Blob(["--abc\r\n...\r\n--abc--"]).stream();

  it("streams the body as-is to /api/upload with the original content type", async () => {
    const uploaded = {
      id: 31,
      mime: "image/jpeg",
      size: 120.5,
      width: 400,
      height: 400,
      url: "/uploads/new.jpg",
    };
    const { client, fetchMock } = setup(jsonResponse(201, [uploaded]));
    const stream = body();

    const result = await client.uploadFiles(stream, contentType);

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { duplex?: string },
    ];
    // Fixed URL: no client query is ever forwarded (?id= would replace a file).
    expect(url).toBe("http://cms.test/api/upload");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(stream); // passed through, not read into memory
    expect(init.duplex).toBe("half");
    expect(init.headers).toMatchObject({
      authorization: "Bearer api-token",
      "content-type": contentType,
    });
    expect(result).toEqual({
      ok: true,
      files: [
        { id: 31, mime: "image/jpeg", size: 120.5, width: 400, height: 400 },
      ],
    });
  });

  it.each([400, 413, 415])(
    "reports Strapi refusing the file (%i) instead of throwing",
    async (status) => {
      const { client } = setup(jsonResponse(status, { error: "nope" }));

      expect(await client.uploadFiles(body(), contentType)).toEqual({
        ok: false,
        status,
      });
    },
  );

  it("throws on a 5xx answer", async () => {
    const { client } = setup(jsonResponse(502, { error: "down" }));

    await expect(client.uploadFiles(body(), contentType)).rejects.toMatchObject(
      {
        status: 502,
      },
    );
  });
});

describe("strapiSpeakerClient.deleteFile", () => {
  it("DELETEs the media file by id", async () => {
    const { client, fetchMock } = setup(jsonResponse(200, { id: 31 }));

    await client.deleteFile(31);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://cms.test/api/upload/files/31");
    expect(init.method).toBe("DELETE");
  });

  it("treats 404 (already gone) as done", async () => {
    const { client } = setup(jsonResponse(404, {}));

    await expect(client.deleteFile(31)).resolves.toBeUndefined();
  });
});
