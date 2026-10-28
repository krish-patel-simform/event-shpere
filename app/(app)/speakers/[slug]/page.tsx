import type { Metadata } from "next";
import { Suspense } from "react";
import { SpeakerDetail, SpeakerDetailSkeleton } from "@/src/features/speakers";

export const metadata: Metadata = { title: "Speaker" };

// SPK-2: public, anyone can open a speaker.
export default function SpeakerPage(props: PageProps<"/speakers/[slug]">) {
  return (
    // params is request data: with cacheComponents it must be read inside Suspense.
    <Suspense fallback={<SpeakerDetailSkeleton />}>
      <SpeakerSection params={props.params} />
    </Suspense>
  );
}

async function SpeakerSection({
  params,
}: Pick<PageProps<"/speakers/[slug]">, "params">) {
  const { slug } = await params;
  // Whether this slug is a speaker is decided by the API: an unknown or badly formed slug is a 404 or 400.
  return <SpeakerDetail slug={slug} />;
}
