// Trims Sleeper's ~5MB /players/nfl to the fantasy positions and the fields the
// UI shows, so the browser never downloads the full dump. Runs as prebuild.
import { mkdir, writeFile } from "node:fs/promises";

const POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);
const OUT = new URL("../public/data/players.json", import.meta.url);

const res = await fetch("https://api.sleeper.app/v1/players/nfl");
if (!res.ok) throw new Error(`Sleeper /players/nfl: ${res.status}`);
const all = await res.json();

const players = {};
for (const [id, p] of Object.entries(all)) {
  if (!POSITIONS.has(p.position)) continue;
  players[id] = {
    name: p.full_name ?? `${p.first_name} ${p.last_name}`,
    position: p.position,
    team: p.team ?? null,
    injury_status: p.injury_status ?? null,
  };
}

await mkdir(new URL(".", OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(players));
console.log(`players.json: ${Object.keys(players).length} players`);
