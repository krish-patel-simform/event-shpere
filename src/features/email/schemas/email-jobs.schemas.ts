import { z } from "zod";

// Job data travels through Redis, so the worker re-validates it before using it.
export const accountSetupJobSchema = z.object({
  to: z.email(),
  firstName: z.string().min(1),
  passwordSetupUrl: z.url(),
  loginUrl: z.url(),
  expiresInHours: z.number().int().positive(),
});
export type AccountSetupJob = z.infer<typeof accountSetupJobSchema>;

/** Every email job: name → data. Add a line here for each new email type. */
export type EmailJobs = {
  "account-setup": AccountSetupJob;
};
export type EmailJobName = keyof EmailJobs;
