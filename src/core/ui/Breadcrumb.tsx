import { ChevronRight } from "lucide-react";
import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  /** Every item but the last (the page you are on) links somewhere. */
  href?: string;
};

/** "Organizers › Acme Events": where this page sits, with a link back up. */
export function Breadcrumb({ items }: { items: readonly BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.label} className="flex items-center gap-1.5">
              {isLast || !item.href ? (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className="font-medium text-foreground"
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="font-medium text-link hover:underline"
                >
                  {item.label}
                </Link>
              )}
              {!isLast && (
                <ChevronRight aria-hidden="true" className="size-3.5" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
