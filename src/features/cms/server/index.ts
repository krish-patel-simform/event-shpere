// Server-only entry of the cms feature: what other features' server code imports.
import "server-only";

export {
  StrapiRequestError,
  strapiOrganizerClient,
  type StrapiOrganizerClient,
} from "./strapi-organizer.client";
export {
  strapiSpeakerClient,
  type StrapiSpeakerClient,
} from "./strapi-speaker.client";
