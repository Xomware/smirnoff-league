import { afterEach, describe, expect, it, vi } from "vitest";

import { loadLayout, saveLayout } from "./persist";
import { defaultLayout } from "./windows";

const realStorage = localStorage;

afterEach(() => {
  realStorage.clear();
  vi.stubGlobal("localStorage", realStorage);
});

describe("saved layout", () => {
  it("round-trips per user", () => {
    const layout = defaultLayout(1440, 900).map((w) => (w.id === "writeup" ? { ...w, x: 7, minimized: true } : w));

    saveLayout("user-a", layout);

    expect(loadLayout("user-a")).toEqual(layout);
    expect(loadLayout("user-b")).toBeNull();
  });

  it("returns null for corrupt JSON or a non-array", () => {
    realStorage.setItem("smirnoff.desktop.v2:u", "{not json");
    expect(loadLayout("u")).toBeNull();

    realStorage.setItem("smirnoff.desktop.v2:u", JSON.stringify({ kind: "home" }));
    expect(loadLayout("u")).toBeNull();
  });

  it("drops windows whose kind no longer exists", () => {
    const [home] = defaultLayout(1440, 900);
    realStorage.setItem("smirnoff.desktop.v2:u", JSON.stringify([home, { ...home, id: "gone", kind: "gone" }]));

    expect(loadLayout("u")).toEqual([home]);
  });

  it("resets a layout saved before the ice-first default, once", () => {
    const old = [{ ...defaultLayout(1440, 900)[0], id: "standings", kind: "standings" }];
    realStorage.setItem("smirnoff.desktop.v1:u", JSON.stringify(old));

    expect(loadLayout("u")).toBeNull();

    const layout = defaultLayout(1440, 900);
    saveLayout("u", layout);
    expect(loadLayout("u")).toEqual(layout);
  });

  it("falls back when storage throws", () => {
    const fail = () => {
      throw new DOMException("denied", "SecurityError");
    };
    vi.stubGlobal("localStorage", { getItem: fail, setItem: fail });

    expect(loadLayout("u")).toBeNull();
    expect(() => saveLayout("u", defaultLayout(1440, 900))).not.toThrow();
  });
});
