"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/src/core/ui";
import { NAV_SECTIONS } from "../nav-items";

/** The menu links. The page you are on is highlighted and marked aria-current="page". */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="space-y-5">
      {NAV_SECTIONS.map((section, index) => (
        <div key={section.heading ?? index} className="space-y-1">
          {section.heading && (
            <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted">
              {section.heading}
            </p>
          )}
          <ul className="space-y-0.5">
            {section.items.map(({ label, href, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-brand-soft text-brand-soft-foreground"
                        : "text-foreground hover:bg-surface-subtle",
                    )}
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
