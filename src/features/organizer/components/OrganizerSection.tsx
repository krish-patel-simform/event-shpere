import type { ComponentProps, ReactNode } from "react";
import { Badge } from "@/src/core/ui";

/** Header cell classes shared by the three organizer tables. */
export const TH = "px-4 py-2.5 font-semibold";

/** A titled card with a count badge, the frame of each organizer list. */
export function OrganizerSection({
  id,
  title,
  count,
  tone,
  description,
  children,
}: {
  /** Also the in-page anchor the summary cards link to. */
  id: string;
  title: string;
  count: number;
  tone: ComponentProps<typeof Badge>["tone"];
  description: string;
  children: ReactNode;
}) {
  const titleId = `${id}-title`;
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className="scroll-mt-6 overflow-hidden rounded-lg border border-line bg-surface"
    >
      <div className="border-b border-line px-5 py-4">
        <h2 id={titleId} className="flex items-center gap-2 font-semibold">
          {title}
          <Badge tone={tone}>{count}</Badge>
        </h2>
        <p className="text-sm text-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="px-5 py-8 text-center text-muted">{children}</p>;
}
