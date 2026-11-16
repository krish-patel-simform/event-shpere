import type { Metadata } from "next";
import { SetPasswordScreen } from "@/src/features/auth/components/screens/SetPasswordScreen";

export const metadata: Metadata = {
  title: "Set your password",
  // The token is in the URL fragment, which is never sent to a server. This also stops any
  // other request the page makes from carrying the page address as a Referer.
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

// Step 1 of the account-setup email: /set-password#token=...
// The server cannot see the fragment: the screen reads the token in the browser.
export default function SetPasswordPage() {
  return <SetPasswordScreen />;
}
