import {
  createOrganizerBodySchema,
  createOrganizerFormSchema,
} from "../organizer.schemas";

const valid = {
  firstName: "Ananya",
  lastName: "Rao",
  email: "ananya.rao@example.com",
  organizationName: "Acme Events Pvt Ltd",
  organizationWebsite: "",
};

describe("createOrganizerFormSchema", () => {
  it("accepts a blank website: the box is empty, not a bad URL", () => {
    expect(createOrganizerFormSchema.safeParse(valid).success).toBe(true);
    // The API schema itself would refuse the same empty string, which is why the form has its own.
    expect(createOrganizerBodySchema.safeParse(valid).success).toBe(false);
  });

  it("accepts an http(s) website", () => {
    const result = createOrganizerFormSchema.safeParse({
      ...valid,
      organizationWebsite: "  https://acme-events.example.com  ",
    });

    expect(result.success).toBe(true);
    expect(result.data?.organizationWebsite).toBe(
      "https://acme-events.example.com",
    );
  });

  it.each(["acme.com", "javascript:alert(1)", "ftp://acme.com", "not a url"])(
    "rejects the website %s with a message the admin can act on",
    (organizationWebsite) => {
      const result = createOrganizerFormSchema.safeParse({
        ...valid,
        organizationWebsite,
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toMatch(/http\(s\) URL/);
    },
  );

  it("trims the names and lowercases the email, like the API does", () => {
    const result = createOrganizerFormSchema.parse({
      ...valid,
      firstName: "  Ananya ",
      email: "  Ananya.Rao@Example.COM ",
    });

    expect(result.firstName).toBe("Ananya");
    expect(result.email).toBe("ananya.rao@example.com");
  });

  it.each(["firstName", "lastName", "organizationName"] as const)(
    "needs %s",
    (field) => {
      expect(
        createOrganizerFormSchema.safeParse({ ...valid, [field]: "   " })
          .success,
      ).toBe(false);
    },
  );

  it("needs a real email address", () => {
    expect(
      createOrganizerFormSchema.safeParse({ ...valid, email: "not-an-email" })
        .success,
    ).toBe(false);
  });
});
