/** Every page path the auth screens link to, so a route is renamed in one place. */
export const AUTH_ROUTES = {
  login: "/login",
  signup: "/signup",
  signupUser: "/signup/user",
  signupOrganizer: "/signup/organizer",
  checkEmail: "/check-email",
  verifyEmail: "/verify-email",
  setPassword: "/set-password",
} as const;

/** Site pages shown in the shell footer. These pages do not exist yet. */
export const SITE_ROUTES = {
  privacy: "/privacy",
  terms: "/terms",
  organizerTerms: "/organizer-terms",
  support: "/support",
} as const;
