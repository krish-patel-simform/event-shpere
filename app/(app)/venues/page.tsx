import type { Metadata } from "next";
import { VenueDirectory } from "@/src/features/venues";

export const metadata: Metadata = { title: "Venues" };

// Discover: public, anyone can browse the active venues.
export default function VenuesPage() {
  return <VenueDirectory />;
}
