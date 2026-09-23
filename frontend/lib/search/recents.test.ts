import { afterEach, describe, expect, it, vi } from "vitest";

import { loadRecents, saveRecent } from "./recents";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("recents", () => {
  it("keeps the latest pick first, without duplicates, capped at five", () => {
    for (const id of ["a", "b", "c", "d", "e", "f", "b"]) saveRecent(id);
    expect(loadRecents()).toEqual(["b", "f", "e", "d", "c"]);
  });

  it("starts empty and ignores junk in storage", () => {
    expect(loadRecents()).toEqual([]);
    window.localStorage.setItem("smirnoff:palette-recents", "{not json");
    expect(loadRecents()).toEqual([]);
    window.localStorage.setItem("smirnoff:palette-recents", JSON.stringify({ a: 1 }));
    expect(loadRecents()).toEqual([]);
  });

  it("carries on when storage is blocked", () => {
    vi.spyOn(Object.getPrototypeOf(window.localStorage) as Storage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Object.getPrototypeOf(window.localStorage) as Storage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => saveRecent("a")).not.toThrow();
    expect(loadRecents()).toEqual([]);
  });
});
