"use client";

import { Plus, Search } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { formatCount } from "@/src/core/format/format-number";
import { Alert, Button, TablePagination } from "@/src/core/ui";
import { useHasPermission } from "@/src/features/auth";
import { useCreateSpeaker } from "../hooks/useCreateSpeaker";
import { useGetSpeakerList } from "../hooks/useGetSpeakerList";
import type { CreateSpeakerResponseDto } from "../schemas/speaker.schemas";
import { CreateSpeakerDialog } from "./CreateSpeakerDialog";
import { SpeakerCard } from "./SpeakerCard";

const PAGE_SIZE = 12;

/**
 * The speakers everyone can browse (GET /api/speakers): cards A–Z, searched by name and paged by
 * the server. Anyone allowed to add speakers (SPEAKER_CREATE) also sees the Add speaker button;
 * the API checks that permission again.
 */
export function SpeakerDirectory() {
  const canAddSpeaker = useHasPermission("SPEAKER_CREATE");

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

  // Leaving the page hides it (React <Activity>) instead of unmounting it, so an open dialog
  // would still be open when the visitor comes back. Close it as the page is hidden.
  useLayoutEffect(() => () => setIsAdding(false), []);

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

      {/* Searches when the visitor presses Search or Enter, not on every key. */}
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setTerm(search.trim());
          // A new search starts again from the first page.
          setPage(1);
        }}
        className="flex max-w-xl gap-2.5"
      >
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            aria-label="Search speakers"
            placeholder="Search by name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-md border border-field bg-surface py-2 pl-9 pr-3 text-sm placeholder:text-muted/70"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      {speakers.isPending ? (
        <div
          role="status"
          aria-label="Loading speakers"
          className="grid animate-pulse grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-5 motion-reduce:animate-none"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-48 rounded-lg bg-surface-subtle" />
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
        <p className="rounded-lg border border-line bg-surface px-5 py-10 text-center text-muted">
          {term ? "No speakers match your search." : "No speakers yet."}
        </p>
      ) : (
        <>
          <h2 className="text-lg font-semibold">
            {term
              ? `${formatCount(total)} ${total === 1 ? "speaker matches" : "speakers match"} “${term}”`
              : `${formatCount(total)} ${total === 1 ? "speaker" : "speakers"}`}
          </h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-5">
            {items.map((speaker) => (
              <SpeakerCard key={speaker.slug} speaker={speaker} />
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
