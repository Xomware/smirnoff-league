// Every sound is synthesized here. Never ship or fetch Microsoft's audio files.
export type SoundName = "ding" | "chord" | "notify" | "error" | "startup";

interface Note {
  freq: number;
  at: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
}

const RECIPES: Record<SoundName, Note[]> = {
  ding: [
    { freq: 1318.5, at: 0, dur: 0.5 },
    { freq: 2637, at: 0, dur: 0.25, gain: 0.08 },
  ],
  chord: [523.3, 659.3, 784, 1046.5].map((freq) => ({ freq, at: 0, dur: 0.9, type: "triangle", gain: 0.1 })),
  notify: [
    { freq: 880, at: 0, dur: 0.18 },
    { freq: 1174.7, at: 0.12, dur: 0.3 },
  ],
  error: [
    { freq: 196, at: 0, dur: 0.35, type: "square", gain: 0.07 },
    { freq: 207.7, at: 0, dur: 0.35, type: "square", gain: 0.07 },
  ],
  startup: [
    ...[311.1, 466.2, 622.3, 784, 932.3].map((freq, i) => ({ freq, at: i * 0.18, dur: 0.6, type: "triangle" as const, gain: 0.12 })),
    ...[155.6, 233.1, 311.1].map((freq) => ({ freq, at: 0.8, dur: 1.8, gain: 0.08 })),
  ],
};

const MUTE_KEY = "smirnoff:muted";

let ctx: AudioContext | null = null;
let gestured = false;
let listening = false;
let pending: SoundName | null = null;
let muted: boolean | null = null;
const muteListeners = new Set<() => void>();

// Browsers refuse audio until the user interacts, and an AudioContext made
// earlier starts suspended and warns, so nothing is created before a gesture.
function listenForGesture() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  const onGesture = () => {
    gestured = true;
    window.removeEventListener("pointerdown", onGesture, true);
    window.removeEventListener("keydown", onGesture, true);
    if (pending) play(pending);
    pending = null;
  };
  window.addEventListener("pointerdown", onGesture, true);
  window.addEventListener("keydown", onGesture, true);
}

const allowed = () => gestured || (typeof navigator !== "undefined" && navigator.userActivation?.hasBeenActive === true);

export function play(name: SoundName) {
  listenForGesture();
  if (isMuted() || !allowed() || typeof AudioContext === "undefined") return;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  const now = ctx.currentTime;
  for (const note of RECIPES[name]) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const start = now + note.at;
    osc.type = note.type ?? "sine";
    osc.frequency.setValueAtTime(note.freq, start);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(note.gain ?? 0.15, start + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, start + note.dur);
    osc.connect(env);
    env.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + note.dur);
  }
}

export function playWhenAllowed(name: SoundName) {
  listenForGesture();
  if (allowed()) return play(name);
  pending = name;
}

// Storage can throw (private mode, blocked cookies). Then mute lives in memory
// for the session and the default is unmuted, still silent until a gesture.
export function isMuted(): boolean {
  if (muted !== null) return muted;
  try {
    muted = window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    muted = false;
  }
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    window.localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    // Kept in memory above; it just won't survive a reload.
  }
  muteListeners.forEach((fn) => fn());
}

export function subscribeMuted(fn: () => void) {
  muteListeners.add(fn);
  return () => {
    muteListeners.delete(fn);
  };
}
