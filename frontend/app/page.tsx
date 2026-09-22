import Link from "next/link";

import { IceCubeIcon, ScoresIcon, StandingsIcon } from "@/components/xp/icons";
import { Window } from "@/components/xp/Window";

export default function Home() {
  return (
    <main className="xp-page">
      <Window title="This week" icon={<IceCubeIcon />} controls>
        <nav aria-label="This week" className="grid gap-2 sm:grid-cols-2">
          <Link href="/scores" className="xp-button">
            <ScoresIcon width={24} height={24} />
            Scores
          </Link>
          <Link href="/standings" className="xp-button">
            <StandingsIcon width={24} height={24} />
            Standings
          </Link>
        </nav>
      </Window>
    </main>
  );
}
