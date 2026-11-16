"use client";

import { X } from "lucide-react";
import { useMemo } from "react";
import {
  Alert,
  Button,
  SearchableSelect,
  type SelectOption,
} from "@/src/core/ui";
import { speakerFullName, useGetSpeakerList } from "../../speakers";
import type { CreateSessionRequest } from "../schemas/sessions.schemas";
import { SESSION_SPEAKER_ROLE_LABELS } from "../utils/organizer-session-display";
import { SelectField } from "./SelectField";

/** The most speakers one page of the list holds (the API's own limit). */
const PAGE_SIZE = 50;

export type SpeakerChoice = CreateSessionRequest["speakers"][number];

/**
 * Chooses who presents a session, from the speakers everyone can browse (GET /api/speakers): add
 * one at a time, give each a role, remove them. The order of the list is the order they are shown
 * in. The list is searched here in the browser, so it loads the first page of the API's biggest
 * size and says so when there are more speakers than that.
 */
export function SpeakerPicker({
  value,
  onChange,
  error,
  disabled = false,
  knownNames = {},
}: {
  value: readonly SpeakerChoice[];
  onChange: (speakers: SpeakerChoice[]) => void;
  /** Why the list is not valid, from the form's schema. */
  error?: string;
  disabled?: boolean;
  /** Names of speakers already on the session, for ones the loaded page does not hold. */
  knownNames?: Readonly<Record<string, string>>;
}) {
  const speakers = useGetSpeakerList({ pageSize: PAGE_SIZE });

  const nameById = useMemo(() => {
    const names = new Map(Object.entries(knownNames));
    for (const speaker of speakers.data?.items ?? []) {
      names.set(speaker.id, speakerFullName(speaker));
    }
    return names;
  }, [speakers.data, knownNames]);

  const options = useMemo<SelectOption[]>(() => {
    const chosen = new Set(value.map((speaker) => speaker.speakerId));
    return (speakers.data?.items ?? [])
      .filter((speaker) => !chosen.has(speaker.id))
      .map((speaker) => ({
        value: speaker.id,
        label: speakerFullName(speaker),
        hint: speaker.profile?.jobTitle ?? undefined,
      }));
  }, [speakers.data, value]);

  const total = speakers.data?.meta.total ?? 0;

  function add(speakerId: string) {
    if (speakerId === "") return;
    onChange([...value, { speakerId, role: "speaker" }]);
  }

  function setRole(index: number, role: SpeakerChoice["role"]) {
    onChange(
      value.map((speaker, at) =>
        at === index ? { ...speaker, role } : speaker,
      ),
    );
  }

  function remove(index: number) {
    onChange(value.filter((_, at) => at !== index));
  }

  return (
    <div className="space-y-4">
      {speakers.isError ? (
        <Alert tone="error" title="We couldn't load the speakers">
          {speakers.error.message}
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => void speakers.refetch()}
          >
            Try again
          </Button>
        </Alert>
      ) : (
        <SearchableSelect
          label="Add a speaker"
          options={options}
          value=""
          onChange={add}
          disabled={disabled || speakers.isPending}
          placeholder={
            speakers.isPending ? "Loading speakers…" : "Search speakers"
          }
          emptyMessage="Every speaker is already on this session."
          noMatchMessage="No speaker matches your search"
          hint={
            total > PAGE_SIZE
              ? `Showing the first ${PAGE_SIZE} of ${total} speakers.`
              : undefined
          }
        />
      )}

      {value.length > 0 ? (
        <ul
          aria-label="Speakers of this session"
          className="divide-y divide-line rounded-md border border-line"
        >
          {value.map((speaker, index) => {
            const name = nameById.get(speaker.speakerId) ?? "Unknown speaker";
            return (
              <li
                key={speaker.speakerId}
                className="flex flex-wrap items-end gap-3 px-3 py-2.5"
              >
                <p className="min-w-40 flex-1 self-center font-semibold">
                  {name}
                </p>
                <SelectField
                  label={`Role of ${name}`}
                  value={speaker.role ?? "speaker"}
                  disabled={disabled}
                  onChange={(event) =>
                    setRole(
                      index,
                      event.target.value as NonNullable<SpeakerChoice["role"]>,
                    )
                  }
                >
                  {Object.entries(SESSION_SPEAKER_ROLE_LABELS).map(
                    ([role, label]) => (
                      <option key={role} value={role}>
                        {label}
                      </option>
                    ),
                  )}
                </SelectField>
                <Button
                  variant="secondary"
                  disabled={disabled}
                  aria-label={`Remove ${name}`}
                  onClick={() => remove(index)}
                >
                  <X aria-hidden="true" className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted">No speakers added yet.</p>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
