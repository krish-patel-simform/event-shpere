// Server-only entry of the registrations feature: what route handlers import.
import "server-only";

export {
  registrationService,
  type RegistrationActor,
  type RegistrationService,
} from "./registration.service";
