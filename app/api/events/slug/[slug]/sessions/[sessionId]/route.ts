import { ok, parseInput, route } from "@/src/core/http";
import {
  publicSessionDetailSchema,
  publicSessionParams,
} from "@/src/features/sessions";
import { sessionService } from "@/src/features/sessions/server";

// One session's public page, by the event's public link and the session's id, for guests too.
// Only a scheduled session of a published (or cancelled) event; anything else is a 404, so the
// answer never says whether a draft or a cancelled session exists. It lives under /slug/ for the
// same reason as the event's public route: /api/events/[eventId]/sessions/[sessionId] is the
// organizer's view, by id, with the join link, limited to the owner.
export const GET = route<{ slug: string; sessionId: string }>(
  { auth: "public" },
  async ({ params }) => {
    const { slug, sessionId } = parseInput(publicSessionParams, await params);
    const session = await sessionService.getPublicSession(slug, sessionId);
    return ok(publicSessionDetailSchema.parse(session));
  },
);
