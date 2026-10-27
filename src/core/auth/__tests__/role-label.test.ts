import { roleLabel } from "../role-label";

describe("roleLabel", () => {
  it.each([
    ["user", "Attendee"],
    ["speaker", "Speaker"],
    ["organizer", "Organizer"],
    ["admin", "Administrator"],
  ] as const)("%s -> %s", (role, label) => expect(roleLabel(role)).toBe(label));
});
