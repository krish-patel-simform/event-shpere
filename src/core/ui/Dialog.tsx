"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "./cn";

type DialogProps = {
  open: boolean;
  /**
   * Asked for by Escape, the X button and a click on the dark backdrop. The parent decides: it
   * sets `open` to false.
   */
  onClose: () => void;
  title: string;
  /** Usually a <DialogBody> and a <DialogFooter>. */
  children: ReactNode;
  className?: string;
};

/**
 * A modal on the native <dialog>: the browser gives it the focus trap, the Escape key and the
 * inert page behind it. The content is only rendered while it is open, so a form inside starts
 * empty every time the dialog opens.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
}: DialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // A click on the dark backdrop is a click on the <dialog> element itself (it has no padding).
        if (event.target === dialog.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-line bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/50",
        className,
      )}
    >
      {open && (
        <>
          <div className="flex items-start justify-between gap-3 px-5 pt-5">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 -mt-1 rounded-md p-2 text-muted hover:bg-surface-subtle"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
          {children}
        </>
      )}
    </dialog>
  );
}

export function DialogBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4 px-5 pb-1 pt-3", className)}>{children}</div>
  );
}

/** The button row at the bottom, right-aligned, wrapping on narrow screens. */
export function DialogFooter({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 flex flex-wrap justify-end gap-2.5 border-t border-line px-5 py-4">
      {children}
    </div>
  );
}
