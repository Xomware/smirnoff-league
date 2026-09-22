import { StandingsWindow } from "@/components/windows/StandingsWindow";
import { StandingsIcon } from "@/components/xp/icons";
import { Window } from "@/components/xp/Window";

export default function StandingsPage() {
  return (
    <main className="xp-page">
      <Window title="Standings" icon={<StandingsIcon />}>
        <StandingsWindow />
      </Window>
    </main>
  );
}
