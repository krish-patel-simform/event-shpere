import { MapPinned } from "lucide-react";

/** An icon button that opens the venue's map pin in Google Maps, in a new tab. */
export function MapLink({
  href,
  venueName,
}: {
  href: string;
  venueName: string;
}) {
  const label = `Open ${venueName} in Google Maps (new tab)`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title="Open in Google Maps"
      className="inline-flex size-8 items-center justify-center rounded-md border border-line text-link hover:bg-surface-subtle"
    >
      <MapPinned aria-hidden="true" className="size-4" />
    </a>
  );
}
