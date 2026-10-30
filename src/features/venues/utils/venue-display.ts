import type { Tab } from "@/src/core/ui";
import type {
  CreateHallDto,
  VenueSort,
  VenueStatusFilter,
} from "../schemas/venue.schemas";

export type VenueTabKey = "all" | VenueStatusFilter;

/** What a dialog needs to know about the venue it acts on (a list row or the open venue). */
export type VenueRef = { id: string; name: string; hallCount: number };

/** The tabs above the list: each one is the same list filtered by status. */
export const VENUE_TABS: readonly Tab<VenueTabKey>[] = [
  { key: "all", label: "All venues" },
  { key: "active", label: "Active", tone: "success" },
  { key: "inactive", label: "Inactive" },
];

/** What a tab asks the server for: one status, or (for "all") no status filter. */
export function tabStatus(tab: VenueTabKey): VenueStatusFilter | undefined {
  return tab === "all" ? undefined : tab;
}

export const TAB_DESCRIPTIONS: Record<VenueTabKey, string> = {
  all: "Every venue, whether organizers can use it or not.",
  active: "Visible to everyone; organizers can pick them for events.",
  inactive: "Hidden from guests and attendees. All their halls are inactive.",
};

export const SORT_OPTIONS: readonly { value: VenueSort; label: string }[] = [
  { value: "name", label: "Name A–Z" },
  { value: "newest", label: "Newest first" },
  { value: "halls", label: "Most halls" },
];

/** "3 active · 1 inactive", "all active" or "all inactive": how many halls organizers can use. */
export function activeHallsLabel(hallsOn: number, hallCount: number): string {
  if (hallsOn === 0) return "all inactive";
  if (hallsOn === hallCount) return "all active";
  return `${hallsOn} active · ${hallCount - hallsOn} inactive`;
}

/** The one word for a venue's or a hall's status, everywhere on the venue pages. */
export function statusLabel(isActive: boolean): "Active" | "Inactive" {
  return isActive ? "Active" : "Inactive";
}

export function pluralHalls(count: number): string {
  return `${count} ${count === 1 ? "hall" : "halls"}`;
}

/** The numbers under the Halls heading, worked out from the hall list the detail already has. */
export function summarizeHalls(halls: readonly CreateHallDto[]) {
  const hallsOn = halls.filter((hall) => hall.isActive).length;
  return {
    hallCount: halls.length,
    hallsOn,
    totalSeats: halls.reduce((sum, hall) => sum + hall.capacity, 0),
  };
}
