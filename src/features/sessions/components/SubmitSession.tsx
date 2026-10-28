import { formatDate } from "@/src/core/format/format-date";
import { Breadcrumb, Card } from "@/src/core/ui";
import { SESSION_ABSTRACT_MAX, SESSION_ABSTRACT_MIN } from "../constants";
import { SESSION_ROUTES } from "../routes";
import { daysUntil } from "../utils/session-display";
import { SAMPLE_NOW, SAMPLE_SUBMISSION_CALL } from "../utils/sessions.sample";
import { SampleDataNotice } from "./SampleDataNotice";
import { SessionSubmissionForm } from "./SessionSubmissionForm";

const REVIEW_STEPS = [
  "Submitted",
  "Programme committee review",
  "Decision and scheduling",
  "Confirmation by you",
] as const;

/**
 * The "Submit a session" page: the form with the call for sessions, the guidelines and the review
 * steps beside it. The call is sample data until events and sessions have an API; `now` (ISO)
 * only drives the "days remaining" line, and defaults to a fixed value so it is stable.
 */
export function SubmitSession({
  call = SAMPLE_SUBMISSION_CALL,
  now = SAMPLE_NOW,
}: {
  call?: typeof SAMPLE_SUBMISSION_CALL;
  now?: string;
}) {
  const remaining = daysUntil(call.closesAt, now);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="space-y-2.5">
        <Breadcrumb
          items={[
            { label: "My sessions", href: SESSION_ROUTES.list },
            { label: "Submit a session" },
          ]}
        />
        <div>
          <h1 className="text-2xl font-semibold">Submit a session</h1>
          <p className="text-muted">
            Propose a talk, workshop or panel for {call.eventName}. Organizers
            review submissions within {call.reviewWorkingDays} working days.
          </p>
        </div>
      </div>

      <SampleDataNotice>
        The call for sessions below is an example, and a submission is not sent
        anywhere yet.
      </SampleDataNotice>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <SessionSubmissionForm />

        <aside aria-label="About this call" className="min-w-0 space-y-4">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Call for sessions closes
            </p>
            <p className="mt-1 text-xl font-semibold">
              {formatDate(call.closesAt, "long").split(",")[0]}
            </p>
            <p className="text-sm text-muted">
              {remaining === 0
                ? "Closes today"
                : `${remaining} ${remaining === 1 ? "day" : "days"} remaining`}
            </p>
          </Card>
          <Card title="Submission guidelines">
            <ul className="list-disc space-y-2 pl-5 text-sm">
              <li>
                Abstracts should be {SESSION_ABSTRACT_MIN}–
                {SESSION_ABSTRACT_MAX.toLocaleString("en-GB")} characters and
                written for attendees.
              </li>
              <li>Avoid product pitches; sessions must be vendor-neutral.</li>
              <li>
                Workshops need a laptop setup guide shared 7 days before the
                event.
              </li>
              <li>You can edit a submission until it moves to review.</li>
            </ul>
          </Card>
          <Card title="Review process">
            <ol className="list-decimal space-y-1.5 pl-5 text-sm">
              {REVIEW_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </Card>
        </aside>
      </div>
    </div>
  );
}
