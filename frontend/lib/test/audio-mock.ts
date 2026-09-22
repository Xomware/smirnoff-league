import { vi } from "vitest";

const param = () => ({
  value: 0,
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
});

// Just enough of WebAudio for the sound recipes, counting contexts and notes.
export function stubAudio() {
  const calls = { contexts: 0, notes: 0 };
  vi.stubGlobal(
    "AudioContext",
    class {
      currentTime = 0;
      state = "running";
      destination = {};
      constructor() {
        calls.contexts += 1;
      }
      resume = vi.fn(async () => {});
      createGain = () => ({ gain: param(), connect: vi.fn() });
      createOscillator = () => ({
        type: "sine",
        frequency: param(),
        connect: vi.fn(),
        start: () => {
          calls.notes += 1;
        },
        stop: vi.fn(),
      });
    },
  );
  return calls;
}
