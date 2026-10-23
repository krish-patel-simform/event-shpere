import { Queue } from "bullmq";
import {
  EMAIL_QUEUE_NAME,
  enqueueAccountSetupEmail,
  enqueueCmsAccessEmail,
} from "../email.queue";

// No Redis: Queue is replaced, so these tests only check how the queue is set up and used.
const mockAdd = jest.fn().mockResolvedValue(undefined);
jest.mock("bullmq", () => ({
  Queue: jest.fn().mockImplementation(() => ({ add: mockAdd })),
}));
jest.mock("../../../../core/redis/redis", () => ({
  queueConnection: { url: "redis://test" },
}));

const data = {
  to: "olga@acme.test",
  firstName: "Olga",
  passwordSetupUrl: "https://app.test/set-password?token=abc",
  loginUrl: "https://app.test/login",
  expiresInHours: 24,
};

beforeEach(() => {
  jest.clearAllMocks();
  // The queue is cached on globalThis between calls; start each test without one.
  delete (globalThis as { emailQueue?: unknown }).emailQueue;
});

describe("enqueueAccountSetupEmail", () => {
  it("adds an 'account-setup' job with the given data", async () => {
    await enqueueAccountSetupEmail(data);

    expect(mockAdd).toHaveBeenCalledWith("account-setup", data, {});
  });

  it("does not create the queue (no Redis connection) until the first email is queued", () => {
    expect(Queue).not.toHaveBeenCalled();
  });

  it("creates the queue once and reuses it for later emails", async () => {
    await enqueueAccountSetupEmail(data);
    await enqueueAccountSetupEmail(data);

    expect(Queue).toHaveBeenCalledTimes(1);
    expect(mockAdd).toHaveBeenCalledTimes(2);
  });

  it("retries a failed send 3 times with exponential backoff", async () => {
    await enqueueAccountSetupEmail(data);

    expect(Queue).toHaveBeenCalledWith(
      EMAIL_QUEUE_NAME,
      expect.objectContaining({
        connection: { url: "redis://test" },
        defaultJobOptions: expect.objectContaining({
          attempts: 3,
          backoff: { type: "exponential", delay: 5_000 },
        }),
      }),
    );
  });

  it("does not keep finished jobs in Redis: their data holds a one-time setup link", async () => {
    await enqueueAccountSetupEmail(data);

    expect(Queue).toHaveBeenCalledWith(
      EMAIL_QUEUE_NAME,
      expect.objectContaining({
        defaultJobOptions: expect.objectContaining({ removeOnComplete: true }),
      }),
    );
  });
});

describe("enqueueCmsAccessEmail", () => {
  const cmsData = {
    to: "olga@acme.test",
    firstName: "Olga",
    registerUrl: "http://cms.test/admin/auth/register?registrationToken=abc",
  };
  const organizerId = "0b7c2d1e-3f4a-4b5c-8d6e-7f8091a2b3c4";

  it("adds a 'cms-access' job with one fixed id per organizer (no duplicates)", async () => {
    await enqueueCmsAccessEmail(cmsData, organizerId);

    expect(mockAdd).toHaveBeenCalledWith("cms-access", cmsData, {
      jobId: `cms-access-${organizerId}`,
    });
  });

  it("uses a job id without ':' (BullMQ rejects it in custom ids)", async () => {
    await enqueueCmsAccessEmail(cmsData, organizerId);

    const [, , options] = mockAdd.mock.calls[0] as [string, unknown, { jobId: string }];
    expect(options.jobId).not.toContain(":");
  });
});
