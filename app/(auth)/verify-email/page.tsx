import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailScreen } from "@/src/features/auth/components/screens/VerifyEmailScreen";

export const metadata: Metadata = {
  title: "Verify your email",
  // The URL carries a one-time token: never send it to other sites as a Referer.
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

// Opened from the signup email: /verify-email?token=...
export default function VerifyEmailPage(props: PageProps<"/verify-email">) {
  return (
    // searchParams is request data: with cacheComponents it must be read inside Suspense.
    <Suspense fallback={null}>
      <VerifyEmailSection searchParams={props.searchParams} />
    </Suspense>
  );
}

async function VerifyEmailSection({ searchParams }: Pick<PageProps<"/verify-email">, "searchParams">) {
  const { token } = await searchParams;
  return <VerifyEmailScreen token={typeof token === "string" && token.length > 0 ? token : null} />;
}
