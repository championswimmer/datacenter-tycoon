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

export function startAmbient(audioCtx: AudioContext) {
  init(audioCtx);
  if (!ctx || !masterGain) return;

  masterGain.gain.setTargetAtTime(0.05, ctx.currentTime, 1.0);
}

export function stopAmbient() {
  if (ctx && masterGain) {
    masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
  }
}

/**
 * Modulates the hum based on load (0 to 1).
 */
export function setAmbientUsage(load: number) {
  if (!ctx || !filter || !masterGain) return;

  const cappedLoad = Math.max(0, Math.min(1, load));

  // Increase filter cutoff with load (200Hz to 2000Hz)
  const cutoff = 200 + cappedLoad * 1800;
  filter.frequency.setTargetAtTime(cutoff, ctx.currentTime, 0.2);

  // Slightly increase volume with load
  const volume = 0.05 + cappedLoad * 0.05;
  masterGain.gain.setTargetAtTime(volume, ctx.currentTime, 0.5);
}
