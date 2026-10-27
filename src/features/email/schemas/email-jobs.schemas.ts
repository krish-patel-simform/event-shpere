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

// After verification: the link to activate the organizer's Strapi (CMS) account.
// registerUrl holds a one-time registration token: never log it.
export const cmsAccessJobSchema = z.object({
  to: z.email(),
  firstName: z.string().min(1),
  registerUrl: z.url(),
});
export type CmsAccessJob = z.infer<typeof cmsAccessJobSchema>;

// After an admin rejects an organizer application: the decision and the admin's reason.
export const organizerRejectedJobSchema = z.object({
  to: z.email(),
  firstName: z.string().min(1),
  organizationName: z.string().min(1),
  reason: z.string().min(1),
  loginUrl: z.url(),
});
export type OrganizerRejectedJob = z.infer<typeof organizerRejectedJobSchema>;

/** Every email job: name → data. Add a line here for each new email type. */
export type EmailJobs = {
  "account-setup": AccountSetupJob;
  "cms-access": CmsAccessJob;
  "organizer-rejected": OrganizerRejectedJob;
};
export type EmailJobName = keyof EmailJobs;
