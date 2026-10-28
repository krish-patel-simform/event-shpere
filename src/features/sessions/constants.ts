// Fixed choices of the sessions feature. Plain data (no React), shared by the Zod schema, the
// form and the list filters, so a new format is added in one place.

export const SESSION_FORMATS = [
  "talk",
  "workshop",
  "panel",
  "lightning",
] as const;
export const SESSION_FORMAT_LABELS: Record<
  (typeof SESSION_FORMATS)[number],
  string
> = {
  talk: "Talk",
  workshop: "Workshop",
  panel: "Panel discussion",
  lightning: "Lightning talk",
};

/** Minutes, as the strings a <select> gives back. */
export const SESSION_DURATIONS = ["15", "30", "45", "60", "90", "120"] as const;

export const SESSION_TRACKS = [
  "frontend-architecture",
  "mobile-web",
  "developer-tooling",
  "design-ux",
] as const;
export const SESSION_TRACK_LABELS: Record<
  (typeof SESSION_TRACKS)[number],
  string
> = {
  "frontend-architecture": "Frontend Architecture",
  "mobile-web": "Mobile & Web",
  "developer-tooling": "Developer Tooling",
  "design-ux": "Design & UX",
};

export const SESSION_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export const SESSION_LEVEL_LABELS: Record<
  (typeof SESSION_LEVELS)[number],
  string
> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const SESSION_STATUSES = [
  "confirmed",
  "under_review",
  "draft",
  "completed",
] as const;

/** Limits of the submit form. The server will repeat them once the API exists. */
export const SESSION_TITLE_MAX = 80;
export const SESSION_ABSTRACT_MIN = 300;
export const SESSION_ABSTRACT_MAX = 1200;
export const SESSION_TAKEAWAY_MAX = 160;
export const SESSION_TAKEAWAY_SLOTS = 3;
export const SESSION_NOTES_MAX = 1000;
/** A lightning talk is a short slot: this is its longest allowed duration, in minutes. */
export const LIGHTNING_MAX_MINUTES = 30;
