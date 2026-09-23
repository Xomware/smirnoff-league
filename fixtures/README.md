# Fixtures

`ices-golden.json` is the golden data for the ice rule. The TypeScript suite
(`frontend/lib/ices/compute.test.ts`, `frontend/lib/ices/stats.test.ts` and others via
`frontend/lib/test/league-mock.ts`) and the Python suite (`backend/tests/test_ices.py`,
`backend/tests/test_finalize.py`) both read it. If either implementation of the rule
drifts, its suite goes red.

It holds real Sleeper data for weeks 1 and 2 of 2026, keyed only by `roster_id` and
Sleeper player ids. There are no names.

- `slots`: the starting lineup, `QB RB RB WR WR TE FLEX FLEX K DEF`
- `weeks[].matchups`: `roster_id`, `matchup_id`, `points`, `starters`, `starters_points`,
  `players`, `players_points` (bench data is for the Avoidable Ices stat)
- `weeks[].expected`: the ices the rule must produce, hand-checked against the
  commissioner's week 1 newsletter. W1 has 5 ices and W2 has 3.

`backend/scripts/build_ices_fixture.py` rebuilds it from the live Sleeper API. The
expected ices are hard-coded in that script, not computed by the rule, so a wrong rule
can't write its own answer key. A rebuild must leave `expected` byte-identical.
