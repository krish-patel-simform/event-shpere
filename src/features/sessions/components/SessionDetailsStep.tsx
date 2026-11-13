"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { Alert, Button, buttonStyles, Card } from "@/src/core/ui";
import { useReplaceSessionSpeakers } from "../hooks/useReplaceSessionSpeakers";
import { useUpdateSession } from "../hooks/useUpdateSession";
import {
  createSessionFormSchema,
  sessionToFormValues,
  toUpdateSessionRequest,
  type CreateSessionFormValues,
} from "../schemas/session-form.schemas";
import type { SessionDto } from "../schemas/sessions.schemas";
import { sessionDay, sessionTimes } from "../utils/organizer-session-display";
import {
  SessionDetailsFields,
  type SessionEventInfo,
} from "./SessionDetailsFields";
import { SpeakerPicker, type SpeakerChoice } from "./SpeakerPicker";

/** Whether two speaker lists are the same people, in the same roles and order. */
function sameSpeakers(
  a: readonly SpeakerChoice[],
  b: readonly SpeakerChoice[],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (speaker, index) =>
        speaker.speakerId === b[index]?.speakerId &&
        speaker.role === b[index]?.role,
    )
  );
}

/**
 * Step 1: the details of a saved session: title, type, how it is attended, hall or link, date and
 * times, registration and price, and who presents it. Saving calls PATCH .../sessions/[id], which
 * is also how a session is moved: the server checks the hall (of this event's venue, active, free),
 * the dates (inside the event) and the speakers (free at the new time) again, and says which rule
 * failed. When the speakers changed, the whole list is then sent (PUT .../speakers): whoever is not
 * in it is removed, with the same rules as when adding a session (at least one, not only
 * moderators, no repeats).
 */
export function SessionDetailsStep({
  event,
  session,
  cancelHref,
  onSaved,
}: {
  event: SessionEventInfo;
  session: SessionDto;
  /** Where "Cancel" goes: the event's sessions. */
  cancelHref: string;
  /** Called after the details were saved. */
  onSaved: () => void;
}) {
  const update = useUpdateSession(event.id, session.id);
  const replaceSpeakers = useReplaceSessionSpeakers(event.id, session.id);
  // What the saved session holds now, said plainly: "You have booked Hall A, Thu 12 Dec 2026,
  // 10:00 – 11:00 IST". A cancelled session holds nothing, but one cannot be edited here.
  const day = sessionDay(session, event.timezone);
  const times = sessionTimes(session, event.timezone);
  const booking = session.hallName
    ? {
        hall: session.hallName,
        when: day && times ? `${day}, ${times}` : null,
      }
    : null;
  // The speakers as the picker holds them: in the order they are shown.
  const savedSpeakers = useMemo<SpeakerChoice[]>(
    () =>
      [...session.speakers]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(({ speakerId, role }) => ({ speakerId, role })),
    [session.speakers],
  );
  const knownNames = useMemo(
    () =>
      Object.fromEntries(
        session.speakers.map((speaker) => [speaker.speakerId, speaker.name]),
      ),
    [session.speakers],
  );
  const defaults = useMemo<CreateSessionFormValues>(
    () => ({
      ...sessionToFormValues(session, event.timezone),
      speakers: savedSpeakers,
    }),
    [session, event.timezone, savedSpeakers],
  );
  const form = useForm<CreateSessionFormValues>({
    resolver: zodResolver(createSessionFormSchema),
    defaultValues: defaults,
  });
  const {
    control,
    formState: { errors },
  } = form;

  // After a failed save, move keyboard focus to the message.
  const errorBox = useRef<HTMLDivElement>(null);
  const failure = update.error ?? replaceSpeakers.error;
  useEffect(() => {
    if (failure) errorBox.current?.focus();
  }, [failure]);

  const isPending = update.isPending || replaceSpeakers.isPending;

  // The details go first (PATCH), then the speakers (PUT) when they changed, so the speakers are
  // checked against the time the session has now. If the details save but the speakers do not, the
  // message says so and the form stays open.
  async function save({ speakers, ...details }: CreateSessionFormValues) {
    update.reset();
    replaceSpeakers.reset();
    try {
      await update.mutateAsync(toUpdateSessionRequest(details));
      if (!sameSpeakers(speakers, savedSpeakers)) {
        await replaceSpeakers.mutateAsync({ speakers });
      }
    } catch {
      // The failed request's message is shown by the alert above.
      return;
    }
    onSaved();
  }

  return (
    <FormProvider {...form}>
      <form
        noValidate
        className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]"
        onSubmit={form.handleSubmit(save)}
      >
        <div className="min-w-0 space-y-5">
          {update.error && (
            <Alert
              ref={errorBox}
              tone="error"
              title="We couldn't save this session"
            >
              {update.error.message}
            </Alert>
          )}
          {replaceSpeakers.error && (
            <Alert
              ref={errorBox}
              tone="error"
              title="The details were saved, but we couldn't save the speakers"
            >
              {replaceSpeakers.error.message}
            </Alert>
          )}
          <SessionDetailsFields
            event={event}
            isPending={isPending}
            editing={{ sessionId: session.id, hallId: session.hallId }}
          />
          <Card
            title="Speakers"
            description="Who presents this session. At least one speaker (not only moderators)."
          >
            <Controller
              control={control}
              name="speakers"
              render={({ field }) => (
                <SpeakerPicker
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isPending}
                  error={
                    errors.speakers?.message ?? errors.speakers?.root?.message
                  }
                  knownNames={knownNames}
                />
              )}
            />
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4">
          <Card title="Booking">
            <div className="space-y-3">
              <p>
                {booking ? (
                  <>
                    <strong>You have booked {booking.hall}</strong>
                    {booking.when && (
                      <span className="block text-muted">{booking.when}</span>
                    )}
                  </>
                ) : (
                  <span className="text-muted">
                    This session has no hall booked
                    {session.mode === "online" ? " (it is online)." : "."}
                  </span>
                )}
              </p>
              <p className="text-muted">
                Change the date, time or hall to move it. We check the hall is
                free, the time is inside the event and its speakers are free.
              </p>
            </div>
          </Card>
          <div className="space-y-2.5 rounded-lg border border-line bg-surface p-4">
            <Button type="submit" fullWidth isPending={isPending}>
              {isPending ? "Saving…" : "Save & continue"}
            </Button>
            <Link
              href={cancelHref}
              className={buttonStyles({
                variant: "secondary",
                fullWidth: true,
              })}
            >
              Cancel
            </Link>
          </div>
        </aside>
      </form>
    </FormProvider>
  );
}
