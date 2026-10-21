import { env } from "../../../../config/env";
import { passwordResetEmail } from "../../templates/password-reset.template";
import { verificationCodeEmail } from "../../templates/verification-code.template";
import {
  sendEmail,
  sendPasswordResetEmail,
  sendVerificationCodeEmail,
} from "../email.service";

// Resend and env are replaced: no network, and each test sets the env it needs.
const mockSend = jest.fn();
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
}));
jest.mock("../../../../config/env", () => ({ env: {} }));

// The mocked env is a plain object, so tests can change it.
const mutableEnv = env as unknown as Record<string, string | undefined>;

const message = {
  to: "olga@acme.test",
  subject: "Hello",
  html: "<p>Hi</p>",
  text: "Hi",
};
const codeData = {
  to: "olga@acme.test",
  firstName: "Olga",
  otp: "123456",
  verifyUrl: "https://app.test/verify-email?token=abc",
  expiresInMinutes: 5,
};
const resetData = {
  to: "olga@acme.test",
  firstName: "Olga",
  resetUrl: "https://app.test/reset-password?token=abc",
  expiresInMinutes: 10,
};

beforeEach(() => {
  for (const key of Object.keys(mutableEnv)) delete mutableEnv[key];
  Object.assign(mutableEnv, {
    RESEND_API_KEY: "re_test_key",
    EMAIL_FROM: "EventSphere <noreply@eventsphere.test>",
    EMAIL_TO: "inbox@eventsphere.test",
  });
  mockSend
    .mockReset()
    .mockResolvedValue({ data: { id: "email_1" }, error: null });
});

afterEach(() => jest.restoreAllMocks());

describe("sendEmail", () => {
  it("throws a clear message when RESEND_API_KEY is not set, and sends nothing", async () => {
    delete mutableEnv.RESEND_API_KEY;

    await expect(sendEmail(message)).rejects.toThrow(/RESEND_API_KEY/);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("throws a clear message when EMAIL_FROM is not set, and sends nothing", async () => {
    delete mutableEnv.EMAIL_FROM;

    await expect(sendEmail(message)).rejects.toThrow(/EMAIL_FROM/);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("sends the subject, html and text from the configured sender", async () => {
    await sendEmail(message);

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0]).toMatchObject({
      from: "EventSphere <noreply@eventsphere.test>",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    });
  });

  it("passes the idempotency key to Resend, so a retried job never sends twice", async () => {
    await sendEmail(message, { idempotencyKey: "account-setup/42" });

    expect(mockSend.mock.calls[0][1]).toEqual({
      idempotencyKey: "account-setup/42",
    });
  });

  it("throws when Resend answers with an error (it does not throw by itself), so the queue retries", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "Invalid from address" },
    });

    await expect(sendEmail(message)).rejects.toThrow(
      "Resend failed (validation_error): Invalid from address",
    );
  });
});

describe("sendVerificationCodeEmail", () => {
  it("without a Resend key (dev) prints the code to the console and sends nothing", async () => {
    delete mutableEnv.RESEND_API_KEY;
    const info = jest
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    await sendVerificationCodeEmail(codeData);

    expect(info).toHaveBeenCalledWith(expect.stringContaining("123456"));
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("in production never prints the code, and fails loudly when Resend is not configured", async () => {
    delete mutableEnv.RESEND_API_KEY;
    jest.replaceProperty(process.env, "NODE_ENV", "production");
    const info = jest
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    await expect(sendVerificationCodeEmail(codeData)).rejects.toThrow(
      /RESEND_API_KEY/,
    );
    expect(info).not.toHaveBeenCalled();
  });

  it("sends the rendered verification email with the code and the link", async () => {
    await sendVerificationCodeEmail(codeData);

    const sent = mockSend.mock.calls[0][0];
    expect(sent.subject).toBe(verificationCodeEmail(codeData).subject);
    expect(sent.html).toContain("123456");
    expect(sent.html).toContain(codeData.verifyUrl);
  });
});

describe("sendPasswordResetEmail", () => {
  it("without a Resend key (dev) prints the reset link to the console and sends nothing", async () => {
    delete mutableEnv.RESEND_API_KEY;
    const info = jest
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    await sendPasswordResetEmail(resetData);

    expect(info).toHaveBeenCalledWith(
      expect.stringContaining(resetData.resetUrl),
    );
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("in production never prints the link, and fails loudly when Resend is not configured", async () => {
    delete mutableEnv.RESEND_API_KEY;
    jest.replaceProperty(process.env, "NODE_ENV", "production");
    const info = jest
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    await expect(sendPasswordResetEmail(resetData)).rejects.toThrow(
      /RESEND_API_KEY/,
    );
    expect(info).not.toHaveBeenCalled();
  });

  it("sends the rendered reset email with the link", async () => {
    await sendPasswordResetEmail(resetData);

    const sent = mockSend.mock.calls[0][0];
    expect(sent.subject).toBe(passwordResetEmail(resetData).subject);
    expect(sent.html).toContain(resetData.resetUrl);
  });

  it("lets a Resend failure through, so the caller can decide what to do", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { name: "rate_limit", message: "Slow down" },
    });

    await expect(sendPasswordResetEmail(resetData)).rejects.toThrow(
      /Resend failed/,
    );
  });
});
