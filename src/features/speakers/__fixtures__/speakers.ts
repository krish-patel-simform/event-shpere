import type {
  CreateSpeakerResponseDto,
  SpeakerListItemDto,
  SpeakerProfileDto,
} from "../schemas/speaker.schemas";

/** A speaker with a full profile: photo, role, five topics. */
export const ananya: SpeakerListItemDto = {
  slug: "ananya-rao-3f9a1c",
  firstName: "Ananya",
  lastName: "Rao",
  profile: {
    photo: {
      url: "https://cms.example.com/uploads/ananya.jpg",
      alt: "Ananya Rao on stage",
      width: 400,
      height: 400,
    },
    jobTitle: "Principal Frontend Engineer",
    company: "Northwind Labs",
    expertise: [
      "Next.js",
      "TypeScript",
      "Performance",
      "Design systems",
      "A11y",
    ],
  },
};

/** Only a job title, no photo and no topics. */
export const meera: SpeakerListItemDto = {
  slug: "meera-joshi-7b2e4d",
  firstName: "Meera",
  lastName: "Joshi",
  profile: {
    photo: null,
    jobTitle: "Head of Design Systems",
    company: null,
    expertise: [],
  },
};

/** In the database, but the CMS has nothing for them right now. */
export const vikram: SpeakerListItemDto = {
  slug: "vikram-mehta-1a2b3c",
  firstName: "Vikram",
  lastName: "Mehta",
  profile: null,
};

export const speakerRows: SpeakerListItemDto[] = [ananya, meera, vikram];

export const ananyaProfile: SpeakerProfileDto = {
  slug: ananya.slug,
  firstName: "Ananya",
  lastName: "Rao",
  profile: {
    photo: ananya.profile?.photo ?? null,
    jobTitle: "Principal Frontend Engineer",
    company: "Northwind Labs",
    bio: [
      {
        type: "paragraph",
        children: [
          { type: "text", text: "Ananya leads frontend platform work." },
        ],
      },
      {
        type: "paragraph",
        children: [
          { type: "text", text: "She mentors early-career engineers." },
        ],
      },
    ],
    expertise: ["Next.js", "TypeScript"],
    links: {
      linkedin: "https://linkedin.com/in/ananya",
      twitter: null,
      website: "https://ananya.dev",
    },
  },
};

export const createdSpeaker: CreateSpeakerResponseDto = {
  id: "0b7c2d1e-3f4a-4b5c-8d6e-7f8091a2b3c4",
  userId: "1c8d3e2f-4a5b-4c6d-9e7f-8091a2b3c4d5",
  firstName: "Sneha",
  lastName: "Desai",
  email: "sneha.desai@example.com",
  status: "pending",
  slug: "sneha-desai-9d8c7b",
  createdAt: "2026-10-27T09:00:00.000Z",
  setupEmailQueued: true,
};
