import { MessageCircleQuestion } from "lucide-react";
import { useId } from "react";
import { Badge, Button, Card } from "@/src/core/ui";
import type { AudienceQuestion, QuestionSort } from "../types/poll.types";
import { sortQuestions } from "../utils/poll-state";
import { timeAgo } from "../utils/poll-time";

/**
 * The questions the audience asked, most upvoted first by default. The speaker marks one
 * answered once they have dealt with it (and can undo that).
 */
export function AudienceQuestions({
  questions,
  sort,
  now,
  onSortChange,
  onSetAnswered,
}: {
  questions: readonly AudienceQuestion[];
  sort: QuestionSort;
  /** The current time (ISO), for "4 min ago". */
  now: string;
  onSortChange: (sort: QuestionSort) => void;
  onSetAnswered: (questionId: string, answered: boolean) => void;
}) {
  const sortId = useId();
  const sorted = sortQuestions(questions, sort);

  return (
    <Card
      title="Audience questions"
      description={`${questions.length} total`}
      className="min-w-0"
      flush
      action={
        <div className="flex items-center gap-2">
          <label htmlFor={sortId} className="text-sm text-muted">
            Sort questions
          </label>
          <select
            id={sortId}
            value={sort}
            onChange={(event) =>
              onSortChange(event.target.value === "new" ? "new" : "top")
            }
            className="rounded-md border border-field bg-surface px-3 py-2 text-sm"
          >
            <option value="top">Most upvoted</option>
            <option value="new">Newest</option>
          </select>
        </div>
      }
    >
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
          <MessageCircleQuestion
            aria-hidden="true"
            className="size-8 text-muted"
          />
          <p className="font-semibold">No questions yet</p>
          <p className="text-sm text-muted">
            Questions the audience asks during the session show up here.
          </p>
        </div>
      ) : (
        <ul>
          {sorted.map((question) => (
            <li
              key={question.id}
              className="flex flex-wrap items-start gap-4 border-b border-line px-5 py-4 last:border-b-0"
            >
              <div className="w-12 shrink-0 rounded-md border border-line py-1 text-center">
                <p className="font-semibold">{question.upvotes}</p>
                <p className="sr-only">upvotes</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{question.text}</p>
                <p className="text-sm text-muted">
                  {question.author ?? "Anonymous"} ·{" "}
                  {timeAgo(question.askedAt, now)}
                </p>
              </div>
              {question.answered ? (
                <div className="flex items-center gap-2">
                  <Badge tone="success">Answered</Badge>
                  <Button
                    variant="secondary"
                    aria-label={`Mark as not answered: ${question.text}`}
                    onClick={() => onSetAnswered(question.id, false)}
                  >
                    Undo
                  </Button>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  aria-label={`Mark answered: ${question.text}`}
                  onClick={() => onSetAnswered(question.id, true)}
                >
                  Mark answered
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
