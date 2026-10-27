import type { Metadata } from "next";
import { SpeakerDirectory } from "@/src/features/speakers";

export const metadata: Metadata = { title: "Speakers" };

// SPK-1: public, anyone can browse the speakers.
export default function SpeakersPage() {
  return <SpeakerDirectory />;
}
