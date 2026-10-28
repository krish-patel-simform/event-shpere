import type { PollKind } from "../types/poll.types";

export const POLL_KIND_LABEL: Record<PollKind, string> = {
  single: "single choice",
  multiple: "multiple choice",
  rating: "1–5 rating",
};
