import { redirect } from "next/navigation";

// The dashboard is the default page. TODO(AUTH-8): once routes are protected, a visitor who is
// not signed in is sent to /login instead (by proxy.ts), and this stays the way into the app.
export default function Home() {
  redirect("/dashboard");
}
