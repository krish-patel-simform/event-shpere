import type { MeDto } from "@/src/features/auth";

const ROLE_LABELS: Record<MeDto["role"], string> = {
  user: "Attendee",
  speaker: "Speaker",
  organizer: "Organizer",
  admin: "Administrator",
};

/** The line under the user's name in the side menu. */
export function roleLabel(role: MeDto["role"]): string {
  return ROLE_LABELS[role];
}
