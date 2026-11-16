import { ZodError } from "zod";
import { StrapiRequestError } from "../strapi-organizer.client";
import { createStrapiSessionClient } from "../strapi-session.client";

// The real env is never loaded: each test builds its own client.
jest.mock("../../../../config/env", () => ({ env: {} }));

const sessionId = "6c7d8e9f-0a1b-4c2d-9e3f-4a5b6c7d8e9f";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function setup(response: Response, apiToken: string | undefined = "api-token") {
  const fetchMock = jest.fn().mockResolvedValue(response);
  const client = createStrapiSessionClient({
    baseUrl: "http://cms.test",
    apiToken,
    fetch: fetchMock,
  });
  return { client, fetchMock };
}

describe("strapiSessionClient.createSessionDetail", () => {
  it("POSTs only the sessionId with the Bearer token and returns the documentId", async () => {
    const { client, fetchMock } = setup(
      jsonResponse(201, { data: { documentId: "doc-1", id: 7 } }),
    );

    const created = await client.createSessionDetail({ sessionId });

    expect(created).toEqual({ documentId: "doc-1" });
    const [url, init] = fetchMock.mock.calls[0];
    // Always PUBLISHED: Postgres decides what anyone may see, so the content must be readable.
    expect(url).toBe("http://cms.test/api/session-details?status=published");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer api-token");
    expect(JSON.parse(init.body)).toEqual({ data: { sessionId } });
  });

  it("throws a StrapiRequestError with the status when Strapi refuses (e.g. a second entry for the session)", async () => {
    const { client } = setup(
      jsonResponse(400, { error: { message: "taken" } }),
    );

    await expect(
      client.createSessionDetail({ sessionId }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("fails clearly when no API token is set", async () => {
    // "" is as good as no token (an undefined argument would trigger setup's default).
    const { client, fetchMock } = setup(jsonResponse(201, {}), "");

    await expect(client.createSessionDetail({ sessionId })).rejects.toThrow(
      /STRAPI_API_TOKEN/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an answer without a documentId", async () => {
    const { client } = setup(jsonResponse(201, { data: {} }));

    await expect(
      client.createSessionDetail({ sessionId }),
    ).rejects.toBeInstanceOf(ZodError);
  });
});

describe("strapiSessionDetailClient reads and updates", () => {
  const entry = {
    documentId: "doc-1",
    description: [
      { type: "paragraph", children: [{ type: "text", text: "Hello" }] },
    ],
    prerequisites: "Know some JS",
    resources: [{ label: "Slides", url: "https://example.com/s" }],
  };

  it("reads the PUBLISHED entry with its resources and cleans it up", async () => {
    const { client, fetchMock } = setup(jsonResponse(200, { data: entry }));

    const detail = await client.findSessionDetailById("doc-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/session-details/doc-1?");
    expect(url).toContain("status=published");
    expect(url).toContain("populate%5Bresources%5D=true");
    expect(init.method).toBe("GET");
    expect(detail).toEqual({
      documentId: "doc-1",
      description: entry.description,
      prerequisites: "Know some JS",
      coverImage: null,
      resources: [{ label: "Slides", url: "https://example.com/s" }],
    });
  });

  it("asks for the cover image and answers it with an absolute URL", async () => {
    const { client, fetchMock } = setup(
      jsonResponse(200, {
        data: {
          ...entry,
          coverImage: {
            id: 31,
            url: "/uploads/cover.jpg",
            alternativeText: "A stage",
            width: 800,
            height: 600,
          },
        },
      }),
    );

    const detail = await client.findSessionDetailById("doc-1");

    expect(fetchMock.mock.calls[0][0]).toContain(
      "populate%5BcoverImage%5D=true",
    );
    expect(detail?.coverImage).toEqual({
      id: 31,
      url: "http://cms.test/uploads/cover.jpg",
      alt: "A stage",
      width: 800,
      height: 600,
    });
  });

  it("turns missing fields into empty values, not nulls in lists", async () => {
    const { client } = setup(
      jsonResponse(200, {
        data: { documentId: "doc-1", prerequisites: "", resources: null },
      }),
    );

    await expect(client.findSessionDetailById("doc-1")).resolves.toEqual({
      documentId: "doc-1",
      description: [],
      prerequisites: null,
      coverImage: null,
      resources: [],
    });
  });

  it("answers null when the entry is gone (404)", async () => {
    const { client } = setup(new Response(null, { status: 404 }));

    await expect(client.findSessionDetailById("doc-1")).resolves.toBeNull();
  });

  it("throws a StrapiRequestError on any other failure", async () => {
    const { client } = setup(new Response(null, { status: 500 }));

    await expect(client.findSessionDetailById("doc-1")).rejects.toBeInstanceOf(
      StrapiRequestError,
    );
  });

  it("PUTs only the given fields, keeping the entry published, and returns it", async () => {
    const { client, fetchMock } = setup(jsonResponse(200, { data: entry }));

    const detail = await client.updateSessionDetail("doc-1", {
      prerequisites: "Know some JS",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/session-details/doc-1?");
    expect(url).toContain("status=published");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({
      data: { prerequisites: "Know some JS" },
    });
    expect(detail?.documentId).toBe("doc-1");
  });

  it("answers null when updating an entry that is gone (404)", async () => {
    const { client } = setup(new Response(null, { status: 404 }));

    await expect(
      client.updateSessionDetail("doc-1", { prerequisites: null }),
    ).resolves.toBeNull();
  });

  it("encodes the document id in the URL", async () => {
    const { client, fetchMock } = setup(new Response(null, { status: 404 }));

    await client.findSessionDetailById("a/b?c");

    expect(fetchMock.mock.calls[0][0]).toContain("/session-details/a%2Fb%3Fc?");
  });
});

describe("strapiSessionClient.deleteSessionDetail", () => {
  it("DELETEs the entry", async () => {
    const { client, fetchMock } = setup(new Response(null, { status: 204 }));

    await client.deleteSessionDetail("doc-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://cms.test/api/session-details/doc-1");
    expect(init.method).toBe("DELETE");
  });

  it("counts an entry that is already gone (404) as done", async () => {
    const { client } = setup(new Response(null, { status: 404 }));

    await expect(client.deleteSessionDetail("doc-1")).resolves.toBeUndefined();
  });

  it("throws a StrapiRequestError on any other failure", async () => {
    const { client } = setup(new Response(null, { status: 403 }));

    await expect(client.deleteSessionDetail("doc-1")).rejects.toMatchObject({
      status: 403,
    });
  });
});
