import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

export type AlertTone = "error" | "warning" | "info" | "success";

const tones: Record<AlertTone, { box: string; icon: LucideIcon; role: "alert" | "status" }> = {
  error: { box: "border-danger/40 bg-danger-soft text-danger", icon: CircleAlert, role: "alert" },
  warning: { box: "border-warning/40 bg-warning-soft text-warning", icon: TriangleAlert, role: "alert" },
  info: { box: "border-info/30 bg-info-soft text-info", icon: Info, role: "status" },
  success: { box: "border-success/30 bg-success-soft text-success", icon: CircleCheck, role: "status" },
};

type AlertProps = Omit<ComponentProps<"div">, "title"> & {
  tone: AlertTone;
  title?: ReactNode;
};

/**
 * Message box. error/warning are announced at once (role="alert"), info/success politely (role="status").
 * tabIndex -1 lets a form move keyboard focus here after a failed submit: pass a `ref`.
 */
export function Alert({ tone, title, className, children, ...props }: AlertProps) {
  const { box, icon: Icon, role } = tones[tone];

  return (
    <div
      role={role}
      tabIndex={-1}
      className={cn("flex gap-3 rounded-md border p-3 text-sm", box, className)}
      {...props}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}
