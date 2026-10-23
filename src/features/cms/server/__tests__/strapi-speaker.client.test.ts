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

describe("strapiSpeakerClient.createDraftSpeaker", () => {
  it("POSTs a DRAFT with the Bearer token and returns the documentId", async () => {
    const { client, fetchMock } = setup(
      jsonResponse(201, {
        data: {
          id: 3,
          documentId: "doc-1",
          name: "Ankit Sharma",
          publishedAt: null,
        },
        meta: {},
      }),
    );

    const result = await client.createDraftSpeaker({ name: "Ankit Sharma" });

    expect(result).toEqual({ documentId: "doc-1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    // Without ?status=draft Strapi would publish the empty entry.
    expect(url).toBe("http://cms.test/api/speakers?status=draft");
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
      client.createDraftSpeaker({ name: "Ankit Sharma" }),
    ).rejects.toThrow("STRAPI_API_TOKEN");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws a non-retryable error for a 403 (token lacks the permission)", async () => {
    const { client } = setup(jsonResponse(403, { error: "Forbidden" }));

    const error = await client
      .createDraftSpeaker({ name: "Ankit Sharma" })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(StrapiRequestError);
    expect(error).toMatchObject({ status: 403, retryable: false });
  });

  it("rejects an unexpected response shape", async () => {
    const { client } = setup(jsonResponse(201, { data: { id: 3 } }));

    await expect(
      client.createDraftSpeaker({ name: "Ankit Sharma" }),
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
