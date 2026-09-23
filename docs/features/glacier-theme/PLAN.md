# Glacier Theme

**Status:** Ready
**Mockup:** https://claude.ai/artifact/UPWqkHutfWpiDwUBqzvmKb (v5, approved 2026-09-23)

## Goal

A second look for the site beside Classic XP. Glacier is a modern top-nav site on a
dark polar-navy background, with frosted ice panels, icicles, falling snow, a cursor
trail and snowballs thrown at the click point. Each user picks a theme and it follows
them across devices.

## Decisions

- **Glacier is its own shell, not a reskin of the window manager.** It renders the
  existing view components (`components/views/*`) inside frost panels under a top
  nav. Data hooks, deep links (`?open=kind:params`) and the command palette are shared.
- **Views get a CSS skin, not forks.** A `[data-theme="glacier"]` layer restyles the
  XP primitives the views use (tabs, tables, buttons, badges). No view logic changes.
- **The preference is stored on the profile** (`updateMe({ theme })`), beside
  `notificationsSeenAt`. `localStorage` mirrors it so the first paint is right before
  `/me` returns. The default is `xp`.
- **Fonts:** Archivo Black for display and Figtree for body, loaded only in Glacier.
- **Effects:** there are no effects under `prefers-reduced-motion`. Snowballs ignore
  clicks on links, buttons and inputs. Phone throws on tap on empty space only.

## Pieces

| # | Piece | Size | Depends on |
|---|---|---|---|
| 1 | `components/glacier/Effects.tsx`: snow, cursor trail, snowball and splat, reduced-motion off. Unused | ~150 | none |
| 2 | Glacier desktop shell: header nav, `?open=` routing, frost panel hosting existing views, palette | ~250 | 1 |
| 3 | Glacier home: hero, Your ices, Chug Board, week games, ice standings | ~200 | 2 |
| 4 | View skin: `[data-theme="glacier"]` CSS for tabs, tables, buttons, badges, Rankings stat cards | ~500 CSS | 2 |
| 5 | Phone Glacier: MobileShell skin, floating pill tab bar, tap-to-throw | ~150 | 1, 4 |
| 6 | Theme preference: profile field, backend allowlist, toggles in the Start menu, Glacier header and phone Menu; AppShell switch | ~120 | 2, 5 |

Pieces 1–5 land unreachable. Piece 6 turns Glacier on, and reverting it turns Glacier
off.

## Out of scope

- Reskinning the XP window chrome itself
- Per-page Glacier layouts beyond Home and Rankings; other pages use the skinned views
