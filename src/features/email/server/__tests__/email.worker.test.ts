import type { Job } from "bullmq";
import { Worker } from "bullmq";
import { sendEmail } from "../email.service";
import { processEmailJob, startEmailWorker } from "../email.worker";

// No Redis, no BullMQ internals, no Resend: the worker's own logic is what is under test.
jest.mock("bullmq", () => ({
  Worker: jest.fn().mockImplementation(() => ({ on: jest.fn() })),
}));
jest.mock("../../../../core/redis/redis", () => ({
  queueConnection: { url: "redis://test" },
}));
jest.mock("../email.service", () => ({ sendEmail: jest.fn() }));

const send = jest.mocked(sendEmail);

const jobData = {
  to: "olga@acme.test",
  firstName: "Olga",
  passwordSetupUrl: "https://app.test/set-password?token=abc",
  loginUrl: "https://app.test/login",
  expiresInHours: 24,
};

function fakeJob(name: string, data: unknown, id = "42") {
  return { name, id, data } as unknown as Job;
}

beforeEach(() => jest.clearAllMocks());

describe("processEmailJob", () => {
  it("sends an account-setup job to its address with the rendered email", async () => {
    await processEmailJob(fakeJob("account-setup", jobData));

    expect(send).toHaveBeenCalledTimes(1);
    const [email] = send.mock.calls[0];
    expect(email.to).toBe("olga@acme.test");
    expect(email.html).toContain(jobData.passwordSetupUrl);
  });

  it("uses job name + id as the idempotency key, so a retry never sends a duplicate", async () => {
    await processEmailJob(fakeJob("account-setup", jobData, "42"));

    expect(send.mock.calls[0][1]).toEqual({
      idempotencyKey: "account-setup/42",
    });
  });

  it("throws for an unknown job name, so BullMQ marks it failed", async () => {
    await expect(
      processEmailJob(fakeJob("newsletter", jobData)),
    ).rejects.toThrow("Unknown email job: newsletter");
    expect(send).not.toHaveBeenCalled();
  });

  it("re-validates the job data: a bad job sends nothing", async () => {
    await expect(
      processEmailJob(
        fakeJob("account-setup", { ...jobData, to: "not-an-email" }),
      ),
    ).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });

  it("lets a sending failure through, so BullMQ retries the job", async () => {
    send.mockRejectedValueOnce(new Error("Resend is down"));

    await expect(
      processEmailJob(fakeJob("account-setup", jobData)),
    ).rejects.toThrow("Resend is down");
  });
});

describe("processEmailJob: cms-access", () => {
  const cmsData = {
    to: "olga@acme.test",
    firstName: "Olga",
    registerUrl: "http://cms.test/admin/auth/register?registrationToken=abc",
  };

  it("sends the content-access email with the Strapi register link", async () => {
    await processEmailJob(fakeJob("cms-access", cmsData, "cms-access-1"));

    const [email, options] = send.mock.calls[0];
    expect(email.to).toBe("olga@acme.test");
    expect(email.html).toContain(cmsData.registerUrl);
    expect(options).toEqual({ idempotencyKey: "cms-access/cms-access-1" });
  });

  it("rejects a non-URL register link: a bad job sends nothing", async () => {
    await expect(
      processEmailJob(
        fakeJob("cms-access", { ...cmsData, registerUrl: "not a url" }),
      ),
    ).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
});

describe("processEmailJob: organizer-rejected", () => {
  const rejectedData = {
    to: "olga@acme.test",
    firstName: "Olga",
    organizationName: "Acme Events",
    reason: "Website could not be verified",
    loginUrl: "https://app.test/login",
  };

  it("sends the rejection email with the reason", async () => {
    await processEmailJob(
      fakeJob("organizer-rejected", rejectedData, "organizer-rejected-1"),
    );

    const [email, options] = send.mock.calls[0];
    expect(email.to).toBe("olga@acme.test");
    expect(email.html).toContain(rejectedData.reason);
    expect(options).toEqual({
      idempotencyKey: "organizer-rejected/organizer-rejected-1",
    });
  });

  it("a job without a reason sends nothing", async () => {
    await expect(
      processEmailJob(
        fakeJob("organizer-rejected", { ...rejectedData, reason: "" }),
      ),
    ).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
});

describe("startEmailWorker", () => {
  it("listens on the email queue with the shared connection and a concurrency of 5", () => {
    startEmailWorker();

    expect(Worker).toHaveBeenCalledWith("email", processEmailJob, {
      connection: { url: "redis://test" },
      concurrency: 5,
    });
  });

  it("logs a failure with the job name and message, never the job data", () => {
    const error = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const worker = startEmailWorker();
    const onFailed = jest
      .mocked(worker.on)
      .mock.calls.find(([event]) => event === "failed")?.[1];

    (onFailed as (job: unknown, error: Error) => void)(
      { name: "account-setup", id: "42", attemptsMade: 1, data: jobData },
      new Error("Resend is down"),
    );

    const logged = JSON.stringify(error.mock.calls);
    expect(logged).toContain("account-setup");
    expect(logged).toContain("Resend is down");
    expect(logged).not.toContain(jobData.passwordSetupUrl);
    error.mockRestore();
  });
});
