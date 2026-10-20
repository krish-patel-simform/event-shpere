/**
 * The password policy as a list, so the live checklist can show each rule separately.
 * Must stay equal to PASSWORD_REGEX (constants.ts), which the server enforces; a test checks it.
 */
export const PASSWORD_RULES = [
  { id: "length", label: "8 or more characters", test: (pw: string) => pw.length >= 8 },
  { id: "upper", label: "An uppercase letter", test: (pw: string) => /[A-Z]/.test(pw) },
  { id: "lower", label: "A lowercase letter", test: (pw: string) => /[a-z]/.test(pw) },
  { id: "number", label: "A number", test: (pw: string) => /\d/.test(pw) },
  { id: "special", label: "A special character", test: (pw: string) => /[\W_]/.test(pw) },
] as const;
