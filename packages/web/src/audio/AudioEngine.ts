import * as MusicEngine from "./MusicEngine.js";
import * as AmbientEngine from "./AmbientEngine.js";

let ctx: AudioContext | null = null;

function getAudioContextCtor():
  | (new () => AudioContext)
  | null {
  const maybeCtor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: new () => AudioContext }).webkitAudioContext;
  return typeof maybeCtor === "function" ? maybeCtor : null;
}

function initContext() {
  const AudioContextCtor = getAudioContextCtor();
  if (!AudioContextCtor) {
    return null;
  }

  if (!ctx) {
    ctx = new AudioContextCtor();
  }
  if (ctx.state === "suspended") {
    ctx.resume();
  }
  return ctx;
}

export type SoundType = "success" | "error" | "click" | "revenue" | "opex";

export const music = {
  start: () => {
    const context = initContext();
    if (context) MusicEngine.startMusic(context);
  },
  stop: () => MusicEngine.stopMusic(),
};

export const ambient = {
  start: () => {
    const context = initContext();
    if (context) AmbientEngine.startAmbient(context);
  },
  stop: () => AmbientEngine.stopAmbient(),
  setUsage: (load: number) => AmbientEngine.setAmbientUsage(load),
};

export function playSound(type: SoundType, isMuted: boolean = false) {
  if (isMuted) return;

  try {
    const context = initContext();
    if (!context) {
      return;
    }

    const osc = context.createOscillator();
    const gain = context.createGain();

    osc.connect(gain);
    gain.connect(context.destination);

    const now = context.currentTime;

    if (type === "success") {
      // Positive chime
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1); // A5

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.5, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === "error") {
      // Negative buzzer
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.2);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.4, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === "click") {
      // Neutral blip (add rack)
      osc.type = "square";
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.05);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === "revenue") {
      // High-pitched "coin" chime
      osc.type = "triangle";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.05);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === "opex") {
      // Low-pitched "spending" thud
      osc.type = "sine";
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.linearRampToValueAtTime(50, now + 0.1);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.5, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (err) {
    // Fail softly if audio API is blocked by browser policy/runtime.
    console.warn("AudioContext playback failed", err);
  }
}
