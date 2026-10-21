import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordScreen } from "@/src/features/auth/components/screens/ResetPasswordScreen";

export const metadata: Metadata = {
  title: "Reset your password",
  // The URL carries a one-time token: never send it to other sites as a Referer.
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

// The link in the password reset email: /reset-password?token=...
export default function ResetPasswordPage(props: PageProps<"/reset-password">) {
  return (
    // searchParams is request data: with cacheComponents it must be read inside Suspense.
    <Suspense fallback={null}>
      <ResetPasswordSection searchParams={props.searchParams} />
    </Suspense>
  );
}

async function ResetPasswordSection({
  searchParams,
}: Pick<PageProps<"/reset-password">, "searchParams">) {
  const { token } = await searchParams;
  // Whether the token is still valid is checked by the API when the form is submitted.
  return (
    <ResetPasswordScreen
      token={typeof token === "string" && token.length > 0 ? token : null}
    />
  );
}
