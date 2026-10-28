"use client";

import { CircleAlert, Plus, X } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";
import { Badge, Button } from "@/src/core/ui";
import { TOPIC_MAX_LENGTH, TOPICS_MAX } from "../utils/own-profile-form";

/**
 * The topics as removable chips and a box to add one. Enter adds (and does not submit the form).
 * A topic that is already there (any capitals) is not added twice. Going over the limit is
 * allowed, so the form's own validation tells the speaker to remove one.
 */
export function SpeakerTopicsField({
  value,
  onChange,
  error,
}: {
  value: string[];
  onChange: (topics: string[]) => void;
  error?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const [draft, setDraft] = useState("");

  const add = () => {
    const topic = draft.trim();
    setDraft("");
    if (!topic) return;
    if (
      value.some((existing) => existing.toLowerCase() === topic.toLowerCase())
    ) {
      return;
    }
    onChange([...value, topic]);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    add();
  };

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold">
        Topics
      </label>
      {value.length > 0 && (
        <ul aria-label="Your topics" className="flex flex-wrap gap-2">
          {value.map((topic) => (
            <li key={topic}>
              <Badge tone="brand" className="gap-1.5 py-1 pr-1 text-sm">
                {topic}
                <button
                  type="button"
                  aria-label={`Remove ${topic}`}
                  onClick={() => onChange(value.filter((t) => t !== topic))}
                  className="grid size-5 place-items-center rounded hover:bg-surface/60"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          value={draft}
          maxLength={TOPIC_MAX_LENGTH}
          autoComplete="off"
          placeholder="Add a topic"
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, error ? errorId : null]
            .filter(Boolean)
            .join(" ")}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 rounded-md border border-field bg-surface px-3 py-2 text-sm placeholder:text-muted/70"
        />
        <Button variant="secondary" onClick={add}>
          <Plus aria-hidden="true" className="size-4" />
          Add topic
        </Button>
      </div>
      <p id={hintId} className="text-xs text-muted">
        Used to recommend your sessions to attendees. {value.length} of{" "}
        {TOPICS_MAX} topics.
      </p>
      {error && (
        <p
          id={errorId}
          className="flex items-start gap-1.5 text-sm text-danger"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
