import { BracketsWindow } from "@/components/windows/BracketsWindow";
import { BracketIcon } from "@/components/xp/icons";
import { Window } from "@/components/xp/Window";

export default function BracketsPage() {
  return (
    <main className="xp-page">
      <Window title="Brackets" icon={<BracketIcon />}>
        <BracketsWindow />
      </Window>
    </main>
  );
}
