// Client-safe public API of the events feature. Never export anything from ./server here.
export { EventAttendees } from "./components/EventAttendees";
export { EventBrowse } from "./components/EventBrowse";
export { EventFormPage } from "./components/EventFormPage";
export { EventLoader } from "./components/EventLoader";
export { EventOverview } from "./components/EventOverview";
export { EventHalls } from "./components/EventHalls";
export { EventSchedule } from "./components/EventSchedule";
export { EventSpeakers } from "./components/EventSpeakers";
export { EventPageHeader } from "./components/EventPageHeader";
export { MyEvents } from "./components/MyEvents";
export { PublicEventDetail } from "./components/PublicEventDetail";
export { PublicEventDetailSkeleton } from "./components/PublicEventDetailSkeleton";
export {
  EVENT_GALLERY_MAX_IMAGES,
  EVENT_IMAGE_FORM_FIELD,
  EVENT_IMAGE_MAX_BYTES,
  EVENT_IMAGE_TYPES,
  type EventImageType,
} from "./constants";
export {
  eventEditHref,
  eventHref,
  eventSessionNewHref,
  eventSessionsHref,
  EVENT_ROUTES,
  EVENT_STEPS,
  parseEventStep,
  publicEventHref,
  type EventStep,
} from "./routes";
// Cache keys and the "an event changed" refresh, for other features whose changes show on the
// event's pages (a session added or cancelled changes the event's session counts and checklist).
export { eventQueryKeys, invalidateEvent } from "./hooks/event-cache";
// Pure helpers other features reuse instead of copying: an event's times are typed and shown in
// its own zone (India for now), and prices are typed in rupees and sent in paise.
export {
  istInstant,
  rupeesToPaise,
  toIsoWithOffset,
} from "./schemas/event-form.schemas";
export {
  formatEventDates,
  formatTicketPrice,
  isEditable as isEventEditable,
  plural,
  toFormDateTime,
  zoneLabel,
} from "./utils/event-display";
export {
  eventContentResponseSchema,
  eventCoverResponseSchema,
  eventGalleryResponseSchema,
  eventIdParam,
  eventMediaSchema,
  galleryImageParam,
  updateEventContentBodySchema,
  type EventContentDto,
  type EventCoverDto,
  type EventGalleryDto,
  type EventMediaDto,
  type UpdateEventContentBody,
} from "./schemas/event-content.schemas";
export {
  publicEventDetailSchema,
  publicEventListItemSchema,
  publicEventListQuerySchema,
  publicEventListResponseSchema,
  publicEventPrices,
  publicEventSlugParam,
  publicEventSorts,
  publicEventWhens,
  publicMediaSchema,
  publicSessionSchema,
  type PublicEventContentDto,
  type PublicEventDetailDto,
  type PublicEventListItemDto,
  type PublicEventListQuery,
  type PublicEventPrice,
  type PublicEventSort,
  type PublicEventWhen,
  type PublicMediaDto,
  type PublicSessionDto,
} from "./schemas/event-public.schemas";
export {
  eventDisplayStatusSchema,
  eventOverviewSchema,
  eventSorts,
  eventTabCountsSchema,
  eventTabs,
  fullSessionSchema,
  managedEventSchema,
  myEventListQuerySchema,
  myEventListResponseSchema,
  type EventDisplayStatus,
  type EventOverviewData,
  type EventSort,
  type EventTabCounts,
  type EventTabKey,
  type FullSession,
  type ManagedEvent,
  type MyEventListQuery,
} from "./schemas/event-manage.schemas";
export {
  createEventBodySchema,
  eventResponseSchema,
  updateEventBodySchema,
  type CreateEventBody,
  type CreateEventRequest,
  type EventDto,
  type UpdateEventBody,
  type UpdateEventRequest,
} from "./schemas/events.schemas";
