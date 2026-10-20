import type { ReactNode } from "react";

/** Page title + one line of help above an auth form. The title is the page's only <h1>. */
export function AuthHeading({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <div className="mb-5 space-y-1.5">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {subtitle && <p className="text-muted">{subtitle}</p>}
    </div>
  );
}
