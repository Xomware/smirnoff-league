import { describe, expect, it } from "vitest";

import { describeActivity } from "./describe";

const names = { team: (id: number) => `Team ${id}`, player: (id: string) => (id === "4046" ? "Patrick Mahomes" : undefined) };

describe("describeActivity", () => {
  it.each([
    ["signin", "", "Signed in"],
    ["open", "stats", "Opened Ice Stats"],
    ["open", "team:6", "Opened Team: Team 6"],
    ["open", "folder:ices", "Opened Ices folder"],
    ["open", "admin:users", "Opened Control Panel: Users"],
    ["open", "writeup", "Opened Latest Edition"],
    ["drill", "player:4046", "Went to Player: Patrick Mahomes"],
    ["drill", "player:9999", "Went to Player: 9999"],
    ["drill", "week:3", "Went to Week 3"],
    ["drill", "writeup:3", "Went to Week 3 Edition"],
    ["upload", "chug:W03#R06#S5", "Uploaded a chug"],
    ["upload", "edition:3", "Uploaded the Week 3 edition"],
    ["publish", "edition:3", "Published the Week 3 edition"],
    ["open", "something-new", "Opened something-new"],
  ] as const)("%s %s reads %s", (kind, target, text) => {
    expect(describeActivity(kind, target, names)).toBe(text);
  });
});
