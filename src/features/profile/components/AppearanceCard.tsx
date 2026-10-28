"use client";

import { Card, ThemeToggle } from "@/src/core/ui";

/** The colour theme. This one works: the choice is saved in this browser and applied at once. */
export function AppearanceCard() {
  return (
    <Card
      title="Appearance"
      description="Applies to every screen. Also in the top bar."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          Colour theme
          <span className="block text-muted">Saved in this browser only.</span>
        </p>
        <ThemeToggle />
      </div>
    </Card>
  );
}
