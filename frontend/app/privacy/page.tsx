import Link from "next/link";

import "@/components/landing/landing.css";

export const metadata = {
  title: "Privacy Policy | Smirnoff League",
};

export default function PrivacyPage() {
  return (
    <main className="landing min-h-screen">
      <header className="landing-hero privacy-hero">
        <h1 className="landing-title">Privacy Policy</h1>
        <p className="landing-tagline">Last updated 2026-09-23</p>
      </header>

      <article className="landing-band landing-band-mist">
        <div className="privacy-body">
          <p>
            Smirnoff League is a private site for one fantasy football league. This page says what it keeps about you
            and why.
          </p>

          <h2>What we collect</h2>
          <ul>
            <li>Your Google account email, name and profile picture, when you sign in.</li>
            <li>The team you claim.</li>
            <li>Ice ledger entries, and the chug videos, chug times and write-ups you upload.</li>
            <li>Basic activity, such as pages visited and sign-in times, which league admins can see.</li>
          </ul>

          <h2>Where it lives</h2>
          <p>
            Everything is stored in AWS (us-east-1). It is never sold or shared, and it is used only to run the league
            site.
          </p>

          <h2>Emails</h2>
          <p>Emails are off by default and only sent if you opt in. Every email has an unsubscribe link.</p>

          <h2>Deleting your data</h2>
          <p>Ask a league admin to remove your account and your uploads.</p>

          <h2>Contact</h2>
          <p>Questions go to the league commissioner.</p>

          <p>
            <Link href="/">Back to Smirnoff League</Link>
          </p>
        </div>
      </article>
    </main>
  );
}
