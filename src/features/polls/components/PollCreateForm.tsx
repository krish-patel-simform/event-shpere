"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { Button, Card, TextField } from "@/src/core/ui";
import {
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  pollFormSchema,
  type PollFormValues,
} from "../schemas/poll-form.schema";

const DEFAULT_VALUES: PollFormValues = {
  question: "",
  kind: "single",
  options: [{ value: "" }, { value: "" }],
};

/**
 * "Create a poll": a question, its options and the answer type. Save as draft keeps it for later,
 * Launch now opens it to the audience. The time limit in the design is left out: nothing
 * could enforce it yet.
 */
export function PollCreateForm({
  onCreate,
}: {
  onCreate: (values: PollFormValues, status: "draft" | "live") => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PollFormValues>({
    resolver: zodResolver(pollFormSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "options",
  });
  const kind = useWatch({ control, name: "kind" });

  const submitAs = (status: "draft" | "live") =>
    handleSubmit((values) => {
      onCreate(values, status);
      reset(DEFAULT_VALUES);
    });

  const optionsError = errors.options?.root?.message ?? errors.options?.message;

  return (
    <Card title="Create a poll" className="min-w-0">
      <form noValidate onSubmit={submitAs("draft")} className="space-y-4">
        <TextField
          label="Question"
          placeholder="Ask the audience something"
          autoComplete="off"
          error={errors.question?.message}
          {...register("question")}
        />

        <div className="space-y-1.5">
          <label htmlFor="poll-kind" className="block text-sm font-semibold">
            Answer type
          </label>
          <select
            id="poll-kind"
            className="w-full rounded-md border border-field bg-surface px-3 py-2 text-sm"
            {...register("kind")}
          >
            <option value="single">Single choice</option>
            <option value="multiple">Multiple choice</option>
            <option value="rating">Rating 1–5</option>
          </select>
        </div>

        {kind === "rating" ? (
          <p className="text-sm text-muted">
            The audience rates from 1 to 5, so there are no options to write.
          </p>
        ) : (
          <fieldset className="min-w-0 space-y-3">
            <legend className="text-sm font-semibold">Options</legend>
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-2">
                <TextField
                  label={`Option ${index + 1}`}
                  autoComplete="off"
                  className="min-w-0 flex-1"
                  error={errors.options?.[index]?.value?.message}
                  {...register(`options.${index}.value`)}
                />
                <Button
                  variant="secondary"
                  aria-label={`Remove option ${index + 1}`}
                  disabled={fields.length <= POLL_MIN_OPTIONS}
                  onClick={() => remove(index)}
                  className="mt-7 px-3"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              </div>
            ))}
            {optionsError && (
              <p className="text-sm text-danger">{optionsError}</p>
            )}
            <Button
              variant="secondary"
              disabled={fields.length >= POLL_MAX_OPTIONS}
              onClick={() => append({ value: "" })}
            >
              <Plus aria-hidden="true" className="size-4" />
              Add option
            </Button>
          </fieldset>
        )}

        <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-4">
          <Button type="submit" variant="secondary">
            Save as draft
          </Button>
          <Button onClick={submitAs("live")}>Launch now</Button>
        </div>
      </form>
    </Card>
  );
}
