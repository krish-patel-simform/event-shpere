import { accountSetupEmail } from "../account-setup.template";

const data = {
  firstName: "Olga",
  passwordSetupUrl: "http://localhost:3000/set-password?token=abc",
  loginUrl: "http://localhost:3000/login",
  expiresInHours: 24,
};

describe("accountSetupEmail", () => {
  it("contains step 1 (set-password link + expiry) and step 2 (login link)", () => {
    const email = accountSetupEmail(data);

    for (const body of [email.html, email.text]) {
      expect(body).toContain("Step 1");
      expect(body).toContain(data.passwordSetupUrl);
      expect(body).toContain("24 hours");
      expect(body).toContain("Step 2");
      expect(body).toContain(data.loginUrl);
    }
  });

  it("escapes the name in the HTML so admin input cannot inject markup", () => {
    const email = accountSetupEmail({
      ...data,
      firstName: '<img src=x onerror="alert(1)">',
    });

    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&lt;img");
  });
});
