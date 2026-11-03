import { ZodError } from "zod";
import { StrapiRequestError } from "../strapi-organizer.client";
import { createStrapiEventClient } from "../strapi-event.client";

// The real env is never loaded: each test builds its own client.
jest.mock("../../../../config/env", () => ({ env: {} }));

const eventId = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function setup(response: Response) {
  const fetchMock = jest.fn().mockResolvedValue(response);
  const client = createStrapiEventClient({
    baseUrl: "http://cms.test",
    apiToken: "api-token",
    fetch: fetchMock,
  });
  return { client, fetchMock };
}

describe("strapiEventClient.createEventPage", () => {
  it("POSTs only the eventId with the Bearer token and returns the documentId", async () => {
    const { client, fetchMock } = setup(
      jsonResponse(201, {
        data: { id: 7, documentId: "doc-1", eventId },
        meta: {},
      }),
    );

    const result = await client.createEventPage({ eventId });

    expect(result).toEqual({ documentId: "doc-1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    // No ?status=: the Event Page type has draft/publish off.
    expect(url).toBe("http://cms.test/api/event-pages");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ authorization: "Bearer api-token" });
    expect(JSON.parse(init.body as string)).toEqual({ data: { eventId } });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("throws a retryable StrapiRequestError on a 5xx", async () => {
    const { client } = setup(jsonResponse(503, { error: {} }));

    const error = await client.createEventPage({ eventId }).catch((e) => e);

    expect(error).toBeInstanceOf(StrapiRequestError);
    expect(error.status).toBe(503);
    expect(error.retryable).toBe(true);
  });

  it("throws a non-retryable StrapiRequestError on a 4xx", async () => {
    const { client } = setup(jsonResponse(400, { error: {} }));

    const error = await client.createEventPage({ eventId }).catch((e) => e);

    expect(error).toBeInstanceOf(StrapiRequestError);
    expect(error.retryable).toBe(false);
  });

  it("rejects an answer without a documentId", async () => {
    const { client } = setup(jsonResponse(201, { data: { id: 7 } }));

    await expect(client.createEventPage({ eventId })).rejects.toBeInstanceOf(
      ZodError,
    );
  });

  it("refuses to call Strapi without an API token", async () => {
    // Built by hand: passing undefined to setup() would fall back to its default token.
    const fetchMock = jest.fn();
    const client = createStrapiEventClient({
      baseUrl: "http://cms.test",
      apiToken: undefined,
      fetch: fetchMock,
    });

    await expect(client.createEventPage({ eventId })).rejects.toThrow(
      "STRAPI_API_TOKEN",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// A page as Strapi answers it with the components and images populated.
const strapiPage = {
  id: 7,
  documentId: "doc-1",
  eventId,
  tagline: "Learn it all",
  about: [{ type: "paragraph", children: [{ type: "text", text: "About" }] }],
  venueGuide: null,
  coverImage: {
    id: 9,
    url: "/uploads/cover.jpg",
    alternativeText: "The hall",
    width: 1600,
    height: 900,
  },
  gallery: [{ id: 5, url: "https://cdn.test/a.jpg", width: 800, height: 600 }],
  highlights: [{ id: 1, title: "Keynote", description: "" }],
  faqs: [
    {
      id: 1,
      question: "Parking?",
      answer: [
        { type: "paragraph", children: [{ type: "text", text: "Yes" }] },
      ],
    },
  ],
  seo: { id: 1, metaTitle: "Tech Conf", metaDescription: null },
};

describe("strapiEventClient.findEventPageById", () => {
  it("GETs the page with its components and images populated", async () => {
    const { client, fetchMock } = setup(
      jsonResponse(200, { data: strapiPage }),
    );

    await client.findEventPageById("doc 1");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/api/event-pages/doc%201");
    for (const field of [
      "coverImage",
      "gallery",
      "highlights",
      "faqs",
      "seo",
    ]) {
      expect(parsed.searchParams.get(`populate[${field}]`)).toBe("true");
    }
    // No ?status=: the Event Page type has draft/publish off.
    expect(parsed.searchParams.has("status")).toBe(false);
    expect(init.method).toBe("GET");
    expect(init.headers).toMatchObject({ authorization: "Bearer api-token" });
  });

  it("cleans the page up: absolute image URLs, empty things null or []", async () => {
    const { client } = setup(jsonResponse(200, { data: strapiPage }));

    const page = await client.findEventPageById("doc-1");

    expect(page).toEqual({
      documentId: "doc-1",
      tagline: "Learn it all",
      about: strapiPage.about,
      venueGuide: [],
      coverImage: {
        id: 9,
        url: "http://cms.test/uploads/cover.jpg",
        alt: "The hall",
        width: 1600,
        height: 900,
      },
      gallery: [
        {
          id: 5,
          url: "https://cdn.test/a.jpg",
          alt: null,
          width: 800,
          height: 600,
        },
      ],
      highlights: [{ title: "Keynote", description: null }],
      faqs: [{ question: "Parking?", answer: strapiPage.faqs[0].answer }],
      seo: { metaTitle: "Tech Conf", metaDescription: null },
    });
  });

  it("treats a brand-new empty page as an empty one", async () => {
    const { client } = setup(
      jsonResponse(200, { data: { id: 7, documentId: "doc-1", eventId } }),
    );

    const page = await client.findEventPageById("doc-1");

    expect(page).toEqual({
      documentId: "doc-1",
      tagline: null,
      about: [],
      venueGuide: [],
      coverImage: null,
      gallery: [],
      highlights: [],
      faqs: [],
      seo: { metaTitle: null, metaDescription: null },
    });
  });

  it("returns null when the page does not exist (404)", async () => {
    const { client } = setup(jsonResponse(404, { error: {} }));

    await expect(client.findEventPageById("doc-1")).resolves.toBeNull();
  });

  it("throws on any other failure", async () => {
    const { client } = setup(jsonResponse(500, { error: {} }));

    await expect(client.findEventPageById("doc-1")).rejects.toBeInstanceOf(
      StrapiRequestError,
    );
  });

  it("rejects an answer that is not a page", async () => {
    const { client } = setup(jsonResponse(200, { data: { id: 7 } }));

    await expect(client.findEventPageById("doc-1")).rejects.toBeInstanceOf(
      ZodError,
    );
  });
});

describe("strapiEventClient.updateEventPage", () => {
  it("PUTs only the given fields and returns the cleaned-up page", async () => {
    const { client, fetchMock } = setup(
      jsonResponse(200, { data: strapiPage }),
    );

    const page = await client.updateEventPage("doc-1", {
      tagline: "Learn it all",
      coverImage: null,
      gallery: [5, 6],
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe("/api/event-pages/doc-1");
    // So the answer includes the images, e.g. right after a new one was set.
    expect(new URL(url).searchParams.get("populate[coverImage]")).toBe("true");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({
      data: { tagline: "Learn it all", coverImage: null, gallery: [5, 6] },
    });
    expect(page?.documentId).toBe("doc-1");
  });

  it("returns null when the page does not exist (404)", async () => {
    const { client } = setup(jsonResponse(404, { error: {} }));

    await expect(
      client.updateEventPage("doc-1", { tagline: "x" }),
    ).resolves.toBeNull();
  });

  it("throws on a 5xx answer", async () => {
    const { client } = setup(jsonResponse(500, { error: {} }));

    await expect(
      client.updateEventPage("doc-1", { tagline: "x" }),
    ).rejects.toBeInstanceOf(StrapiRequestError);
  });
});

describe("strapiEventClient.deleteEventPage", () => {
  it("DELETEs the page by documentId", async () => {
    const { client, fetchMock } = setup(new Response(null, { status: 204 }));

    await client.deleteEventPage("doc 1");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://cms.test/api/event-pages/doc%201");
    expect(init.method).toBe("DELETE");
  });

  it("counts an already deleted page (404) as done", async () => {
    const { client } = setup(new Response(null, { status: 404 }));

    await expect(client.deleteEventPage("doc-1")).resolves.toBeUndefined();
  });

  it("throws on any other failure", async () => {
    const { client } = setup(new Response(null, { status: 500 }));

    await expect(client.deleteEventPage("doc-1")).rejects.toBeInstanceOf(
      StrapiRequestError,
    );
  });
});
