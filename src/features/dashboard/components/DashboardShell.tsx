"use client";

import { Bell, LogOut, Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { Avatar, Logo, ThemeToggle } from "@/src/core/ui";
import { SidebarNav } from "./SidebarNav";

export type DashboardUser = {
  name: string;
  /** Second line under the name, e.g. "Attendee · organizer pending". */
  roleLabel: string;
};

function SidebarContent({ user, onNavigate }: { user: DashboardUser; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link href="/dashboard" onClick={onNavigate} className="px-1">
        <Logo />
      </Link>
      <div className="flex-1 overflow-y-auto">
        <SidebarNav onNavigate={onNavigate} />
      </div>
      <div className="flex items-center gap-3 border-t border-line pt-4">
        <Avatar name={user.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="text-xs text-muted">{user.roleLabel}</p>
        </div>
        {/* TODO(API) AUTH-9: call POST /api/auth/logout, then go to /login. */}
        <button
          type="button"
          disabled
          aria-label="Log out (coming soon)"
          title="Log out (coming soon)"
          className="rounded-md p-2 text-muted disabled:cursor-not-allowed"
        >
          <LogOut aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Layout of the signed-in area: side menu (a slide-in drawer below `lg`), top bar with
 * search, notifications and the user, and the page content.
 */
export function DashboardShell({ user, children }: { user: DashboardUser; children: ReactNode }) {
  // The drawer is a native <dialog>: the browser gives it a focus trap and the Escape key.
  const drawer = useRef<HTMLDialogElement>(null);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-line bg-surface lg:block">
        <div className="sticky top-0 h-dvh">
          <SidebarContent user={user} />
        </div>
      </aside>

      <dialog
        ref={drawer}
        aria-label="Menu"
        onClick={(event) => {
          // A click on the dark backdrop is a click on the <dialog> element itself.
          if (event.target === drawer.current) drawer.current?.close();
        }}
        className="m-0 h-dvh max-h-none w-72 max-w-[85vw] bg-surface text-foreground backdrop:bg-black/50 lg:hidden"
      >
        <button
          type="button"
          onClick={() => drawer.current?.close()}
          aria-label="Close menu"
          className="absolute right-2 top-2 rounded-md p-2 text-muted"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
        <SidebarContent user={user} onNavigate={() => drawer.current?.close()} />
      </dialog>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6">
          <button
            type="button"
            onClick={() => drawer.current?.showModal()}
            aria-label="Open menu"
            className="rounded-md p-2 lg:hidden"
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>

          {/* TODO(DISC-2): wire to the events/speakers/sessions search. */}
          <form role="search" onSubmit={(event) => event.preventDefault()} className="relative max-w-xl flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              aria-label="Search events, speakers, sessions"
              placeholder="Search events, speakers, sessions"
              className="w-full rounded-md border border-field bg-surface py-2 pl-9 pr-3 text-sm placeholder:text-muted/70"
            />
          </form>

          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/notifications"
              aria-label="Notifications"
              className="rounded-md border border-field p-2 text-muted hover:bg-surface-subtle"
            >
              <Bell aria-hidden="true" className="size-4" />
            </Link>
            <Avatar name={user.name} />
          </div>
        </header>

        <main className="flex-1 bg-canvas px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
