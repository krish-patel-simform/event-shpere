import { DrizzleQueryError } from "drizzle-orm";

// The database client is replaced: no connection, and each test decides how `select 1` ends.
const mockExecute = jest.fn();
jest.mock("../src/db/dbClient", () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

const CONNECTION_URL = "postgres://app_user:s3cret@10.0.0.5:5432/eventsphere";

/** What the pg driver throws when the database cannot be reached: the message names the host. */
function connectionRefused() {
  return Object.assign(new Error(`connect ECONNREFUSED 10.0.0.5:5432`), {
    code: "ECONNREFUSED",
  });
}

async function runRegister(runtime: string | undefined = "nodejs") {
  jest.replaceProperty(process, "env", {
    ...process.env,
    NEXT_RUNTIME: runtime,
  });
  const { register } = await import("../instrumentation");
  await register();
}

let log: jest.SpyInstance;
let error: jest.SpyInstance;

beforeEach(() => {
  mockExecute.mockReset();
  log = jest.spyOn(console, "log").mockImplementation(() => undefined);
  error = jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe("register (the database check at server start)", () => {
  it("does nothing outside the Node runtime", async () => {
    await runRegister("edge");

    expect(mockExecute).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it("says it is connected when the check works", async () => {
    mockExecute.mockResolvedValue([]);

    await runRegister();

    expect(log).toHaveBeenCalledWith("[db] connected to Neon");
    expect(error).not.toHaveBeenCalled();
  });

  it("logs what failed (kind and Postgres/driver code) when the check fails", async () => {
    mockExecute.mockRejectedValue(
      new DrizzleQueryError("select 1", [], connectionRefused()),
    );

    await runRegister();

    expect(error).toHaveBeenCalledWith(
      "[db] connection failed",
      expect.objectContaining({
        message: "Database query failed",
        dbCode: "ECONNREFUSED",
      }),
    );
  });

  it("never logs the raw error: no host, no user, no password, no query", async () => {
    mockExecute.mockRejectedValue(
      new DrizzleQueryError(
        `select 1 /* ${CONNECTION_URL} */`,
        [],
        connectionRefused(),
      ),
    );

    await runRegister();

    const [, logged] = error.mock.calls[0];
    // A plain description, not the Error object with its cause chain.
    expect(logged).not.toBeInstanceOf(Error);
    const text = JSON.stringify(error.mock.calls);
    expect(text).not.toContain("10.0.0.5");
    expect(text).not.toContain("s3cret");
    expect(text).not.toContain("app_user");
    expect(text).not.toContain("select 1");
  });

  it("does not print a value that is not an Error (it may be the connection string)", async () => {
    mockExecute.mockRejectedValue(CONNECTION_URL);

    await runRegister();

    const text = JSON.stringify(error.mock.calls);
    expect(text).not.toContain("s3cret");
    expect(text).not.toContain("10.0.0.5");
  });
});
