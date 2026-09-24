import { describe, expect, it } from "vitest";

import { defaultFilters, FILTER_PARAM, type FilterField, readFilters, writeFilters } from "./filters";

const FIELDS: FilterField[] = [
  { key: "week", label: "Week", options: [{ value: "all", label: "All" }, { value: "1", label: "W1" }, { value: "3", label: "W3" }] },
  { key: "sort", label: "Sort", options: [{ value: "newest", label: "Newest" }, { value: "fastest", label: "Fastest time" }] },
];

describe("filter params", () => {
  it("writes only the fields off their default, in field order, and reads them back", () => {
    const param = writeFilters(FIELDS, { sort: "fastest", week: "3" });
    expect(param).toBe("week-3.sort-fastest");
    expect(FILTER_PARAM.test(param)).toBe(true);
    expect(readFilters(FIELDS, param)).toEqual({ week: "3", sort: "fastest" });
    expect(writeFilters(FIELDS, defaultFilters(FIELDS))).toBe("");
  });

  it("falls back to the default for a missing, unknown or malformed value", () => {
    expect(readFilters(FIELDS, "")).toEqual({ week: "all", sort: "newest" });
    expect(readFilters(FIELDS, "week-9.sort-slowest.team-4")).toEqual({ week: "all", sort: "newest" });
    expect(readFilters(FIELDS, "week")).toEqual({ week: "all", sort: "newest" });
  });

  it("only accepts dot-separated key-value pairs in a link", () => {
    for (const ok of ["week-3", "week-3.team-12.ice-zero"]) expect(FILTER_PARAM.test(ok)).toBe(true);
    for (const bad of ["", "week", "week-", "week-3.", "Week-3", "week-3,team-1", "week-3:team-1"]) expect(FILTER_PARAM.test(bad)).toBe(false);
  });
});
