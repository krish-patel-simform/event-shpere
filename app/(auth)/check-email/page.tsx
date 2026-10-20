import type { Metadata } from "next";
import { CheckEmailScreen } from "@/src/features/auth/components/screens/CheckEmailScreen";

export const metadata: Metadata = {
  title: "Check your email",
  robots: { index: false, follow: false },
};

export default function CheckEmailPage() {
  return <CheckEmailScreen />;
}
