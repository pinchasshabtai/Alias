export type SoundName = 'start' | 'tick' | 'correct' | 'skip' | 'win' | 'turnEnd';

const KEY = 'alias:muted';
let ctx: AudioContext | null = null;

export function isMuted(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(KEY, muted ? '1' : '0');
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event('alias:sound'));
}

function tone(freq: number, startAt: number, duration: number, type: OscillatorType = 'sine', volume = 0.15): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + startAt);
  gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + startAt);
  osc.stop(ctx.currentTime + startAt + duration + 0.05);
}

/** Tiny synthesized sounds, so the app ships no audio files. */
export function play(name: SoundName): void {
  if (isMuted() || typeof window === 'undefined') return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    switch (name) {
      case 'start':
        tone(523, 0, 0.12, 'triangle');
        tone(659, 0.12, 0.12, 'triangle');
        tone(784, 0.24, 0.25, 'triangle');
        break;
      case 'tick':
        tone(880, 0, 0.07, 'square', 0.08);
        break;
      case 'correct':
        tone(660, 0, 0.1, 'triangle');
        tone(990, 0.1, 0.18, 'triangle');
        break;
      case 'skip':
        tone(300, 0, 0.12, 'sawtooth', 0.07);
        break;
      case 'turnEnd':
        tone(440, 0, 0.18, 'sawtooth', 0.1);
        tone(330, 0.18, 0.3, 'sawtooth', 0.1);
        break;
      case 'win':
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.14, 0.2, 'triangle', 0.14));
        break;
    }
  } catch {
    /* audio not available */
  }
}
