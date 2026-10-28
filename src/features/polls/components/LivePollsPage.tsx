"use client";

import { useId, useState } from "react";
import { formatDate } from "@/src/core/format/format-date";
import { formatCount } from "@/src/core/format/format-number";
import { Alert } from "@/src/core/ui";
import type {
  AudienceQuestion,
  Poll,
  PollSession,
  QuestionSort,
} from "../types/poll.types";
import type { PollFormValues } from "../schemas/poll-form.schema";
import {
  changePollStatus,
  createPoll,
  setQuestionAnswered,
  setShowResultsToAudience,
} from "../utils/poll-state";
import { formatClock } from "../utils/poll-time";
import {
  POLLS_SAMPLE,
  POLLS_SAMPLE_NOW,
  POLL_SESSIONS_SAMPLE,
  QUESTIONS_SAMPLE,
} from "../utils/polls.sample";
import { AudienceQuestions } from "./AudienceQuestions";
import {
  LivePollsError,
  LivePollsSkeleton,
  NoPollSessions,
} from "./LivePollsStates";
import { PollCreateForm } from "./PollCreateForm";
import { PollList } from "./PollList";
import { PollResults } from "./PollResults";

type LivePollsPageProps = {
  sessions?: PollSession[];
  polls?: Poll[];
  questions?: AudienceQuestion[];
  /** The current time (ISO). A fixed default keeps the page and its tests deterministic. */
  now?: string;
  isLoading?: boolean;
  /** Why loading failed; shows the error state. */
  error?: string;
  onRetry?: () => void;
};

/**
 * "Live polls & Q&A" for a speaker: pick one of their sessions, see its polls and the live
 * results, launch or close a poll, create a new one, and go through the audience questions.
 * UI only: it runs on sample data and keeps every change in local state (nothing is sent).
 */
export function LivePollsPage({
  sessions = POLL_SESSIONS_SAMPLE,
  polls: initialPolls = POLLS_SAMPLE,
  questions: initialQuestions = QUESTIONS_SAMPLE,
  now = POLLS_SAMPLE_NOW,
  isLoading = false,
  error,
  onRetry,
}: LivePollsPageProps) {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Live polls &amp; Q&amp;A</h1>
        <p className="text-muted">
          Run polls and take audience questions during your session.
        </p>
      </div>
      {isLoading ? (
        <LivePollsSkeleton />
      ) : error ? (
        <LivePollsError message={error} onRetry={onRetry} />
      ) : sessions.length === 0 ? (
        <NoPollSessions />
      ) : (
        <LivePollsWorkspace
          sessions={sessions}
          initialPolls={initialPolls}
          initialQuestions={initialQuestions}
          now={now}
        />
      )}
    </div>
  );
}

function LivePollsWorkspace({
  sessions,
  initialPolls,
  initialQuestions,
  now,
}: {
  sessions: PollSession[];
  initialPolls: Poll[];
  initialQuestions: AudienceQuestion[];
  now: string;
}) {
  const sessionSelectId = useId();
  const [sessionId, setSessionId] = useState(sessions[0].id);
  const [polls, setPolls] = useState(initialPolls);
  const [questions, setQuestions] = useState(initialQuestions);
  const [selectedPollId, setSelectedPollId] = useState<string>();
  const [sort, setSort] = useState<QuestionSort>("top");

  const session = sessions.find((s) => s.id === sessionId) ?? sessions[0];
  const sessionPolls = polls.filter((poll) => poll.sessionId === session.id);
  const sessionQuestions = questions.filter(
    (question) => question.sessionId === session.id,
  );
  // The first poll shows until the speaker picks one (and when the picked one is in another session).
  const selectedPoll =
    sessionPolls.find((poll) => poll.id === selectedPollId) ?? sessionPolls[0];

  const addPoll = (values: PollFormValues, status: "draft" | "live") => {
    const poll = createPoll(
      {
        question: values.question,
        kind: values.kind,
        options: values.options.map((option) => option.value),
      },
      {
        id: `local-poll-${polls.length + 1}`,
        sessionId: session.id,
        status,
        now,
      },
    );
    setPolls([...polls, poll]);
    setSelectedPollId(poll.id);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={sessionSelectId} className="text-sm font-semibold">
          Session
        </label>
        <select
          id={sessionSelectId}
          value={session.id}
          onChange={(event) => {
            setSessionId(event.target.value);
            setSelectedPollId(undefined);
          }}
          className="min-w-0 max-w-full rounded-md border border-field bg-surface px-3 py-2 text-sm"
        >
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} · {formatDate(s.startsAt, "long")}
            </option>
          ))}
        </select>
      </div>

      {session.live ? (
        <Alert tone="success" title="Session is live">
          Started {formatClock(session.live.startedAt)} ·{" "}
          {formatCount(session.live.attendeesConnected)} attendees connected
        </Alert>
      ) : (
        <Alert tone="info" title="Session is not live">
          It starts {formatDate(session.startsAt, "long")} (UTC). Draft your
          polls now and launch them once it begins.
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
        <PollList
          polls={sessionPolls}
          selectedId={selectedPoll?.id}
          onSelect={setSelectedPollId}
        />
        {selectedPoll && (
          <PollResults
            poll={selectedPoll}
            attendeesConnected={session.live?.attendeesConnected ?? null}
            now={now}
            onChangeStatus={(status) =>
              setPolls(changePollStatus(polls, selectedPoll.id, status, now))
            }
            onToggleShowResults={(show) =>
              setPolls(setShowResultsToAudience(polls, selectedPoll.id, show))
            }
          />
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <PollCreateForm onCreate={addPoll} />
        <AudienceQuestions
          questions={sessionQuestions}
          sort={sort}
          now={now}
          onSortChange={setSort}
          onSetAnswered={(id, answered) =>
            setQuestions(setQuestionAnswered(questions, id, answered))
          }
        />
      </div>
    </>
  );
}
