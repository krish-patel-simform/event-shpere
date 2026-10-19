import type { Metadata } from "next";
import { Suspense } from "react";
import { SetPasswordForm } from "@/src/features/auth/components/SetPasswordForm";

export const metadata: Metadata = {
  title: "Set your password · EventSphere",
  // The URL carries a one-time token: never send it to other sites as a Referer.
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

// Step 1 of the account-setup email: /set-password?token=...
export default function SetPasswordPage(props: PageProps<"/set-password">) {
  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold">Set your password</h1>
      <p className="mb-6 text-sm text-gray-600">
        Choose a password for your EventSphere account. Then you can log in.
      </p>
      {/* searchParams is request data: with cacheComponents it must be read inside Suspense. */}
      <Suspense fallback={<p className="text-sm text-gray-600">Loading…</p>}>
        <SetPasswordSection searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function SetPasswordSection({
  searchParams,
}: Pick<PageProps<"/set-password">, "searchParams">) {
  const { token } = await searchParams;

  if (typeof token !== "string" || token.length === 0) {
    return (
      <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
        This link is invalid. Open the link from your email again, or ask the admin for a new one.
      </p>
    );
  }
  // Whether the token is still valid is checked by the API when the form is submitted.
  return <SetPasswordForm token={token} />;
}
