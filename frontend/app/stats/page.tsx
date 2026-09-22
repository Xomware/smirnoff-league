import { StatsView } from "@/components/views/stats-view";
import { IceCubeIcon } from "@/components/xp/icons";
import { Window } from "@/components/xp/Window";

export default function StatsPage() {
  return (
    <main className="xp-page">
      <Window title="Ice Stats" icon={<IceCubeIcon />} controls className="w-[min(100%,72rem)]">
        <StatsView />
      </Window>
    </main>
  );
}
