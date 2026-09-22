import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubAudio } from "@/lib/test/audio-mock";

// The module keeps one AudioContext and the gesture flag at module scope, so
// each test loads a fresh copy.
const load = () => import("./sound");
let calls: ReturnType<typeof stubAudio>;

beforeEach(() => {
  vi.resetModules();
  window.localStorage.clear();
  calls = stubAudio();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sound", () => {
  it("creates no AudioContext before a user gesture", async () => {
    const sound = await load();
    sound.play("ding");
    expect(calls.contexts).toBe(0);

    window.dispatchEvent(new Event("pointerdown"));
    sound.play("ding");
    sound.play("chord");
    expect(calls.contexts).toBe(1);
    expect(calls.notes).toBeGreaterThan(0);
  });

  it("holds a deferred sound until the first gesture", async () => {
    const sound = await load();
    sound.playWhenAllowed("startup");
    expect(calls.notes).toBe(0);

    window.dispatchEvent(new Event("keydown"));
    expect(calls.notes).toBeGreaterThan(0);
  });

  it("stays silent while muted", async () => {
    const sound = await load();
    sound.setMuted(true);
    window.dispatchEvent(new Event("pointerdown"));
    sound.play("error");
    expect(calls.contexts).toBe(0);
  });

  it("remembers mute across loads", async () => {
    (await load()).setMuted(true);
    vi.resetModules();
    expect((await load()).isMuted()).toBe(true);
  });

  it("falls back to unmuted when storage throws", async () => {
    vi.spyOn(Object.getPrototypeOf(window.localStorage) as Storage, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Object.getPrototypeOf(window.localStorage) as Storage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const sound = await load();
    expect(sound.isMuted()).toBe(false);

    sound.setMuted(true);
    expect(sound.isMuted()).toBe(true);
  });
});
