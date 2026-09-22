import { SignOutButton } from "@/components/auth/sign-out-button";
import { IceCubeIcon } from "@/components/xp/icons";
import { PlayerRow } from "@/components/xp/PlayerRow";
import { Taskbar } from "@/components/xp/Taskbar";
import { TeamName } from "@/components/xp/TeamName";
import { Window } from "@/components/xp/Window";

const TEAMS = [
  { name: "Team A", ices: 3 },
  { name: "Team B", ices: 0 },
  { name: "Team C", ices: 1 },
];

const PLAYERS = [
  { name: "Player One", position: "QB", points: 21.34, ices: 0 },
  { name: "Player Two", position: "WR", points: 0, ices: 1 },
  { name: "Player Three", position: "TE", points: 8.6, ices: 0 },
  { name: "Player Four", position: "K", points: -1, ices: 1 },
];

export default function Home() {
  return (
    <>
      <main className="flex flex-col items-center gap-4 pt-4 pb-[calc(var(--taskbar-height)+1rem)] sm:px-4 sm:pt-8">
        <Window title="Smirnoff League - Sample Week" icon={<IceCubeIcon />} controls>
          <ul className="mb-4 flex flex-col gap-2">
            {TEAMS.map((t) => (
              <li key={t.name}>
                <TeamName name={t.name} iced={t.ices > 0} ices={t.ices} />
              </li>
            ))}
          </ul>
          <ul className="bg-(--xp-cream)">
            {PLAYERS.map((p) => (
              <PlayerRow key={p.name} {...p} iced={p.ices > 0} />
            ))}
          </ul>
          <SignOutButton />
        </Window>
      </main>
      <Taskbar />
    </>
  );
}
