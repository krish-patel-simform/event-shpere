import { cmsAccessEmail } from "../cms-access.template";

const data = {
  firstName: "Olga",
  registerUrl: "http://localhost:1337/admin/auth/register?registrationToken=abc",
};

describe("cmsAccessEmail", () => {
  it("contains the register link in both the HTML and the text version", () => {
    const email = cmsAccessEmail(data);

    expect(email.subject).toBe("Set up your EventSphere content access");
    for (const body of [email.html, email.text]) {
      expect(body).toContain(data.registerUrl);
      expect(body).toContain("works once");
    }
  });

  it("escapes the name in the HTML so admin input cannot inject markup", () => {
    const email = cmsAccessEmail({
      ...data,
      firstName: '<img src=x onerror="alert(1)">',
    });

    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&lt;img");
  });
});
