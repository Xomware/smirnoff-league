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
            Smirnoff League (smirnoff-league.com) is a private website for one
            14-team fantasy football league. It shows scores, standings and
            brackets, and tracks the league&apos;s ice ledger. This policy
            explains what data the site collects, including data from your
            Google account, and how it is used, shared, protected, kept and
            deleted.
          </p>

          <h2>Google user data we access</h2>
          <p>
            You sign in with Google. With your permission, Google shares three
            things with us: your email address, your name and your profile
            picture (the openid, email and profile scopes). We do not ask for,
            and cannot see, your Gmail, contacts, calendar, files or any other
            Google data.
          </p>

          <h2>How we use Google user data</h2>
          <ul>
            <li>
              Your email identifies your account, so you can sign in and see
              league-only pages.
            </li>
            <li>
              Your name and picture show on your league profile and next to the
              team you claim.
            </li>
            <li>
              League admins use your email to know who has claimed which team.
            </li>
            <li>
              If you opt in to emails, we send league alerts to that address.
            </li>
          </ul>
          <p>
            That is the only use. Google user data is never used for
            advertising, never sold, never used to train AI or machine learning
            models, and never used for credit or lending decisions. Our use of
            information received from Google APIs adheres to the{" "}
            <a href="https://developers.google.com/terms/api-services-user-data-policy">
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>

          <h2>Other data we keep</h2>
          <ul>
            <li>
              The team you claim and your profile settings, such as theme and
              email preferences.
            </li>
            <li>
              Ice ledger entries, and the chug videos, chug times and write-ups
              you upload.
            </li>
            <li>
              Basic activity: pages visited and sign-in times, which league
              admins can see.
            </li>
          </ul>
          <p>
            Scores, rosters and standings come from the public Sleeper fantasy
            API, not from you.
          </p>

          <h2>Who we share it with</h2>
          <ul>
            <li>
              Other signed-in league members see your name, picture, team, ices
              and uploads. Your email is shown only to league admins.
            </li>
            <li>
              Amazon Web Services hosts the site, stores the data and sends
              opted-in emails, acting only on our instructions.
            </li>
            <li>Google handles sign-in.</li>
          </ul>
          <p>
            We do not sell, rent or trade your data, and we do not share it with
            advertisers, data brokers or anyone else.
          </p>

          <h2>How we protect it</h2>
          <p>
            All traffic uses HTTPS. League data is served only to signed-in
            members, through authorized requests and short-lived links. Data is
            stored in AWS (us-east-1) and encrypted at rest. Access to the
            servers is limited to the site&apos;s administrator.
          </p>

          <h2>Emails</h2>
          <p>
            Emails are off by default and only sent if you opt in. Every email
            has an unsubscribe link.
          </p>

          <h2>How long we keep it, and deleting it</h2>
          <p>
            Activity records are deleted automatically after 90 days. Your
            profile, email, name, picture and uploads are kept while you are in
            the league. Ask a league admin at any time and we will delete your
            account, your Google data and your uploads within 30 days. You can
            also remove the site&apos;s access at any time from your Google
            Account under Security, Third-party connections.
          </p>

          <h2>Changes to this policy</h2>
          <p>
            If we change how the site uses Google user data, we will update this
            page and tell members on the site before the change takes effect.
          </p>

          <h2>Contact</h2>
          <p>
            Questions and deletion requests go to the league commissioner, who
            runs this site.
          </p>

          <p>
            <Link href="/">Back to Smirnoff League</Link>
          </p>
        </div>
      </article>
    </main>
  );
}
