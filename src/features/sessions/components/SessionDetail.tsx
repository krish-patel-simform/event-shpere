"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  Alert,
  Breadcrumb,
  Button,
  buttonStyles,
  type BreadcrumbItem,
} from "@/src/core/ui";
import { SESSION_ROUTES } from "../routes";
import type { SessionItem } from "../types/session";
import { SAMPLE_SESSIONS } from "../utils/sessions.sample";
import { SampleDataNotice } from "./SampleDataNotice";
import {
  AboutCard,
  CoSpeakersCard,
  LogisticsCard,
  MaterialsCard,
  RegistrationsCard,
  SessionHeaderCard,
} from "./SessionDetailCards";
import { SessionDetailSkeleton } from "./SessionDetailSkeleton";

const LIST_CRUMB: BreadcrumbItem = {
  label: "My sessions",
  href: SESSION_ROUTES.list,
};

type SessionDetailProps = {
  /** From the URL. Whether it is a real session is decided by the (future) API. */
  sessionId: string;
  /** The speaker's sessions to look the id up in. Sample data until the API exists. */
  sessions?: readonly SessionItem[];
  state?: "ready" | "loading" | "error";
  /** The "Try again" button of the error state appears when this is given. */
  onRetry?: () => void;
};

/**
 * One session of the speaker: status and schedule, the abstract, files, co-speakers, seats and
 * logistics. Runs on sample data: an id that is not in `sessions` shows "Session not found".
 */
export function SessionDetail({
  sessionId,
  sessions = SAMPLE_SESSIONS,
  state = "ready",
  onRetry,
}: SessionDetailProps) {
  if (state === "loading") return <SessionDetailSkeleton />;

  if (state === "error") {
    return (
      <PageFrame crumb="Session">
        <Alert tone="error" title="We couldn't load this session">
          Check your connection and try again.
          {onRetry && (
            <Button variant="secondary" onClick={onRetry} className="mt-3">
              Try again
            </Button>
          )}
        </Alert>
      </PageFrame>
    );
  }

  const session = sessions.find((item) => item.id === sessionId);
  if (!session) {
    return (
      <PageFrame crumb="Session not found">
        <Alert tone="warning" title="Session not found">
          This session does not exist, or it is not one of yours.
          <Link
            href={SESSION_ROUTES.list}
            className={buttonStyles({ variant: "secondary" }) + " mt-3"}
          >
            Back to my sessions
          </Link>
        </Alert>
      </PageFrame>
    );
  }

  return (
    <PageFrame crumb={session.title}>
      <SessionHeaderCard session={session} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0 space-y-5">
          <AboutCard session={session} />
          <MaterialsCard session={session} />
          <CoSpeakersCard session={session} />
        </div>
        <div className="min-w-0 space-y-5">
          <RegistrationsCard session={session} />
          <LogisticsCard session={session} />
        </div>
      </div>
    </PageFrame>
  );
}

/** The breadcrumb and the sample-data note, shared by the error, not-found and loaded views. */
function PageFrame({
  crumb,
  children,
}: {
  crumb: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Breadcrumb items={[LIST_CRUMB, { label: crumb }]} />
      <SampleDataNotice>
        This session is an example. Nothing is loaded from the server yet.
      </SampleDataNotice>
      {children}
    </div>
  );
}
