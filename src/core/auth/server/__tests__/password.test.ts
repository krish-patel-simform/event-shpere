import { hashPassword, verifyPassword } from "../password";

describe("password hashing", () => {
  it("stores an argon2id hash, never the plain password", async () => {
    const hash = await hashPassword("correct horse battery");

    expect(hash).not.toContain("correct horse battery");
    expect(hash.startsWith("$argon2id$")).toBe(true);
  });

  it("salts every hash, so the same password hashes differently", async () => {
    expect(await hashPassword("same-password")).not.toBe(
      await hashPassword("same-password"),
    );
  });

  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct horse battery");

    expect(await verifyPassword(hash, "correct horse battery")).toBe(true);
    expect(await verifyPassword(hash, "wrong password")).toBe(false);
  });
});
