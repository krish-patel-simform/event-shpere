import { Plus } from "lucide-react";
import Link from "next/link";
import { buttonStyles } from "@/src/core/ui";
import { formatCount } from "@/src/core/format/format-number";
import type { OrganizerHomeData } from "../../types/organizer-home";
import { ORGANIZER_HOME_SAMPLE } from "../../utils/organizer-home.sample";
import { KpiCard } from "../KpiCard";
import { KpiTextCard } from "../KpiTextCard";
import { DailyRegistrationsChart } from "./DailyRegistrationsChart";
import { NeedsAttentionCard } from "./NeedsAttentionCard";
import { OrganizerEventsCard } from "./OrganizerEventsCard";
import { PublishReadinessCard } from "./PublishReadinessCard";

/**
 * An approved organizer's dashboard home: numbers across their events, registrations per day,
 * the draft closest to launch, their events and what needs attention.
 */
export function OrganizerHome({
  data = ORGANIZER_HOME_SAMPLE,
}: {
  data?: OrganizerHomeData;
}) {
  const { kpis } = data;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Organizer dashboard</h1>
          <p className="mt-1 text-muted">
            Events, registrations and what needs your attention today.
          </p>
        </div>
        <Link
          href="/events/new"
          className={buttonStyles({ variant: "primary" })}
        >
          <Plus aria-hidden="true" className="size-4" />
          Create event
        </Link>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-4">
        <KpiCard
          label="Published events"
          value={kpis.publishedEvents}
          trend={{
            text: `${formatCount(kpis.draftEvents)} draft · ${formatCount(kpis.completedEvents)} completed`,
            tone: "neutral",
          }}
        />
        <KpiCard
          label="Event registrations"
          value={kpis.registrations}
          trend={{
            text: `▲ ${formatCount(kpis.registrationsThisWeek)} this week`,
            tone: kpis.registrationsThisWeek > 0 ? "up" : "neutral",
          }}
        />
        <KpiTextCard
          label="Seats filled"
          value={`${kpis.seatsFilledPct}%`}
          hint={{ text: "Across published events", tone: "neutral" }}
        />
        <KpiTextCard
          label="Avg. session rating"
          value={
            kpis.averageSessionRating === null
              ? "–"
              : kpis.averageSessionRating.toFixed(1)
          }
          suffix={kpis.averageSessionRating === null ? undefined : "/ 5"}
          hint={{
            text:
              kpis.averageSessionRating === null
                ? "No ratings yet"
                : "Last completed event",
            tone: "neutral",
          }}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <DailyRegistrationsChart data={data.dailyRegistrations} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <PublishReadinessCard readiness={data.readiness} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <OrganizerEventsCard events={data.events} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <NeedsAttentionCard items={data.attention} />
        </div>
      </div>
    </div>
  );
}
