import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo, ThemeToggle } from "@/src/core/ui";
import { SITE_ROUTES } from "../../routes";

type AuthShellProps = {
  /** The brand panel (<BrandPanel/>); differs per screen, so the page passes it in. */
  panel: ReactNode;
  /** Top-left link back to the previous step, e.g. "Change account type". */
  backLink?: { label: string; href: string };
  /** Top-right switch link, e.g. "New to EventSphere? Create an account". */
  headerLink?: { prompt: string; label: string; href: string };
  /** `wide` gives long forms room for two or three fields per row. Default `narrow`. */
  width?: "narrow" | "wide";
  /** Text before the "Contact support" link in the footer. Default "Having trouble?". */
  supportPrompt?: string;
  /** The screen's heading and form. */
  children: ReactNode;
};

/**
 * Two-column layout shared by every auth screen: brand panel on the left (lg and up),
 * form column on the right. Below lg the panel is hidden and a compact logo is shown.
 */
export function AuthShell({ panel, backLink, headerLink, width = "narrow", supportPrompt = "Having trouble?", children }: AuthShellProps) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,40fr)_minmax(0,60fr)]">
      {/* Sticky + viewport height: the panel stays put while a long form scrolls. If the panel
          itself is taller than a short screen, it scrolls on its own instead of being cut off. */}
      <aside className="hidden lg:block">
        <div className="sticky top-0 h-dvh overflow-y-auto">{panel}</div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Logo className="lg:hidden" />
            {backLink && (
              <Link
                href={backLink.href}
                className="inline-flex items-center gap-1 text-sm font-semibold text-link"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
                {backLink.label}
              </Link>
            )}
          </div>
          <div className="ml-auto flex items-center gap-4">
            {headerLink && (
              <p className="text-right text-sm text-muted">
                {headerLink.prompt}{" "}
                <Link href={headerLink.href} className="font-semibold text-link underline">
                  {headerLink.label}
                </Link>
              </p>
            )}
            <ThemeToggle />
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 py-4 sm:px-8">
          <div className={width === "wide" ? "w-full max-w-2xl" : "w-full max-w-md"}>{children}</div>
        </main>

        <footer className="px-4 py-4 text-center text-sm text-muted sm:px-8">
          {supportPrompt}{" "}
          <Link href={SITE_ROUTES.support} className="underline">
            Contact support
          </Link>
        </footer>
      </div>
    </div>
  );
}
