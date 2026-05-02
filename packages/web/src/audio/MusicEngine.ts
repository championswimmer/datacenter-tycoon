/**
 * A simple retro-style music engine that generates procedural melodies.
 */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let sequencerInterval: number | null = null;

const SCALE = [
  261.63, // C4
  293.66, // D4
  329.63, // E4
  349.23, // F4
  392.00, // G4
  440.00, // A4
  493.88, // B4
  523.25, // C5
];

// Simple rhythmic patterns (durations in seconds)
const PATTERNS = [
  [0.25, 0.25, 0.5],
  [0.5, 0.5],
  [0.25, 0.25, 0.25, 0.25],
];

let currentStep = 0;
let patternIndex = 0;

function init(audioCtx: AudioContext) {
  if (!ctx) {
    ctx = audioCtx;
    masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
  }
}

function playNote(freq: number, startTime: number, duration: number) {
  if (!ctx || !masterGain) return;

  const osc = ctx.createOscillator();
  const noteGain = ctx.createGain();

  // Retro feel: square or pulse-like wave
  osc.type = "square";
  osc.frequency.setValueAtTime(freq, startTime);

  noteGain.gain.setValueAtTime(0, startTime);
  noteGain.gain.linearRampToValueAtTime(0.1, startTime + 0.02);
  noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(noteGain);
  noteGain.connect(masterGain);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

export function startMusic(audioCtx: AudioContext) {
  if (sequencerInterval) return;
  init(audioCtx);

  if (!ctx || !masterGain) return;

  // Fade in master music volume
  masterGain.gain.setTargetAtTime(0.3, ctx.currentTime, 0.5);

  const tickTime = 0.25; // Base 16th note roughly
  let nextNoteTime = ctx.currentTime;

  sequencerInterval = window.setInterval(() => {
    if (!ctx) return;
    
    // Schedule ahead to avoid jitter
    while (nextNoteTime < ctx.currentTime + 0.1) {
      const pattern = PATTERNS[patternIndex % PATTERNS.length]!;
      const duration = pattern[currentStep % pattern.length]! * 1.5;
      
      // Pseudo-random melody from scale
      const noteFreq = SCALE[Math.floor(Math.random() * SCALE.length)]!;
      
      playNote(noteFreq, nextNoteTime, duration);
      
      nextNoteTime += duration;
      currentStep++;
      
      if (currentStep % 4 === 0) {
        patternIndex++;
      }
    }
  }, 50) as unknown as number;
}

export function stopMusic() {
  if (sequencerInterval) {
    window.clearInterval(sequencerInterval);
    sequencerInterval = null;
  }

  if (ctx && masterGain) {
    masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
  }
}
