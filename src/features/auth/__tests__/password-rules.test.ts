import { PASSWORD_REGEX } from "../constants";
import { PASSWORD_RULES } from "../utils/password-rules";

const meetsAllRules = (pw: string) => PASSWORD_RULES.every((rule) => rule.test(pw));

describe("PASSWORD_RULES", () => {
  // The checklist and the server's regex must never disagree.
  it.each([
    "Abcdef1!",
    "abcdef1!", // no uppercase
    "ABCDEF1!", // no lowercase
    "Abcdefg!", // no number
    "Abcdefg1", // no special character
    "Abc1!", // too short
    "Abcdef1_", // underscore counts as special
    "Abcdef1 ", // space counts as special
    "",
  ])("agrees with PASSWORD_REGEX for %j", (pw) => {
    expect(meetsAllRules(pw)).toBe(PASSWORD_REGEX.test(pw));
  });
});
