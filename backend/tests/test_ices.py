import json
from pathlib import Path

import pytest

from lambdas.common.ices import default_week_settings, week_ices

GOLDEN = json.loads((Path(__file__).parents[2] / "fixtures" / "ices-golden.json").read_text())
SLOTS = GOLDEN["slots"]
ON = {"iceRulesActive": True, "lowestScope": "all"}

# Sleeper player ids, confirmed against public/data/players.json.
KYLE_PITTS = "7553"
ROMEO_DOUBS = "8121"
COLSTON_LOVELAND = "12517"
HOU_DEF = "HOU"
PUKA_NACUA = "9493"
DJ_MOORE = "4983"


def golden_week(week):
    return next(w for w in GOLDEN["weeks"] if w["week"] == week)


def roster_starting(week, player_id):
    return next(m["roster_id"] for m in week["matchups"] if player_id in (m["starters"] or []))


def row(roster_id, points, **overrides):
    return {
        "roster_id": roster_id,
        "matchup_id": 1,
        "points": points,
        "starters": [f"p{roster_id}-{i}" for i in range(len(SLOTS))],
        "starters_points": [10] * len(SLOTS),
        **overrides,
    }


def with_starter_points(points):
    starters_points = [10] * len(SLOTS)
    starters_points[3] = points
    return row(1, 150, starters_points=starters_points)


LOWEST_ELSEWHERE = row(2, 100)


def zeros_for(points):
    ices = week_ices(3, [with_starter_points(points), LOWEST_ELSEWHERE], SLOTS, ON)
    return [i for i in ices if i["reason"] == "zero"]


@pytest.mark.parametrize("week", GOLDEN["weeks"], ids=lambda w: f"W{w['week']}")
def test_golden_week_matches_fixture(week):
    assert week_ices(week["week"], week["matchups"], SLOTS, week["settings"]) == week["expected"]


def test_g1_w1_zeros_and_lowest():
    w1 = golden_week(1)
    ices = week_ices(1, w1["matchups"], SLOTS, ON)

    assert len(ices) == 5
    zeros = [i for i in ices if i["reason"] == "zero"]
    assert sorted(i["playerId"] for i in zeros) == sorted(
        [KYLE_PITTS, ROMEO_DOUBS, COLSTON_LOVELAND, HOU_DEF]
    )
    assert len({i["rosterId"] for i in zeros}) == 4
    for zero in zeros:
        assert zero["rosterId"] == roster_starting(w1, zero["playerId"])
    lowest = [i for i in ices if i["reason"] == "lowest"]
    assert len(lowest) == 1
    assert lowest[0]["rosterId"] == roster_starting(w1, ROMEO_DOUBS)
    assert lowest[0]["points"] == 91.46


def test_g2_w2_zeros_and_lowest():
    w2 = golden_week(2)
    ices = week_ices(2, w2["matchups"], SLOTS, ON)

    assert len(ices) == 3
    assert sorted(i["playerId"] for i in ices if i["reason"] == "zero") == sorted(
        [PUKA_NACUA, DJ_MOORE]
    )
    lowest = [i for i in ices if i["reason"] == "lowest"]
    assert len(lowest) == 1
    assert lowest[0]["rosterId"] == roster_starting(w2, DJ_MOORE)
    assert lowest[0]["points"] == 82.1


def test_s1_zero_starter_is_an_ice():
    assert zeros_for(0) == [
        {
            "id": "W03#R01#S3",
            "week": 3,
            "rosterId": 1,
            "reason": "zero",
            "slotIndex": 3,
            "slot": "WR",
            "playerId": "p1-3",
            "points": 0,
        }
    ]


def test_s2_hundredth_of_a_point_is_not_an_ice():
    assert zeros_for(0.01) == []


def test_s3_negative_starter_is_an_ice():
    assert len(zeros_for(-2)) == 1


def test_s4_zero_starter_id_is_empty():
    starters = [f"p1-{i}" for i in range(len(SLOTS))]
    starters[2] = "0"
    ices = week_ices(3, [row(1, 150, starters=starters), LOWEST_ELSEWHERE], SLOTS, ON)

    assert [i for i in ices if i["rosterId"] == 1] == [
        {
            "id": "W03#R01#S2",
            "week": 3,
            "rosterId": 1,
            "reason": "empty",
            "slotIndex": 2,
            "slot": "RB",
            "playerId": None,
            "points": 0,
        }
    ]


def test_s5_short_starters_leave_the_rest_empty():
    short = row(1, 150, starters=[f"p1-{i}" for i in range(8)], starters_points=[10] * 8)
    ices = [i for i in week_ices(3, [short, LOWEST_ELSEWHERE], SLOTS, ON) if i["rosterId"] == 1]

    assert [(i["reason"], i["slotIndex"], i["slot"]) for i in ices] == [
        ("empty", 8, "K"),
        ("empty", 9, "DEF"),
    ]


def test_s6_tie_after_rounding_ices_both():
    ices = week_ices(3, [row(1, 101.3), row(2, 101.29999999999998), row(3, 120)], SLOTS, ON)

    assert [(i["id"], i["points"]) for i in ices] == [
        ("W03#R01#LOWEST", 101.3),
        ("W03#R02#LOWEST", 101.3),
    ]


def test_s7_two_zeros_and_lowest_on_one_roster():
    starters_points = [10] * len(SLOTS)
    starters_points[0] = 0
    starters_points[9] = -3
    ices = week_ices(3, [row(1, 60, starters_points=starters_points), row(2, 120)], SLOTS, ON)

    assert [i["id"] for i in ices] == ["W03#R01#LOWEST", "W03#R01#S0", "W03#R01#S9"]


def test_s8_rules_off_gives_nothing():
    w1 = golden_week(1)
    assert (
        week_ices(1, w1["matchups"], SLOTS, {"iceRulesActive": False, "lowestScope": "all"}) == []
    )


def test_s9_played_scope_skips_a_roster_with_no_matchup():
    rows = [row(1, 70, matchup_id=None), row(2, 90), row(3, 120)]

    def lowest_of(settings):
        return [
            i["rosterId"] for i in week_ices(15, rows, SLOTS, settings) if i["reason"] == "lowest"
        ]

    assert lowest_of({"iceRulesActive": True, "lowestScope": "played"}) == [2]
    assert lowest_of({"iceRulesActive": True, "lowestScope": "all"}) == [1]


def test_s11_null_starters_roster_is_skipped():
    # Real W3 data: roster 10 came back with starters null and 0 points
    # while its roster had a full lineup. Missing data, not an empty lineup.
    missing = row(1, 0, starters=None, starters_points=[])
    ices = week_ices(3, [missing, row(2, 90), row(3, 120)], SLOTS, ON)

    assert [i for i in ices if i["rosterId"] == 1] == []
    assert [i["rosterId"] for i in ices if i["reason"] == "lowest"] == [2]


def test_season_tally_from_real_weeks():
    w1, w2 = golden_week(1)["matchups"], golden_week(2)["matchups"]
    w3 = [{**m, "starters": ["0", *m["starters"][1:]]} if m["roster_id"] == 3 else m for m in w1]
    tally = {}
    for week, matchups in [(1, w1), (2, w2), (3, w3), (15, w2)]:
        for ice in week_ices(week, matchups, SLOTS, default_week_settings(week)):
            tally[ice["rosterId"]] = tally.get(ice["rosterId"], 0) + 1

    assert tally == {2: 2, 3: 1, 6: 4, 8: 2, 12: 3, 13: 2}
