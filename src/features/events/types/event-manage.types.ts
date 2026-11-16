// The shapes of an event on the organizer's screens come from the schemas, so the server and the
// browser share one definition.
export type {
  EventDisplayStatus,
  EventOverviewData,
  FullSession,
  ManagedEvent,
} from "../schemas/event-manage.schemas";

/** A venue to pick on the event form. */
export type VenueOption = {
  id: string;
  name: string;
  city: string;
  /** The name of the venue's state: what the form's State select filters by. */
  state: string;
  addressLine: string;
  hallCount: number;
  timezone: string;
};
