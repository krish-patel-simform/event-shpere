import { Check, Circle } from "lucide-react";
import { cn } from "@/src/core/ui";
import { PASSWORD_RULES } from "../../utils/password-rules";

/** Live checklist under a new-password field: each rule turns green when the password meets it. */
export function PasswordRequirements({
  password,
  columns = 2,
}: {
  password: string;
  /** 3 columns from the `sm` breakpoint up for a wide form; 2 otherwise. */
  columns?: 2 | 3;
}) {
  return (
    <ul
      aria-label="Password requirements"
      className={cn(
        "grid grid-cols-2 gap-x-6 gap-y-1 rounded-md border border-line bg-surface-subtle px-3 py-2 text-xs",
        columns === 3 && "sm:grid-cols-3",
      )}
    >
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        const Icon = met ? Check : Circle;
        return (
          <li key={rule.id} className={cn("flex items-center gap-2", met ? "text-success" : "text-muted")}>
            <Icon aria-hidden="true" className="size-3.5 shrink-0" />
            <span>
              {rule.label}
              <span className="sr-only"> {met ? "(met)" : "(not met)"}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
