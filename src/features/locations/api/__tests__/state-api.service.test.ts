import { AxiosError, type AxiosAdapter } from "axios";
import { baseApiService } from "../../../../core/api-client/base-api.service";
import { stateApiService } from "../state-api.service";

// A fake server behind the real axios instance, so apiRequest's parsing stays real.
type Reply = { status: number; data?: unknown };

let urls: string[];
let reply: Reply;

const fakeServer: AxiosAdapter = async (config) => {
  urls.push(`${config.method?.toUpperCase()} ${config.url}`);
  const response = {
    data: reply.data,
    status: reply.status,
    statusText: "",
    headers: {},
    config,
  };
  if (reply.status >= 200 && reply.status < 300) return response;
  throw new AxiosError("failed", "ERR_BAD_REQUEST", config, null, response);
};

const originalAdapter = baseApiService.defaults.adapter;
beforeAll(() => {
  baseApiService.defaults.adapter = fakeServer;
});
afterAll(() => {
  baseApiService.defaults.adapter = originalAdapter;
});
beforeEach(() => {
  urls = [];
});

const states = [
  { id: "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d", name: "Goa", code: "IN-GA" },
  {
    id: "3b7c2d1e-6f5a-4e8d-9a0b-1c2d3e4f5a6b",
    name: "Gujarat",
    code: "IN-GJ",
  },
];

describe("stateApiService.list", () => {
  it("gets every state and returns them as the server sent them", async () => {
    reply = { status: 200, data: { data: states } };

    await expect(stateApiService.list()).resolves.toEqual(states);
    expect(urls).toEqual(["GET /states"]);
  });

  it("returns an empty list when there are no states", async () => {
    reply = { status: 200, data: { data: [] } };

    await expect(stateApiService.list()).resolves.toEqual([]);
  });

  it("rejects a state without a valid id", async () => {
    reply = {
      status: 200,
      data: { data: [{ id: "1", name: "Goa", code: "IN-GA" }] },
    };

    await expect(stateApiService.list()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("rejects an answer that is not a list", async () => {
    reply = { status: 200, data: { data: states[0] } };

    await expect(stateApiService.list()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("turns a server failure into an ApiError with the server's code", async () => {
    reply = {
      status: 429,
      data: {
        error: { code: "RATE_LIMITED", message: "Too many requests" },
      },
    };

    await expect(stateApiService.list()).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
      message: "Too many requests",
    });
  });
});
