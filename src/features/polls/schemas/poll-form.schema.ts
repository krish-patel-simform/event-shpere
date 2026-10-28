import { z } from "zod";

export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 6;

/** Form values of "Create a poll". Options are objects, which is what useFieldArray needs. */
export const pollFormSchema = z
  .object({
    question: z
      .string()
      .trim()
      .min(1, "Write the question")
      .max(200, "Keep the question under 200 characters"),
    kind: z.enum(["single", "multiple", "rating"]),
    options: z
      .array(
        z.object({
          value: z
            .string()
            .trim()
            .max(100, "Keep the option under 100 characters"),
        }),
      )
      .max(POLL_MAX_OPTIONS, `Add up to ${POLL_MAX_OPTIONS} options`),
  })
  .superRefine((form, ctx) => {
    // A rating poll is always 1 to 5: the options box is not used.
    if (form.kind === "rating") return;

    if (form.options.length < POLL_MIN_OPTIONS) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: `Add at least ${POLL_MIN_OPTIONS} options`,
      });
    }
    const seen = new Set<string>();
    form.options.forEach((option, index) => {
      const key = option.value.toLowerCase();
      if (!option.value) {
        ctx.addIssue({
          code: "custom",
          path: ["options", index, "value"],
          message: "Write this option or remove it",
        });
      } else if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["options", index, "value"],
          message: "This option is already in the list",
        });
      }
      seen.add(key);
    });
  });

export type PollFormValues = z.infer<typeof pollFormSchema>;
