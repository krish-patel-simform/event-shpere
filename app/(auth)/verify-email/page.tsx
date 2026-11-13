import type { Metadata } from "next";
import { VerifyEmailScreen } from "@/src/features/auth/components/screens/VerifyEmailScreen";

export const metadata: Metadata = {
  title: "Verify your email",
  // The token is in the URL fragment, which is never sent to a server. This also stops any
  // other request the page makes from carrying the page address as a Referer.
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

// Opened from the signup email: /verify-email#token=...
// The server cannot see the fragment: the screen reads the token in the browser.
export default function VerifyEmailPage() {
  return <VerifyEmailScreen />;
}
