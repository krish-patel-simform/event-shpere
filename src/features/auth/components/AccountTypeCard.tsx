import { ChevronRight, Check, Clock, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useId } from "react";

type Feature = { label: string; icon: "check" | "pending" };

type AccountTypeCardProps = {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  features: readonly Feature[];
};

/** One choice on the signup chooser. The whole card is a single link named by its title. */
export function AccountTypeCard({ href, icon: Icon, title, description, features }: AccountTypeCardProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Link
      href={href}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="group flex gap-4 rounded-lg border border-line bg-surface p-5 transition-colors hover:border-brand hover:bg-surface-subtle"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-md bg-brand-soft text-brand-soft-foreground">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <span className="min-w-0 flex-1 space-y-2">
        <span className="flex items-center justify-between gap-2">
          <span id={titleId} className="font-semibold">
            {title}
          </span>
          <ChevronRight aria-hidden="true" className="size-4 text-muted transition-transform group-hover:translate-x-0.5" />
        </span>
        <span id={descriptionId} className="block text-sm text-muted">
          {description}
        </span>
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {features.map((feature) => {
            const FeatureIcon = feature.icon === "check" ? Check : Clock;
            return (
              <span key={feature.label} className="flex items-center gap-1.5">
                <FeatureIcon
                  aria-hidden="true"
                  className={feature.icon === "check" ? "size-3.5 text-success" : "size-3.5 text-warning"}
                />
                {feature.label}
              </span>
            );
          })}
        </span>
      </span>
    </Link>
  );
}
