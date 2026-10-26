import { ok, parseInput, route } from "@/src/core/http";
import {
  speakerProfileResponseSchema,
  speakerSlugParamsSchema,
} from "@/src/features/speakers";
import { speakerService } from "@/src/features/speakers/server";

// SPK-2: one public speaker profile (bio, expertise, links). Unknown slug → 404.
export const GET = route<{ slug: string }>(
  { auth: "public" },
  async ({ params }) => {
    const { slug } = parseInput(speakerSlugParamsSchema, await params);
    const speaker = await speakerService.getSpeakerBySlug(slug);
    return ok(speakerProfileResponseSchema.parse(speaker));
  },
);
