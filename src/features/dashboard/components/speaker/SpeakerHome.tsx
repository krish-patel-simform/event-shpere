import { formatCount } from "@/src/core/format/format-number";
import type { SpeakerHomeData } from "../../types/speaker-home";
import {
  formatDayMonth,
  formatFullDate,
  formatTime,
  formatWeekdayDayMonth,
} from "../../utils/home-format";
import { HOME_SAMPLE_NOW } from "../../utils/home-sample-now";
import { SPEAKER_HOME_SAMPLE } from "../../utils/speaker-home.sample";
import { HomeHero } from "../HomeHero";
import { KpiCard, type KpiTrend } from "../KpiCard";
import { KpiTextCard } from "../KpiTextCard";
import { NotificationsCard } from "../NotificationsCard";
import { ProgressBar } from "../ProgressBar";
import { FeedbackCard } from "./FeedbackCard";
import { RegistrationsTrendCard } from "./RegistrationsTrendCard";
import { SpeakerSessionsCard } from "./SpeakerSessionsCard";
import { SpeakerTodoCard } from "./SpeakerTodoCard";

function SpeakerHero({ data, now }: { data: SpeakerHomeData; now: string }) {
  const { firstName, nextSession } = data;
  const eyebrow = formatFullDate(now);
  const heading = `Welcome back, ${firstName}`;

  if (!nextSession) {
    return (
      <HomeHero
        eyebrow={eyebrow}
        heading={heading}
        summary="You have no upcoming sessions."
        actions={[
          { label: "My schedule", href: "/my-schedule", style: "solid" },
        ]}
      />
    );
  }

  return (
    <HomeHero
      eyebrow={eyebrow}
      heading={heading}
      summary={
        <>
          Your next session is{" "}
          <strong className="text-panel-foreground">{nextSession.title}</strong>{" "}
          · {formatWeekdayDayMonth(nextSession.startsAt)},{" "}
          {formatTime(nextSession.startsAt)} IST · {nextSession.location}
        </>
      }
      actions={[
        {
          label: "View session",
          href: `/speaker/sessions/${nextSession.id}`,
          style: "solid",
        },
        {
          label: "Prepare polls",
          href: "/speaker/polls",
          style: "outline",
        },
        { label: "My schedule", href: "/my-schedule", style: "outline" },
      ]}
      countdown={{
        startsAt: nextSession.startsAt,
        now,
        label: "until your next session",
      }}
      aside={
        <div className="w-56">
          <p className="mb-1.5 flex justify-between text-xs">
            <span className="text-panel-muted">Seats filled</span>
            <span className="font-semibold">
              {nextSession.seatsFilled} / {nextSession.seatsTotal}
            </span>
          </p>
          <ProgressBar
            onPanel
            value={nextSession.seatsFilled}
            max={nextSession.seatsTotal}
            label={`Seats taken in ${nextSession.title}`}
          />
        </div>
      }
    />
  );
}

function ratingHint(ratingCount: number): KpiTrend {
  return {
    text:
      ratingCount > 0
        ? `${formatCount(ratingCount)} ratings, past events`
        : "No ratings yet",
    tone: "neutral",
  };
}

/**
 * The speaker's dashboard home: next session, a few numbers, registrations across their sessions,
 * their sessions, to-dos, feedback and the latest updates.
 */
export function SpeakerHome({
  data = SPEAKER_HOME_SAMPLE,
  now = HOME_SAMPLE_NOW,
}: {
  data?: SpeakerHomeData;
  /** ISO date-time "now", for the countdown, due dates and relative times. */
  now?: string;
}) {
  const { stats } = data;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <SpeakerHero data={data} now={now} />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-4">
        <KpiCard
          label="Confirmed sessions"
          value={stats.confirmedSessions}
          trend={{
            text: `${formatCount(stats.sessionsUnderReview)} under review`,
            tone: "neutral",
          }}
        />
        <KpiCard
          label="Total registrations"
          value={stats.totalRegistrations}
          trend={{
            text: `▲ ${formatCount(stats.registrationsThisWeek)} this week`,
            tone: stats.registrationsThisWeek > 0 ? "up" : "neutral",
          }}
        />
        <KpiTextCard
          label="Average rating"
          value={
            stats.averageRating === null ? "–" : stats.averageRating.toFixed(1)
          }
          suffix={stats.averageRating === null ? undefined : "/ 5"}
          hint={ratingHint(stats.ratingCount)}
        />
        <KpiCard
          label="Open to-dos"
          value={stats.openTodos}
          trend={
            stats.nextTodoDueAt
              ? {
                  text: `Next due ${formatDayMonth(stats.nextTodoDueAt)}`,
                  tone: "warning",
                }
              : {
                  text: stats.openTodos === 0 ? "All done" : "No due dates",
                  tone: "neutral",
                }
          }
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          <RegistrationsTrendCard trend={data.registrationTrend} />
          <SpeakerSessionsCard sessions={data.sessions} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <SpeakerTodoCard todos={data.todos} now={now} />
          <FeedbackCard feedback={data.feedback} />
          <NotificationsCard
            title="Recent updates"
            notifications={data.notifications}
            now={now}
            seeAllHref="/notifications"
          />
        </div>
      </div>
    </div>
  );
}
