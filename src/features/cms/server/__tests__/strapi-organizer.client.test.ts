import { ZodError } from "zod";
import {
  StrapiRequestError,
  createStrapiOrganizerClient,
} from "../strapi-organizer.client";

// The real env is never loaded: each test builds its own client.
jest.mock("../../../../config/env", () => ({ env: {} }));

const secret = "s".repeat(40);
const input = {
  email: "olga@acme.test",
  firstName: "Olga",
  lastName: "Organizer",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function setup(response: Response, provisionSecret: string | undefined = secret) {
  const fetchMock = jest.fn().mockResolvedValue(response);
  const client = createStrapiOrganizerClient({
    baseUrl: "http://cms.test",
    provisionSecret,
    fetch: fetchMock,
  });
  return { client, fetchMock };
}

describe("strapiOrganizerClient.provisionOrganizerAccess", () => {
  it("POSTs the organizer with the secret header and returns id + token", async () => {
    const { client, fetchMock } = setup(
      jsonResponse(201, { data: { id: 7, registrationToken: "reg-token" } }),
    );

    const result = await client.provisionOrganizerAccess(input);

    expect(result).toEqual({ id: 7, registrationToken: "reg-token" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://cms.test/api/eventsphere/organizer-access");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "x-provision-secret": secret });
    expect(JSON.parse(init.body as string)).toEqual(input);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("accepts a null token (organizer already registered in Strapi)", async () => {
    const { client } = setup(
      jsonResponse(200, { data: { id: 7, registrationToken: null } }),
    );

    expect(await client.provisionOrganizerAccess(input)).toEqual({
      id: 7,
      registrationToken: null,
    });
  });

  it("refuses to call Strapi without a secret", async () => {
    // "" = not set (an `undefined` argument would fall back to the default secret).
    const { client, fetchMock } = setup(jsonResponse(200, {}), "");

    await expect(client.provisionOrganizerAccess(input)).rejects.toThrow(
      "STRAPI_PROVISION_SECRET",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws a retryable error for a 5xx answer", async () => {
    const { client } = setup(jsonResponse(500, { error: "boom" }));

    const error = await client
      .provisionOrganizerAccess(input)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(StrapiRequestError);
    expect(error).toMatchObject({ status: 500, retryable: true });
  });

  it("throws a non-retryable error for a 403 (wrong secret)", async () => {
    const { client } = setup(jsonResponse(403, { error: "Policy Failed" }));

    const error = await client
      .provisionOrganizerAccess(input)
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 403, retryable: false });
  });

  it("rejects an unexpected response shape", async () => {
    const { client } = setup(jsonResponse(200, { data: { id: "7" } }));

    await expect(client.provisionOrganizerAccess(input)).rejects.toBeInstanceOf(
      ZodError,
    );
  });
});

describe("strapiOrganizerClient.registerUrl", () => {
  it("builds Strapi's register page link with the token encoded", () => {
    const { client } = setup(jsonResponse(200, {}));

    expect(client.registerUrl("a+b/c")).toBe(
      "http://cms.test/admin/auth/register?registrationToken=a%2Bb%2Fc",
    );
  });
});
