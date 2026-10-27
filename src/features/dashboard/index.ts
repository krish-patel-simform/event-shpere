// Client-safe public API of the dashboard feature: the signed-in area's shell (side menu and
// top bar) and the dashboard content. Other code imports from here, not from the internals.
export { DashboardSession } from "./components/DashboardSession";
export { DashboardHome } from "./components/DashboardHome";
export { AdminOrganizers } from "./components/admin/AdminOrganizers";
export { AdminUsers } from "./components/admin/AdminUsers";
export { ADMIN_USERS_SAMPLE } from "./utils/admin-users.sample";
// TODO(API): remove once the Organizers page loads its data from the API.
export { ADMIN_ORGANIZERS_SAMPLE } from "./utils/admin-organizers.sample";
export {
  DashboardShell,
  type DashboardUser,
} from "./components/DashboardShell";
export {
  OrganizerReviewStatus,
  type OrganizerApplication,
} from "./components/OrganizerReviewStatus";
