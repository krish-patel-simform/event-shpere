"use client";

import { Mic, Plus, Search, SearchX, X } from "lucide-react";
import { useId, useLayoutEffect, useState } from "react";
import { formatCount } from "@/src/core/format/format-number";
import { Alert, Button, TablePagination } from "@/src/core/ui";
import { useHasPermission } from "@/src/features/auth";
import { useCreateSpeaker } from "../hooks/useCreateSpeaker";
import { useGetSpeakerList } from "../hooks/useGetSpeakerList";
import { useResendSpeakerInvite } from "../hooks/useResendSpeakerInvite";
import type {
  CreateSpeakerResponseDto,
  SpeakerListItemDto,
} from "../schemas/speaker.schemas";
import { speakerFullName } from "../utils/speaker-display";
import { CreateSpeakerDialog } from "./CreateSpeakerDialog";
import { InviteNotice, type InviteResult } from "./InviteNotice";
import { SpeakerCard } from "./SpeakerCard";

const PAGE_SIZE = 12;

/**
 * The speakers everyone can browse (GET /api/speakers): cards A–Z, searched by name and paged by
 * the server. Anyone allowed to add speakers (SPEAKER_CREATE) also sees the Add speaker button;
 * the API checks that permission again.
 */
export function SpeakerDirectory() {
  const canAddSpeaker = useHasPermission("SPEAKER_CREATE");
  const searchId = useId();

  // What is typed in the box, and what was last searched for (the one the list is loaded with).
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  // The speaker added last: the message under the title says what happens next.
  const [added, setAdded] = useState<CreateSpeakerResponseDto | null>(null);

  const speakers = useGetSpeakerList({
    search: term,
    page,
    pageSize: PAGE_SIZE,
  });
  const create = useCreateSpeaker();
  // Only the admin resends invites. The API checks this permission again; it also answers 409
  // for a speaker who already set a password (the list does not say who has not).
  const canResendInvite = useHasPermission("SPEAKER_MANAGE_ALL");
  const resendInvite = useResendSpeakerInvite();
  // The invite sent last: the message under the title says who got it.
  const [invited, setInvited] = useState<InviteResult | null>(null);

  // Leaving the page hides it (React <Activity>) instead of unmounting it, so an open dialog
  // would still be open when the visitor comes back. Close it as the page is hidden.
  useLayoutEffect(() => () => setIsAdding(false), []);

  const sendInvite = (speaker: SpeakerListItemDto) => {
    setInvited(null);
    resendInvite.reset();
    resendInvite.mutate(speaker.slug, {
      onSuccess: (result) =>
        setInvited({
          name: speakerFullName(speaker),
          setupEmailQueued: result.setupEmailQueued,
        }),
    });
  };

  const clearSearch = () => {
    setSearch("");
    setTerm("");
    setPage(1);
  };

  const openAdd = () => {
    setAdded(null);
    setIsAdding(true);
  };
  const closeAdd = () => {
    create.reset();
    setIsAdding(false);
  };

  const items = speakers.data?.items ?? [];
  const total = speakers.data?.meta.total ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Speakers</h1>
          <p className="text-muted">Find a speaker and read their profile.</p>
        </div>
        {canAddSpeaker && (
          <Button onClick={openAdd}>
            <Plus aria-hidden="true" className="size-4" />
            Add speaker
          </Button>
        )}
      </header>

      {added &&
        (added.setupEmailQueued ? (
          <Alert
            tone="success"
            title={`${added.firstName} ${added.lastName} was added`}
          >
            We emailed {added.email} a link to set a password.
          </Alert>
        ) : (
          <Alert
            tone="warning"
            title={`${added.firstName} ${added.lastName} was added, but the email was not sent`}
          >
            The account exists, but we couldn&apos;t queue the email to{" "}
            {added.email}. The setup link still has to be sent.
          </Alert>
        ))}

      <InviteNotice result={invited} error={resendInvite.error} />

      {/* Searches when the visitor presses Search or Enter, not on every key. */}
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setTerm(search.trim());
          // A new search starts again from the first page.
          setPage(1);
        }}
        className="rounded-lg border border-line bg-surface p-4 sm:p-5"
      >
        <label htmlFor={searchId} className="text-sm font-semibold">
          Find a speaker
        </label>
        <div className="mt-2 flex flex-wrap gap-2.5">
          <div className="relative min-w-60 flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted"
            />
            <input
              id={searchId}
              type="search"
              aria-label="Search speakers"
              placeholder="Search by name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-md border border-field bg-surface py-2.5 pl-11 pr-3 placeholder:text-muted/70"
            />
          </div>
          <Button type="submit" className="px-6">
            Search
          </Button>
          {(term !== "" || search !== "") && (
            <Button variant="secondary" onClick={clearSearch}>
              <X aria-hidden="true" className="size-4" />
              Clear
            </Button>
          )}
        </div>
        <p className="mt-2 text-sm text-muted">
          Searches first and last names. Press Enter or Search.
        </p>
      </form>

      {speakers.isPending ? (
        <div
          role="status"
          aria-label="Loading speakers"
          className="grid animate-pulse grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-5 motion-reduce:animate-none"
        >
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className="flex flex-col items-center gap-2 rounded-lg border border-line bg-surface p-5"
            >
              <div className="size-18 rounded-full bg-surface-subtle" />
              <div className="mt-2 h-5 w-32 rounded bg-surface-subtle" />
              <div className="h-4 w-40 rounded bg-surface-subtle" />
              <div className="mt-2 flex gap-1.5">
                <div className="h-5 w-14 rounded bg-surface-subtle" />
                <div className="h-5 w-16 rounded bg-surface-subtle" />
              </div>
            </div>
          ))}
        </div>
      ) : speakers.isError ? (
        <Alert tone="error" title="We couldn't load the speakers">
          {speakers.error.message}
          <Button
            variant="secondary"
            onClick={() => void speakers.refetch()}
            className="mt-3"
          >
            Try again
          </Button>
        </Alert>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line bg-surface px-5 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-surface-subtle text-muted">
            {term ? (
              <SearchX aria-hidden="true" className="size-6" />
            ) : (
              <Mic aria-hidden="true" className="size-6" />
            )}
          </span>
          <p className="text-base font-semibold">
            {term ? "No speakers match your search." : "No speakers yet."}
          </p>
          <p className="max-w-sm text-sm text-muted">
            {term
              ? `Nobody has “${term}” in their name. Check the spelling or try a shorter name.`
              : "Speakers show up here once they are added."}
          </p>
          {term && (
            <Button variant="secondary" onClick={clearSearch} className="mt-2">
              Clear search
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {term
                ? `${formatCount(total)} ${total === 1 ? "speaker matches" : "speakers match"} “${term}”`
                : `${formatCount(total)} ${total === 1 ? "speaker" : "speakers"}`}
            </h2>
            <p className="text-sm text-muted">Sorted by name, A–Z</p>
          </div>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-5">
            {items.map((speaker) => (
              <SpeakerCard
                key={speaker.slug}
                speaker={speaker}
                onResendInvite={
                  canResendInvite ? () => sendInvite(speaker) : undefined
                }
                isResendingInvite={
                  resendInvite.isPending &&
                  resendInvite.variables === speaker.slug
                }
              />
            ))}
          </ul>
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            <TablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              itemCount={items.length}
              onPageChange={setPage}
            />
          </div>
        </>
      )}

      <CreateSpeakerDialog
        open={isAdding}
        onClose={closeAdd}
        isPending={create.isPending}
        error={create.error}
        onSubmit={(body) =>
          create.mutate(body, {
            onSuccess: (speaker) => {
              setAdded(speaker);
              closeAdd();
            },
          })
        }
      />
    </div>
  );
}
