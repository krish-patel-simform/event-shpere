import type { Metadata } from "next";
import { EventBrowse } from "@/src/features/events";

export const metadata: Metadata = { title: "Browse events" };

// DISC-1 to DISC-4: public, anyone (guests too) can browse the published events.
export default function EventsPage() {
  return <EventBrowse />;
}
