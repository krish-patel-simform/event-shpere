// Client-safe public API of the registrations feature. Never export anything from ./server here.
// A "use client" module: the event page shows it in its price box.
export {
  EventAttendeeList,
  type AttendeeListEvent,
} from "./components/EventAttendeeList";
export { EventCheckInDesk } from "./components/EventCheckInDesk";
export { EventRegistrationCard } from "./components/EventRegistrationCard";
export { MyTickets } from "./components/MyTickets";
export {
  SessionAttendeeList,
  type AttendeeListSession,
} from "./components/SessionAttendeeList";
export { SessionBookingCard } from "./components/SessionBookingCard";
export { publicEventPath, REGISTRATION_ROUTES } from "./routes";
export {
  adjustPublicSeatsLeft,
  adjustPublicSessionSeatsLeft,
  PUBLIC_EVENT_DETAILS_KEY,
  PUBLIC_SESSION_DETAILS_KEY,
} from "./hooks/registration-cache";
export type { RegistrationCardEvent } from "./utils/registration-card-state";
export type {
  SessionBookingEvent,
  SessionBookingTarget,
} from "./utils/session-booking-state";
export {
  attendeeCheckInFilters,
  attendeeCountsSchema,
  attendeeListMetaSchema,
  attendeeListQuerySchema,
  attendeeListResponseSchema,
  attendeeSchema,
  attendeeSorts,
  attendeeStatusFilters,
  sessionAttendeeCountsSchema,
  sessionAttendeeListMetaSchema,
  sessionAttendeeListResponseSchema,
  sessionAttendeeSchema,
  type AttendeeCounts,
  type AttendeeDto,
  type AttendeeListMeta,
  type AttendeeListQuery,
  type SessionAttendeeCounts,
  type SessionAttendeeDto,
  type SessionAttendeeListMeta,
} from "./schemas/attendees.schemas";
export {
  checkInBodySchema,
  eventCheckInBodySchema,
  type EventCheckInBody,
  checkInCountsSchema,
  checkInListQuerySchema,
  checkInLogItemSchema,
  checkInLogMetaSchema,
  checkInLogResponseSchema,
  checkInResponseSchema,
  checkInSorts,
  sessionCheckInResponseSchema,
  type SessionCheckInDto,
  type CheckInBody,
  type CheckInCounts,
  type CheckInDto,
  type CheckInListQuery,
  type CheckInLogItemDto,
  type CheckInLogMeta,
} from "./schemas/check-ins.schemas";
export {
  myRegistrationListQuerySchema,
  myRegistrationResponseSchema,
  myRegistrationStatusFilters,
  myRegistrationWhenFilters,
  myTicketListResponseSchema,
  myTicketSchema,
  registrationEventParam,
  registrationReasonSchema,
  registrationResponseSchema,
  sessionBookingParam,
  sessionBookingResponseSchema,
  type MyRegistrationDto,
  type MyRegistrationListQuery,
  type MyTicketDto,
  type RegistrationDto,
  type RegistrationReason,
  type SessionBookingDto,
} from "./schemas/registrations.schemas";
