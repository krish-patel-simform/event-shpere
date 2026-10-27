import { organizerRejectedEmail } from "../organizer-rejected.template";

const data = {
  firstName: "Olga",
  organizationName: "Acme Events",
  reason: "Website could not be verified",
  loginUrl: "https://app.test/login",
};

describe("organizerRejectedEmail", () => {
  it("contains the organization, the reason and the login link in both versions", () => {
    const email = organizerRejectedEmail(data);

    expect(email.subject).toBe("Your EventSphere organizer application");
    for (const body of [email.html, email.text]) {
      expect(body).toContain("Acme Events");
      expect(body).toContain(data.reason);
      expect(body).toContain(data.loginUrl);
    }
  });

  it("escapes the reason and names in the HTML so typed input cannot inject markup", () => {
    const email = organizerRejectedEmail({
      ...data,
      firstName: "<b>Olga</b>",
      organizationName: "<script>x</script>",
      reason: '<img src=x onerror="alert(1)">',
    });

    expect(email.html).not.toContain("<img");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;img");
  });

  it("keeps the reason's line breaks in the HTML", () => {
    const email = organizerRejectedEmail({
      ...data,
      reason: "Line one\nLine two",
    });

    expect(email.html).toContain("Line one<br>Line two");
  });
});
