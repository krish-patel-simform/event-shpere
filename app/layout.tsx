import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { QueryProvider } from "@/src/core/api-client/QueryProvider";
import { THEME_INIT_SCRIPT } from "@/src/core/theme/theme";
import { StoreProvider } from "@/src/redux/StoreProvider";
import "./globals.css";

// IBM Plex is not a variable font, so the weights we use are listed explicitly.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "EventSphere", template: "%s · EventSphere" },
  description:
    "Plan, run and attend events in one place: registrations, schedules, live polls and updates.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the inline script below sets data-theme on <html> before React
    // hydrates, which is expected (see "Preventing flash before hydration" in the Next.js docs).
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <StoreProvider>
          <QueryProvider>{children}</QueryProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
