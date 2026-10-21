import { CalendarDays, ChartColumn, Columns3, Users, type LucideIcon } from "lucide-react";

// Static copy for the illustration; it describes what organizer accounts can do.
const BENEFITS: readonly { icon: LucideIcon; title: string; text: string }[] = [
  { icon: CalendarDays, title: "Create and publish events", text: "Dates, venue, capacity and ticket price." },
  { icon: Columns3, title: "Build the schedule", text: "Set up halls and drag sessions into time slots." },
  { icon: Users, title: "Manage speakers and attendees", text: "Assign speakers, view registrations, send updates." },
  { icon: ChartColumn, title: "Run live polls and see analytics", text: "Results update in real time during sessions." },
];

/** Set-password screen illustration: what an organizer can do once the account is active. */
export function InviteBenefits() {
  return (
    <section aria-labelledby="invite-benefits-title" className="space-y-4">
      <h3
        id="invite-benefits-title"
        className="text-xs font-semibold uppercase tracking-wider text-panel-muted"
      >
        What you&apos;ll be able to do
      </h3>
      <ul className="space-y-4">
        {BENEFITS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-panel-line bg-panel-card">
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-sm text-panel-muted">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
