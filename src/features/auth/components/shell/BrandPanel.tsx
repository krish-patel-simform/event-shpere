import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/src/core/ui";
import { SITE_ROUTES } from "../../routes";

const COPYRIGHT_YEAR = 2026;

type BrandPanelProps = {
  headline: string;
  subtitle: string;
  /** Illustration or progress block under the subtitle. Decorative illustrations hide themselves with aria-hidden. */
  children?: ReactNode;
};

/** The navy left side of every auth screen. AuthShell shows it from the `lg` breakpoint up. */
export function BrandPanel({ headline, subtitle, children }: BrandPanelProps) {
  return (
    <div className="flex min-h-full flex-col justify-between gap-10 bg-panel px-10 py-9 text-panel-foreground xl:px-14">
      <div className="space-y-10">
        <Logo onPanel />
        <div className="max-w-lg space-y-3">
          <h2 className="text-balance text-3xl font-semibold leading-tight xl:text-4xl">
            {headline}
          </h2>
          <p className="text-panel-muted">{subtitle}</p>
        </div>
        {children && (
          <div className="max-w-lg">{children}</div>
        )}
      </div>

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-panel-muted">
        <span>© {COPYRIGHT_YEAR} EventSphere</span>
        <Link href={SITE_ROUTES.privacy} className="underline">
          Privacy
        </Link>
        <Link href={SITE_ROUTES.terms} className="underline">
          Terms
        </Link>
      </p>
    </div>
  );
}
