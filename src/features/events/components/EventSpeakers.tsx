"use client";

import { CalendarPlus } from "lucide-react";
import { useState } from "react";
import {
  ActionMenu,
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  SourceBadge,
  TablePagination,
  TextField,
  type ActionMenuItem,
} from "@/src/core/ui";
import { SAMPLE_SESSIONS, SAMPLE_SPEAKERS } from "../sample/organizer-sample";
import { eventSessionNewHref } from "../routes";
import type { EventOverviewData } from "../types/event-manage.types";
import { plural } from "../utils/event-display";
import {
  incompleteProfiles,
  PROFILE_STATUS_META,
  searchSpeakers,
  speakerRows,
  type SpeakerRow,
} from "../utils/event-speakers";
import { EventLoader } from "./EventLoader";
import { EventPageHeader } from "./EventPageHeader";
import { SearchBox } from "./SearchBox";
import { StaticDataNotice } from "./StaticDataNotice";

const PAGE_SIZE = 5;
const TH = "px-4 py-2.5 font-semibold";

const ROWS = speakerRows(SAMPLE_SPEAKERS, SAMPLE_SESSIONS);

function SpeakersTable({
  rows,
  eventId,
}: {
  rows: readonly SpeakerRow[];
  eventId: string;
}) {
  function rowActions(): ActionMenuItem[] {
    return [
      {
        label: "Assign to a session",
        icon: CalendarPlus,
        href: eventSessionNewHref(eventId),
      },
    ];
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Speakers of this event</caption>
        <thead className="bg-surface-subtle text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th scope="col" className={TH}>
              Speaker
            </th>
            <th scope="col" className={TH}>
              Sessions
            </th>
            <th scope="col" className={TH}>
              Profile content
            </th>
            <th scope="col" className={TH}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const status = PROFILE_STATUS_META[row.profile];
            return (
              <tr key={row.id} className="border-t border-line align-middle">
                <td className="min-w-56 px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={row.name} />
                    <div>
                      <p className="font-semibold">{row.name}</p>
                      <p className="text-muted">{row.headline}</p>
                    </div>
                  </div>
                </td>
                <td className="min-w-56 px-4 py-3">
                  {row.sessionTitles.length === 0 ? (
                    <span className="text-muted">
                      Not assigned to a session
                    </span>
                  ) : (
                    <>
                      <strong>{row.sessionTitles.length}</strong>
                      <span className="text-muted">
                        {" · "}
                        {row.sessionTitles.join("; ")}
                      </span>
                    </>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={status.tone}>{status.label}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <ActionMenu
                    label={`Actions for ${row.name}`}
                    items={rowActions()}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AddSpeakerCards() {
  return (
    <div className="space-y-5">
      <Card title="Add existing speaker">
        <div className="space-y-2">
          <TextField
            label="Find a speaker by name"
            placeholder="Find a speaker by name"
            disabled
            hint="Search speakers already on EventSphere. Name only."
          />
        </div>
      </Card>
      <Card title="Create a new speaker">
        <div className="space-y-4">
          <TextField
            label="Full name"
            placeholder="e.g. Neha Kapoor"
            disabled
          />
          <TextField
            label="Email address"
            type="email"
            placeholder="name@company.com"
            disabled
            hint="Used for contact only. No account is created."
          />
          <Button disabled>Add speaker</Button>
          <Alert tone="info">
            Photo, bio, company, job title and social links are written in the
            content editor after you add the speaker.
          </Alert>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <SourceBadge source="static" />
            Adding speakers to an event is not built yet.
          </p>
        </div>
      </Card>
    </div>
  );
}

/**
 * The organizer's Speakers tab of one event: who presents, in which sessions, whether their
 * public profile is complete, and the forms to add one. The event's header is real; the rows are
 * sample data (Static) and the add forms are switched off until the speakers API is wired.
 */
export function EventSpeakers({ eventId }: { eventId: string }) {
  return (
    <EventLoader eventId={eventId}>
      {(overview) => <SpeakersPage overview={overview} />}
    </EventLoader>
  );
}

function SpeakersPage({ overview }: { overview: EventOverviewData }) {
  const { event } = overview;
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const matches = searchSpeakers(ROWS, search);
  const visible = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const incomplete = incompleteProfiles(ROWS);

  function changeSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <EventPageHeader overview={overview} current="speakers" />

      <StaticDataNotice>
        These speakers are examples. Nothing is loaded from the server yet.
      </StaticDataNotice>

      {incomplete > 0 && (
        <Alert
          tone="warning"
          title={`${plural(incomplete, "speaker")} ${incomplete === 1 ? "has an incomplete profile" : "have incomplete profiles"}.`}
        >
          A placeholder photo is shown on the public page until they are
          updated.
        </Alert>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 flex-[2_1_32rem] space-y-3">
          <div className="flex">
            <SearchBox
              label="Search assigned speakers"
              value={search}
              onChange={changeSearch}
            />
          </div>
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            {matches.length === 0 ? (
              <p className="px-5 py-10 text-center text-muted">
                No speaker matches &ldquo;{search.trim()}&rdquo;.
              </p>
            ) : (
              <>
                <SpeakersTable rows={visible} eventId={event.id} />
                <TablePagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={matches.length}
                  itemCount={visible.length}
                  onPageChange={setPage}
                />
              </>
            )}
          </div>
        </div>
        <div className="min-w-0 flex-[1_1_20rem]">
          <AddSpeakerCards />
        </div>
      </div>
    </div>
  );
}
