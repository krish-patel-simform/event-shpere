"use client";

import { EllipsisVertical, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";

type ItemBase = {
  label: string;
  icon?: LucideIcon;
  tone?: "danger";
  /** A line above this item, to set it apart (e.g. a destructive action). */
  separatorBefore?: boolean;
};

export type ActionMenuItem =
  | (ItemBase & { href: string; onSelect?: never })
  | (ItemBase & { onSelect: () => void; href?: never });

const itemClass =
  "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm hover:bg-surface-subtle focus-visible:bg-surface-subtle";

/**
 * A "⋮" button that opens a menu of actions (links or buttons), for the end of a table row.
 * The menu is drawn in a portal with fixed position, so a table's own scrolling cannot clip it.
 * Keyboard: Enter/Space opens and moves focus into the menu, arrows move, Escape closes and
 * returns focus to the button. A click outside, a scroll or a resize closes it.
 */
export function ActionMenu({
  label,
  items,
}: {
  /** Names both the button and the menu, e.g. "Actions for Ananya Rao". */
  label: string;
  items: readonly ActionMenuItem[];
}) {
  // Where the menu sits (from the button's position); null = closed.
  const [position, setPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const isOpen = position !== null;

  function close(returnFocus: boolean) {
    setPosition(null);
    if (returnFocus) trigger.current?.focus();
  }

  function toggle() {
    if (isOpen) return close(false);
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  }

  useEffect(() => {
    if (!isOpen) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();

    const closeOnOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !menu.current?.contains(target) &&
        !trigger.current?.contains(target)
      ) {
        setPosition(null);
      }
    };
    const closeOnMove = () => setPosition(null);
    document.addEventListener("mousedown", closeOnOutside);
    window.addEventListener("resize", closeOnMove);
    window.addEventListener("scroll", closeOnMove, true);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      window.removeEventListener("resize", closeOnMove);
      window.removeEventListener("scroll", closeOnMove, true);
    };
  }, [isOpen]);

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      return close(true);
    }
    if (event.key === "Tab") return close(false);

    const entries = Array.from(
      menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    const current = entries.indexOf(document.activeElement as HTMLElement);
    const move = (index: number) => {
      event.preventDefault();
      entries[(index + entries.length) % entries.length]?.focus();
    };
    if (event.key === "ArrowDown") move(current + 1);
    if (event.key === "ArrowUp") move(current - 1);
    if (event.key === "Home") move(0);
    if (event.key === "End") move(entries.length - 1);
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={toggle}
        className="rounded-md p-2 text-muted hover:bg-surface-subtle"
      >
        <EllipsisVertical aria-hidden="true" className="size-4" />
      </button>
      {position &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKeyDown}
            style={{
              position: "fixed",
              top: position.top,
              right: position.right,
            }}
            className="z-50 w-60 rounded-md border border-line bg-surface py-1.5 text-foreground shadow-lg"
          >
            {items.map((item) => {
              const content = (
                <>
                  {item.icon && (
                    <item.icon aria-hidden="true" className="size-4 shrink-0" />
                  )}
                  {item.label}
                </>
              );
              const className = cn(
                itemClass,
                item.tone === "danger" && "text-danger",
              );
              return (
                <div key={item.label}>
                  {item.separatorBefore && (
                    <hr className="my-1.5 border-line" />
                  )}
                  {item.href !== undefined ? (
                    <Link
                      role="menuitem"
                      href={item.href}
                      onClick={() => close(false)}
                      className={className}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        close(true);
                        item.onSelect();
                      }}
                      className={className}
                    >
                      {content}
                    </button>
                  )}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
