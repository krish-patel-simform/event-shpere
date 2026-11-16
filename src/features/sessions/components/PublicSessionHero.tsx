import {
  CalendarDays,
  MapPin,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/src/core/ui";
import {
  formatTicketPrice,
  publicEventHref,
  PUBLIC_SESSION_TYPE_LABELS,
} from "../../events";
import type { PublicSessionDetailDto } from "../schemas/session-public.schemas";
import {
  PUBLIC_SESSION_MODE_LABELS,
  sessionWhen,
  sessionWhere,
} from "../utils/public-session-display";

function Fact({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <p className="inline-flex items-center gap-2.5 rounded-lg bg-surface-subtle px-3.5 py-2 text-sm font-medium">
      <Icon aria-hidden="true" className="size-4.5 shrink-0 text-muted" />
      {children}
    </p>
  );
}

/**
 * The top of a session's public page: a wide cover (the organizer's image, or a soft panel when
 * there is none) with the type, format and price on it, then the title, the event it belongs to,
 * and when and where it is.
 */
export function PublicSessionHero({
  session,
}: {
  session: PublicSessionDetailDto;
}) {
  const { event, content } = session;
  const cover = content?.coverImage;
  const when = sessionWhen(session);

  return (
    <section
      aria-labelledby="session-title"
      className="overflow-hidden rounded-xl border border-line bg-surface"
    >
      <div className="relative aspect-video max-h-96 w-full overflow-hidden bg-linear-to-br from-brand-soft to-surface-subtle sm:aspect-[21/9]">
        {cover ? (
          // A plain <img>, like the event's banner: it comes from the CMS host.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.url}
            alt={cover.alt ?? ""}
            className="size-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="grid size-full place-items-center text-brand-soft-foreground/60"
          >
            <Presentation className="size-14" />
          </div>
        )}
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <Badge tone="surface">
            {PUBLIC_SESSION_TYPE_LABELS[session.type]}
          </Badge>
          <Badge tone="surface">
            {PUBLIC_SESSION_MODE_LABELS[session.mode]}
          </Badge>
          {session.price > 0 && (
            <Badge tone="brand">+ {formatTicketPrice(session.price)}</Badge>
          )}
        </div>
      </div>

      <div className="space-y-4 p-6 sm:p-8">
        <div>
          <h1
            id="session-title"
            className="text-3xl font-semibold leading-tight sm:text-4xl"
          >
            {session.title}
          </h1>
          <p className="mt-1.5 text-muted">
            Part of{" "}
            <Link
              href={publicEventHref(event.slug)}
              className="font-medium text-link hover:underline"
            >
              {event.title}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Fact icon={CalendarDays}>
            {when ? `${when.date} · ${when.time}` : "Time to be announced"}
          </Fact>
          <Fact icon={MapPin}>{sessionWhere(session)}</Fact>
        </div>
      </div>
    </section>
  );
}
