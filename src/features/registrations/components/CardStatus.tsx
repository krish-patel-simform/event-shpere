import type { ReactNode } from "react";

/** A bold title and a muted line under it: the top of most registration and booking states. */
export function CardStatus({
  title,
  children,
  icon,
}: {
  title: string;
  children?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex gap-2.5">
      {icon}
      <div>
        <p className="font-semibold">{title}</p>
        {children && <p className="text-sm text-muted">{children}</p>}
      </div>
    </div>
  );
}
