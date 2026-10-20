import { cn } from "./cn";

/** "Ananya Rao" -> "AR"; one name -> one letter. Used when a user has no profile photo. */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** A round badge with the user's initials. Decorative: the name is always shown next to it. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand-soft-foreground",
        className,
      )}
    >
      {getInitials(name)}
    </span>
  );
}
