import type { Metadata } from "next";
import { ResetPasswordScreen } from "@/src/features/auth/components/screens/ResetPasswordScreen";

export const metadata: Metadata = {
  title: "Reset your password",
  // The token is in the URL fragment, which is never sent to a server. This also stops any
  // other request the page makes from carrying the page address as a Referer.
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

// The link in the password reset email: /reset-password#token=...
// The server cannot see the fragment: the screen reads the token in the browser.
export default function ResetPasswordPage() {
  return <ResetPasswordScreen />;
}
