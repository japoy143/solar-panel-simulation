import type { ProductCategory } from "@/lib/products";

/**
 * Tiny synthesized UI sounds (Web Audio, no audio files to download).
 * Safe to call anywhere: no-ops on the server or when audio is unavailable.
 */

let ctx: AudioContext | null = null;

function audio() {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/**
 * Browsers only let audio start inside a real user gesture (pointerdown, keydown…).
 * A drag-and-drop `drop` is NOT one, so a context first created there stays suspended
 * and stays silent. Create/resume it on the first gesture instead; returns a cleanup.
 */
export function unlockAudioOnGesture() {
  const unlock = () => {
    const ac = audio();
    if (ac?.state === "running") remove();
  };
  const events = ["pointerdown", "keydown", "touchend"] as const;
  const remove = () => events.forEach((e) => window.removeEventListener(e, unlock, true));
  events.forEach((e) => window.addEventListener(e, unlock, true));
  return remove;
}

type Blip = { freq: number; endFreq?: number; at?: number; dur?: number; gain?: number; type?: OscillatorType };

/** A short pitched blip with a fast attack and exponential decay. */
function blip(ac: AudioContext, { freq, endFreq = freq, at = 0, dur = 0.12, gain = 0.18, type = "sine" }: Blip) {
  const t = ac.currentTime + at;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** "Snap into place" sound, voiced per product category. */
export function playPlace(category: ProductCategory) {
  const ac = audio();
  if (!ac) return;
  switch (category) {
    case "panel": // light glassy click
      blip(ac, { freq: 1400, endFreq: 900, dur: 0.07, gain: 0.12, type: "triangle" });
      blip(ac, { freq: 2100, at: 0.03, dur: 0.06, gain: 0.05 });
      break;
    case "inverter": // mid thunk
      blip(ac, { freq: 520, endFreq: 260, dur: 0.12, gain: 0.2, type: "triangle" });
      break;
    case "battery": // low, heavy thud plus a charge-up chirp
      blip(ac, { freq: 220, endFreq: 110, dur: 0.18, gain: 0.25 });
      blip(ac, { freq: 660, endFreq: 990, at: 0.08, dur: 0.1, gain: 0.06, type: "triangle" });
      break;
  }
}

/** Rising arpeggio for "Fill roof". */
export function playFill() {
  const ac = audio();
  if (!ac) return;
  [784, 988, 1175, 1568].forEach((freq, i) =>
    blip(ac, { freq, at: i * 0.06, dur: 0.14, gain: 0.1, type: "triangle" }),
  );
}

/** Power-up sweep when the system is fully assembled. */
export function playPowerUp() {
  const ac = audio();
  if (!ac) return;
  blip(ac, { freq: 180, endFreq: 720, dur: 0.45, gain: 0.12, type: "sawtooth" });
  blip(ac, { freq: 360, endFreq: 1440, at: 0.05, dur: 0.4, gain: 0.05, type: "triangle" });
  [1047, 1319, 1568].forEach((freq, i) =>
    blip(ac, { freq, at: 0.38 + i * 0.07, dur: 0.22, gain: 0.08, type: "triangle" }),
  );
}
