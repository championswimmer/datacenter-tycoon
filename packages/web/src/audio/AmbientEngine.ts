/**
 * Generates a continuous "hum" that represents server usage.
 */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let filter: BiquadFilterNode | null = null;
let oscillator: OscillatorNode | null = null;

function init(audioCtx: AudioContext) {
  if (!ctx) {
    ctx = audioCtx;
    masterGain = ctx.createGain();
    filter = ctx.createBiquadFilter();
    oscillator = ctx.createOscillator();

    // Use a complex wave for a more industrial hum
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(55, ctx.currentTime); // A1 - low hum

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(200, ctx.currentTime);
    filter.Q.setValueAtTime(1, ctx.currentTime);

    oscillator.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(ctx.destination);

    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    oscillator.start();
  }
}

let currentLoad = 0;
let currentScale = 0;
let isPaused = false;

function updateVolume() {
  if (!ctx || !masterGain) return;

  if (isPaused || currentScale === 0) {
    masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    return;
  }

  // Slightly increase volume with load and scale
  // Base volume 0.05, +0.005 per server (capped at 0.1 extra)
  const volumeScale = Math.min(0.1, currentScale * 0.005);
  const volume = 0.05 + currentLoad * 0.05 + volumeScale;
  masterGain.gain.setTargetAtTime(volume, ctx.currentTime, 0.5);
}

export function startAmbient(audioCtx: AudioContext) {
  init(audioCtx);
  updateVolume();
}

export function stopAmbient() {
  if (ctx && masterGain) {
    masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
  }
}

/**
 * Adjusts the hum pitch based on game speed factor.
 */
export function setAmbientSpeed(factor: number) {
  if (!ctx || !oscillator) return;
  const freq = 55 * factor;
  oscillator.frequency.setTargetAtTime(freq, ctx.currentTime, 0.5);
}

/**
 * Handles pausing the ambient hum.
 */
export function setAmbientPaused(paused: boolean) {
  isPaused = paused;
  updateVolume();
}

/**
 * Modulates the hum based on load (0 to 1) and infrastructure scale.
 */
export function setAmbientUsage(load: number, scale: number = 0) {
  currentLoad = Math.max(0, Math.min(1, load));
  currentScale = scale;

  if (!ctx || !filter) return;

  // Increase filter cutoff with load (200Hz to 2000Hz) 
  // and scale (+10Hz per server, capped at 1000Hz extra)
  const scaleEffect = Math.min(1000, currentScale * 10);
  const cutoff = 200 + currentLoad * 1800 + scaleEffect;
  filter.frequency.setTargetAtTime(cutoff, ctx.currentTime, 0.2);

  updateVolume();
}
