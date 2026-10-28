import type { ReactNode } from "react";

/** What a dashboard section says when it has nothing to list ("No upcoming events"). */
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-5 py-8 text-center text-muted">{children}</p>;
}
