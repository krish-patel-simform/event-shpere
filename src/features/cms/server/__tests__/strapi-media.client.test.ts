import { ZodError } from "zod";
import { StrapiRequestError } from "../strapi-organizer.client";
import { createStrapiMediaClient } from "../strapi-media.client";

// The real env is never loaded: each test builds its own client.
jest.mock("../../../../config/env", () => ({ env: {} }));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function setup(response: Response) {
  const fetchMock = jest.fn().mockResolvedValue(response);
  const client = createStrapiMediaClient({
    baseUrl: "http://cms.test",
    apiToken: "api-token",
    fetch: fetchMock,
  });
  return { client, fetchMock };
}

describe("strapiMediaClient.uploadFiles", () => {
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

    const error = await client.uploadFiles(body(), contentType).catch((e) => e);

    expect(error).toBeInstanceOf(StrapiRequestError);
    expect(error.status).toBe(502);
  });

  it("rejects an answer that is not a list of files", async () => {
    const { client } = setup(jsonResponse(201, { unexpected: true }));

    await expect(
      client.uploadFiles(body(), contentType),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("refuses to call Strapi without an API token", async () => {
    const fetchMock = jest.fn();
    const client = createStrapiMediaClient({
      baseUrl: "http://cms.test",
      apiToken: undefined,
      fetch: fetchMock,
    });

    await expect(client.uploadFiles(body(), contentType)).rejects.toThrow(
      "STRAPI_API_TOKEN",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("strapiMediaClient.deleteFile", () => {
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

  it("throws on any other failure", async () => {
    const { client } = setup(jsonResponse(500, {}));

    await expect(client.deleteFile(31)).rejects.toBeInstanceOf(
      StrapiRequestError,
    );
  });
});
