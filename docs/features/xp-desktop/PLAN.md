# Plan: XP Desktop, Drill-down and Ice Stats

**Status**: Done (2026-09-23, tracking #29)
**Created**: 2026-09-22

## Summary
Replace the single-column pages with an XP desktop. You get draggable windows, taskbar tabs and desktop icons. Every team, player and week opens its own window, and an Ice Stats window adds the league's hall of shame. Dom approved the design and the split below on 2026-09-22. The reference mockup is Dom's `page-view-ideas.png`: desktop icons on the left, Standings/Now Playing/News windows, and a taskbar tab.

## Approach

**Window manager (`frontend/lib/desktop/`).**
- State is a `useReducer` in a context. Each window is `{ id, kind, params, x, y, w, h, z, minimized, maximized }`.
- The actions are open (focus the window if it's already open), close, focus, move, resize, minimize, maximize and restore.
- `kind` maps to a registry of window components: `scores`, `standings`, `brackets`, `ices`, `stats`, `recap`, `team`, `player`, `week` and `profile`.
- Dragging uses pointer events on the title bar, and resizing uses a corner handle. Both are clamped to the viewport. There are no libraries.
- The taskbar shows one tab per open window. Clicking a tab focuses the window, or restores it if minimized.
- The desktop has a wallpaper: a Bliss-style CSS gradient hill, with no image asset.
- Desktop icons down the left side: Scores, Standings, Brackets, Ice Ledger, Ice Stats, Draft Recap and My Team. The Recycle Bin holds teams eliminated from the playoffs, and shows as empty until week 15.
- Below 768px there's no free dragging: windows open maximized, one visible at a time, and taskbar tabs switch between them.

**Deep links and persistence.**
- `/?open=standings,team:6` opens those windows, and the last one listed gets focus.
- Old routes (`/standings`, `/scores`, `/brackets`, `/ices`) become client redirects to `/?open=<kind>`, so existing links keep working.
- The layout (positions and sizes) is saved to `localStorage` for each user. Every read and write sits in try/catch, and the site falls back to the default layout if storage is missing.

**Drill-down.**
- `TeamName`, player names and week labels are clickable everywhere and call `open("team", {rosterId})` and so on.
- The Team window shows roster/starters, weekly scores with W/L, and ice history by week and reason.
- The Player window shows every ice the player caused for any roster, their weekly points, and which team started him.
- The Week window shows matchups, that week's ices, and the lowest-score team.

**Ice Stats (`frontend/lib/ices/stats.ts`, pure functions over finished weeks):**
- **Repeat Offenders:** players with 2 or more `zero` ices, with counts and the rosters that started them.
- **Avoidable Ices:** a `zero` starter at slot S where a bench player (from `players` minus `starters`) eligible for S scored more than 0. FLEX covers RB/WR/TE. Reports the best bench points left behind.
- **Closest Escapes:** starters who finished between 0 and 1.0 points, exclusive of 0 and inclusive of 1.0.
- **Breakdowns:** ices by week, by team, by reason, and by position (`players.json` position; DEF and K by slot).
- **Lazy Manager:** the most `empty` ices.
- **Ice streaks:** the longest run of consecutive finished weeks with at least one ice, per team.
- **Lowest-score magnets:** `lowest` ice count per team.
- The Stats window draws plain SVG bar charts and "Hall of Shame" cards, one per stat, in a wanted-poster style for Repeat Offenders. Every row drills into its team, player or week.

**Favicon and logos.**
- An SVG robot-head favicon and app icon now, drawn inline: `app/icon.svg` and `apple-icon.png`, generated from that SVG.
- When Dom provides the logo files, swap in the robot crest for the landing hero, the onboarding banner, the Start button, window title icons, the desktop logo icon and the favicon.

## Implementation Steps
Sizes count hand-written logic lines.
1. **Window manager + desktop shell.** Reducer, Window drag/resize, taskbar tabs, desktop icons, wallpaper, phone fallback. Existing page bodies move into window components. ~250. Needs onboarding (#14) merged first, for its layout/gate.
2. **Deep links + saved layout + old-route redirects.** ~100. Needs 1.
3. **Team, Player and Week windows + click-through everywhere.** ~250. Needs 1.
4. **Ice Stats calculations** with tests on the golden W1/W2 fixture. W1/W2 matchups include `players` and `players_points`, so the fixture builder must keep those for Avoidable Ices. ~200. No deps.
5. **Ice Stats window + SVG charts + Hall of Shame.** ~200. Needs 1, 4.
6. **SVG favicon + app icon.** ~40. No deps.
7. **Robot logo rollout.** Blocked on the logo files.

Parallel waves: {1, 4, 6}, then {2, 3, 5}, then 7.

## Out of Scope
- Live Ice Watch (game clock), the ledger backend, videos, write-ups. These are separate phases of the epic plan.
- Real window chrome semantics beyond the list above: no multi-monitor, no snapping.

## Risks / Tradeoffs
- **Lockfile and layout conflicts.** Parallel PRs touch `layout.tsx` and the window registry. Merge in wave order and rebase between waves.
- **Recomputed stats.** Stats are recomputed client-side from Sleeper each load: weeks 1–N means N matchup fetches, already shared by `useSeasonIces`. That's fine at 17 weeks.
- **Rebuilt fixture.** The Avoidable Ices test needs bench data in the golden fixture. Re-running the builder must keep the existing expected ices identical.

## Open Questions
- [ ] Logo files: Dom is providing the robot crest and sheet.
