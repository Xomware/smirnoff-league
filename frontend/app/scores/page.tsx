import { ScoresWindow } from "@/components/windows/ScoresWindow";
import { ScoresIcon } from "@/components/xp/icons";
import { Window } from "@/components/xp/Window";

export default function ScoresPage() {
  return (
    <main className="xp-page">
      <Window title="Scores" icon={<ScoresIcon />}>
        <ScoresWindow />
      </Window>
    </main>
  );
}
