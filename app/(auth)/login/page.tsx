import type { Metadata } from "next";
import { LoginForm } from "@/src/features/auth/components/LoginForm";

export const metadata: Metadata = { title: "Log in · EventSphere" };

// Step 2 of the account-setup email, and the normal login page.
export default function LoginPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Log in</h1>
      <LoginForm />
    </main>
  );
}
