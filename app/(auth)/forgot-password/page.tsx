import type { Metadata } from "next";
import { ForgotPasswordScreen } from "@/src/features/auth/components/screens/ForgotPasswordScreen";

export const metadata: Metadata = { title: "Forgot your password?" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordScreen />;
}
