"use client";

import { useProfile } from "@/lib/profile/use-profile";
import { TeamView } from "./team-view";

export function MyTeamView() {
  const { myRosterId, setEditing } = useProfile();
  if (myRosterId !== null) return <TeamView rosterId={myRosterId} />;
  return (
    <div className="grid justify-items-start gap-2">
      <p>You haven&apos;t claimed a team yet.</p>
      <button type="button" className="xp-button" onClick={() => setEditing(true)}>
        Pick your team
      </button>
    </div>
  );
}
