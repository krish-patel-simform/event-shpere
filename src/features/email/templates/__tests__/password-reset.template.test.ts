import { passwordResetEmail } from "../password-reset.template";

const data = {
  firstName: "Olga",
  resetUrl: "https://app.test/reset-password?token=abc123",
  expiresInMinutes: 10,
};

describe("passwordResetEmail", () => {
  it("has the link and the expiry in both the HTML and the text version", () => {
    const email = passwordResetEmail(data);

    for (const body of [email.html, email.text]) {
      expect(body).toContain(data.resetUrl);
      expect(body).toContain("10 minutes");
      expect(body).toContain("ignore this email");
    }
    expect(email.subject).toBe("Reset your EventSphere password");
  });

  it("says the person asked for it, unless an admin sent it", () => {
    const own = passwordResetEmail(data);
    expect(own.text).toContain("We received a request to reset");
    expect(own.text).not.toContain("administrator");
  });

  it("says an administrator started it when an admin sent the link, with the same link and expiry", () => {
    const email = passwordResetEmail({ ...data, sentByAdmin: true });

    for (const body of [email.html, email.text]) {
      expect(body).toContain("An EventSphere administrator has started");
      expect(body).not.toContain("We received a request");
      expect(body).toContain(data.resetUrl);
      expect(body).toContain("10 minutes");
      expect(body).toContain("ignore this email");
    }
  });

  it("escapes the first name in the HTML (it comes from a signup form)", () => {
    const email = passwordResetEmail({
      ...data,
      firstName: '<img src=x onerror="alert(1)">',
    });

    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&lt;img");
  });

  it("does not put a password in the email", () => {
    const email = passwordResetEmail(data);
    expect(email.html.toLowerCase()).not.toMatch(/your (new )?password is/);
  });
});
