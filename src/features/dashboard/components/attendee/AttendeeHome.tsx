import { ATTENDEE_HOME_SAMPLE } from "../../utils/attendee-home.sample";
import type { AttendeeHomeData } from "../../types/attendee-home";
import { HOME_SAMPLE_NOW } from "../../utils/home-sample-now";
import { formatWeekdayRange, plural } from "../../utils/home-format";
import { HomeHero } from "../HomeHero";
import { KpiCard } from "../KpiCard";
import { NotificationsCard } from "../NotificationsCard";
import { BecomeOrganizerCard } from "./BecomeOrganizerCard";
import { MyEventsCard } from "./MyEventsCard";
import { MyScheduleCard } from "./MyScheduleCard";
import { RateSessionCard } from "./RateSessionCard";

function AttendeeHero({ data, now }: { data: AttendeeHomeData; now: string }) {
  const { firstName, nextEvent } = data;

  if (!nextEvent) {
    return (
      <HomeHero
        eyebrow="Your next event"
        heading={`Hi ${firstName}, find your next event`}
        summary="You have no upcoming events yet."
        actions={[{ label: "Browse events", href: "/events", style: "solid" }]}
      />
    );
  }

  return (
    <HomeHero
      eyebrow="Your next event"
      heading={`Hi ${firstName}, ${nextEvent.title} is coming up`}
      summary={
        <>
          {formatWeekdayRange(nextEvent.startsAt, nextEvent.endsAt)} ·{" "}
          {nextEvent.venue}, {nextEvent.city} ·{" "}
          <strong className="text-panel-foreground">
            {plural(nextEvent.sessionsBooked, "session")} booked
          </strong>
        </>
      }
      actions={[
        {
          label: "View event",
          href: `/events/${nextEvent.slug}`,
          style: "solid",
        },
        { label: "My schedule", href: "/my-schedule", style: "outline" },
        { label: "Browse more events", href: "/events", style: "outline" },
      ]}
      countdown={{
        startsAt: nextEvent.startsAt,
        now,
        label: "until your next event",
      }}
    />
  );
}

/**
 * The attendee's dashboard home: next event, a few numbers, registered events, today's
 * schedule, a session to rate and the latest notifications.
 */
export function AttendeeHome({
  data = ATTENDEE_HOME_SAMPLE,
  now = HOME_SAMPLE_NOW,
}: {
  data?: AttendeeHomeData;
  /** ISO date-time "now", for the countdown and relative times (tests pass a fixed one). */
  now?: string;
}) {
  const { stats } = data;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <AttendeeHero data={data} now={now} />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-4">
        <KpiCard label="Upcoming events" value={stats.upcomingEvents} />
        <KpiCard label="Sessions booked" value={stats.sessionsBooked} />
        <KpiCard label="Sessions to rate" value={stats.sessionsToRate} />
        <KpiCard label="Polls voted" value={stats.pollsVoted} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          <MyEventsCard events={data.events} />
          <MyScheduleCard schedule={data.schedule} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <RateSessionCard prompt={data.ratingPrompt} />
          <NotificationsCard
            title="Notifications"
            notifications={data.notifications}
            now={now}
            seeAllHref="/notifications"
          />
          <BecomeOrganizerCard />
        </div>
      </div>
    </div>
  );
}
