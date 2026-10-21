import type { Metadata } from "next";
import { Suspense } from "react";
import { SetPasswordScreen } from "@/src/features/auth/components/screens/SetPasswordScreen";

export const metadata: Metadata = {
  title: "Set your password",
  // The URL carries a one-time token: never send it to other sites as a Referer.
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

// Step 1 of the account-setup email: /set-password?token=...
export default function SetPasswordPage(props: PageProps<"/set-password">) {
  return (
    // searchParams is request data: with cacheComponents it must be read inside Suspense.
    <Suspense fallback={null}>
      <SetPasswordSection searchParams={props.searchParams} />
    </Suspense>
  );
}

async function SetPasswordSection({ searchParams }: Pick<PageProps<"/set-password">, "searchParams">) {
  const { token } = await searchParams;
  // Whether the token is still valid is checked by the API when the form is submitted.
  return <SetPasswordScreen token={typeof token === "string" && token.length > 0 ? token : null} />;
}
