import { IcesWindow } from "@/components/windows/IcesWindow";
import { IceCubeIcon } from "@/components/xp/icons";
import { Window } from "@/components/xp/Window";

export default function IcesPage() {
  return (
    <main className="xp-page">
      <Window title="Ice Ledger" icon={<IceCubeIcon />}>
        <IcesWindow />
      </Window>
    </main>
  );
}
