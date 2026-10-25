import type { WeaponId } from '../sim/weapons';

/** How each weapon's shot differs from the rifle's: filter brightness, length, low-end pitch, loudness. */
const GUN_TONE: Record<string, { bright: number; length: number; pitch: number; gain: number }> = {
  rifle: { bright: 1, length: 1, pitch: 1, gain: 1 },
  smg: { bright: 1.15, length: 0.7, pitch: 1.3, gain: 0.8 },
  shotgun: { bright: 0.7, length: 1.8, pitch: 0.7, gain: 1.3 },
  sniper: { bright: 0.9, length: 2.4, pitch: 0.6, gain: 1.4 },
  lmg: { bright: 0.85, length: 1.1, pitch: 0.85, gain: 1.05 },
  pistol: { bright: 1.25, length: 0.8, pitch: 1.4, gain: 0.85 },
  ak: { bright: 0.85, length: 1.15, pitch: 0.8, gain: 1.15 },
  burst: { bright: 1.05, length: 0.9, pitch: 1.1, gain: 0.95 },
  dmr: { bright: 0.95, length: 1.7, pitch: 0.75, gain: 1.25 },
  revolver: { bright: 0.9, length: 1.6, pitch: 0.75, gain: 1.3 },
  scar: { bright: 0.85, length: 1.35, pitch: 0.75, gain: 1.2 },
  uzi: { bright: 1.25, length: 0.6, pitch: 1.45, gain: 0.75 },
  autoshotgun: { bright: 0.75, length: 1.5, pitch: 0.75, gain: 1.25 },
  barrett: { bright: 0.75, length: 3, pitch: 0.5, gain: 1.6 },
  deagle: { bright: 0.95, length: 1.5, pitch: 0.8, gain: 1.3 },
  mpistol: { bright: 1.3, length: 0.6, pitch: 1.5, gain: 0.75 }
};

/**
 * Synthesised sound (no audio files): gunshots, hit markers, reloads, pickups.
 * Positional sounds are attenuated by distance and panned by bearing.
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private master: GainNode | null = null;
  volume = 0.6;

  /** Must be called from a user gesture (browsers block audio until then). */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    const len = ctx.sampleRate * 0.5;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  private out(gain: number, pan: number): GainNode | null {
    const ctx = this.ctx;
    if (!ctx || !this.master) return null;
    const g = ctx.createGain();
    g.gain.value = gain;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p).connect(this.master);
    return g;
  }

  /** distance in metres, pan -1..1. own = the player's own weapon. */
  gunshot(distance: number, pan: number, own: boolean, weapon: WeaponId = 'rifle'): void {
    const tone = GUN_TONE[weapon] ?? GUN_TONE.rifle;
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    const att = own ? 1 : Math.min(0.8, 6 / (distance + 6));
    if (att < 0.02) return;
    const out = this.out(att, own ? 0 : pan);
    if (!out) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'lowpass';
    // Distant shots lose their crack.
    bp.frequency.value = (own ? 5200 : Math.max(900, 5000 - distance * 60)) * tone.bright;
    const env = ctx.createGain();
    env.gain.setValueAtTime(tone.gain, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + (own ? 0.16 : 0.22) * tone.length);
    src.connect(bp).connect(env).connect(out);
    src.start(t, Math.random() * 0.3, 0.3);
    const thump = ctx.createOscillator();
    thump.frequency.setValueAtTime((own ? 140 : 110) * tone.pitch, t);
    thump.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime((own ? 0.9 : 0.6) * tone.gain, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.14 * tone.length);
    thump.connect(tg).connect(out);
    thump.start(t);
    thump.stop(t + 0.15 * tone.length);
  }

  private beep(freq: number, dur: number, gain: number, type: OscillatorType = 'square', delay = 0): void {
    const ctx = this.ctx;
    const out = this.out(gain, 0);
    if (!ctx || !out) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur);
  }

  /** The hit marker "tick": a short bright click, sharper on headshots, with a chime on kills. */
  hitMarker(head: boolean, kill: boolean): void {
    this.click(head ? 0.32 : 0.22, head ? 5200 : 3800);
    if (head) this.click(0.2, 7000, 0.035);
    if (kill) {
      this.beep(880, 0.08, 0.25, 'triangle');
      this.beep(1320, 0.14, 0.25, 'triangle', 0.06);
    }
  }

  private click(gain: number, freq: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    const out = this.out(gain, 0);
    if (!out) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 3;
    const env = ctx.createGain();
    env.gain.setValueAtTime(1, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    src.connect(bp).connect(env).connect(out);
    src.start(t, Math.random() * 0.3, 0.06);
  }

  hurt(): void {
    this.beep(90, 0.18, 0.5, 'sawtooth');
  }

  reload(): void {
    this.beep(520, 0.03, 0.15, 'square', 0.15);
    this.beep(380, 0.04, 0.15, 'square', 1.2);
    this.beep(700, 0.04, 0.18, 'square', 1.9);
  }

  pickup(): void {
    this.beep(660, 0.1, 0.2, 'sine');
    this.beep(990, 0.16, 0.2, 'sine', 0.08);
  }

  /** Explosion: noise burst plus a deep boom, muffled with distance. */
  explosion(distance: number, pan: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    const out = this.out(Math.min(1.2, 14 / (distance + 8)), pan);
    if (!out) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.max(500, 3000 - distance * 40), t);
    lp.frequency.exponentialRampToValueAtTime(200, t + 0.8);
    const env = ctx.createGain();
    env.gain.setValueAtTime(1.4, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 1);
    src.connect(lp).connect(env).connect(out);
    src.start(t);
    src.stop(t + 1);
    const boom = ctx.createOscillator();
    boom.frequency.setValueAtTime(80, t);
    boom.frequency.exponentialRampToValueAtTime(25, t + 0.6);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(1.2, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    boom.connect(bg).connect(out);
    boom.start(t);
    boom.stop(t + 0.7);
  }

  knife(): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    const out = this.out(0.35, 0);
    if (!out) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1500, t);
    bp.frequency.exponentialRampToValueAtTime(5000, t + 0.15);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, t);
    env.gain.linearRampToValueAtTime(1, t + 0.05);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(bp).connect(env).connect(out);
    src.start(t, Math.random() * 0.2, 0.2);
  }

  /** A footstep at `distance` metres; quieter when crouching or far away. */
  footstep(distance: number, pan: number, volume: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    const g = (volume * 0.35) / (1 + distance * 0.25);
    if (g < 0.01) return;
    const out = this.out(g, pan);
    if (!out) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500 + Math.random() * 300;
    const env = ctx.createGain();
    env.gain.setValueAtTime(1, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    src.connect(lp).connect(env).connect(out);
    src.start(t, Math.random() * 0.3, 0.1);
  }

  weaponSwitch(): void {
    this.beep(300, 0.03, 0.12, 'square');
    this.beep(450, 0.03, 0.12, 'square', 0.12);
  }

  /** Killstreak / big medal fanfare. */
  fanfare(): void {
    this.beep(523, 0.12, 0.2, 'triangle');
    this.beep(659, 0.12, 0.2, 'triangle', 0.1);
    this.beep(784, 0.25, 0.22, 'triangle', 0.2);
  }

  medal(): void {
    this.beep(1046, 0.08, 0.12, 'sine');
  }

  /** Incoming airstrike whistle. */
  whistle(): void {
    const ctx = this.ctx;
    const out = this.out(0.25, 0);
    if (!ctx || !out) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(2400, t);
    o.frequency.exponentialRampToValueAtTime(500, t + 1.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.8, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.9);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 2);
  }

  dryFire(): void {
    this.beep(1200, 0.02, 0.1, 'square');
  }
}
