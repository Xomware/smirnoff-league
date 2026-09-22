import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smirnoff League",
  description: "Scores, brackets and the ice ledger for the Smirnoff League.",
  // A private league's site: keep it out of search results.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
