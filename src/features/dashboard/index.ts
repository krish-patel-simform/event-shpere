// Client-safe public API of the dashboard feature: the signed-in area's shell (side menu and
// top bar) and the dashboard content. Other code imports from here, not from the internals.
export { DashboardShell, type DashboardUser } from "./components/DashboardShell";
export {
  OrganizerReviewStatus,
  type OrganizerApplication,
} from "./components/OrganizerReviewStatus";
