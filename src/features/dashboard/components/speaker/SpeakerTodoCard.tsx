import { Check, Circle } from "lucide-react";
import Link from "next/link";
import { Card, cn } from "@/src/core/ui";
import type { SpeakerTodo } from "../../types/speaker-home";
import { formatDue, isDue } from "../../utils/home-format";
import { EmptyState } from "../EmptyState";
import { ProgressBar } from "../ProgressBar";

function TodoRow({ todo, now }: { todo: SpeakerTodo; now: string }) {
  return (
    <li className="flex items-start gap-3 border-b border-line py-3 last:border-b-0 last:pb-0">
      {todo.done ? (
        <Check
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 rounded-full bg-success p-0.5 text-surface"
        />
      ) : (
        <Circle
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-field"
        />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "font-semibold",
            todo.done && "font-normal text-muted line-through",
          )}
        >
          <span className="sr-only">{todo.done ? "Done: " : "To do: "}</span>
          {todo.title}
        </p>
        {!todo.done && todo.detail && (
          <p className="text-xs text-muted">{todo.detail}</p>
        )}
        {!todo.done && todo.dueAt && (
          <p
            className={cn(
              "text-xs font-semibold",
              isDue(todo.dueAt, now) ? "text-danger" : "text-warning",
            )}
          >
            {formatDue(todo.dueAt, now)}
          </p>
        )}
      </div>
      {!todo.done && todo.action && (
        <Link
          href={todo.action.href}
          className="text-sm font-semibold text-link hover:underline"
        >
          {todo.action.label}
        </Link>
      )}
    </li>
  );
}

/** What the speaker still has to do (complete the profile, upload slides, ...). */
export function SpeakerTodoCard({
  todos,
  now,
}: {
  todos: readonly SpeakerTodo[];
  now: string;
}) {
  const done = todos.filter((todo) => todo.done).length;

  return (
    <Card
      title="To-do"
      description={
        todos.length > 0 ? `${done} of ${todos.length} done` : undefined
      }
      flush={todos.length === 0}
    >
      {todos.length === 0 ? (
        <EmptyState>Nothing to do right now.</EmptyState>
      ) : (
        <>
          <ProgressBar
            value={done}
            max={todos.length}
            label="To-dos done"
            tone="success"
            className="mb-1.5"
          />
          <ul>
            {todos.map((todo) => (
              <TodoRow key={todo.id} todo={todo} now={now} />
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
