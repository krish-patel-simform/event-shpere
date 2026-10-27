import type { RoleName } from "../../db/schemas";

const ROLE_LABELS: Record<RoleName, string> = {
  user: "Attendee",
  speaker: "Speaker",
  organizer: "Organizer",
  admin: "Administrator",
};

/** The role as people read it ("user" → "Attendee"): the side menu, user lists, breakdowns. */
export function roleLabel(role: RoleName): string {
  return ROLE_LABELS[role];
}
