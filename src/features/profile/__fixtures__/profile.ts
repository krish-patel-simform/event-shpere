import type { ProfileDetails } from "../types/profile";

// Only for tests: a person who is not the sample one, so a test cannot pass by reading the
// default sample data by accident.
export const TEST_PROFILE: ProfileDetails = {
  firstName: "Meera",
  lastName: "Iyer",
  email: "meera.iyer@example.com",
  emailVerified: true,
  role: "organizer",
};

export const VALID_PASSWORD = "Str0ng!Passw0rd";
