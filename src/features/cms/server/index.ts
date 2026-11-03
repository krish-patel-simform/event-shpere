// Server-only entry of the cms feature: what other features' server code imports.
import "server-only";

export {
  StrapiRequestError,
  strapiOrganizerClient,
  type StrapiOrganizerClient,
} from "./strapi-organizer.client";
export {
  strapiEventClient,
  type StrapiEventClient,
} from "./strapi-event.client";
export {
  strapiMediaClient,
  type StrapiMediaClient,
} from "./strapi-media.client";
export {
  strapiSpeakerClient,
  type StrapiSpeakerClient,
} from "./strapi-speaker.client";
