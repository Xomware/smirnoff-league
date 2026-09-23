import type { Metadata, Viewport } from "next";

import { AuthGate } from "@/components/auth/auth-gate";
import { DesktopProvider } from "@/lib/desktop/desktop-context";

import "./globals.css";

export const metadata: Metadata = {
  title: "Smirnoff League",
  description: "Scores, brackets and the ice ledger for the Smirnoff League.",
  // A private league's site: keep it out of search results.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <DesktopProvider>
          <AuthGate>{children}</AuthGate>
        </DesktopProvider>
      </body>
    </html>
  );
}
