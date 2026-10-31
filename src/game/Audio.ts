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
  mpistol: { bright: 1.3, length: 0.6, pitch: 1.5, gain: 0.75 },
  sovereign: { bright: 1.05, length: 1.05, pitch: 0.9, gain: 1.1 },
  sovburst: { bright: 1.05, length: 0.95, pitch: 1, gain: 1.05 },
  moderator: { bright: 0.9, length: 1.8, pitch: 0.7, gain: 1.3 },
  kick: { bright: 0.65, length: 2, pitch: 0.6, gain: 1.4 },
  permaban: { bright: 1.4, length: 3.2, pitch: 0.45, gain: 1.5 },
  gavel: { bright: 0.85, length: 1.7, pitch: 0.65, gain: 1.4 }
};

/**
 * Synthesised sound (no audio files): gunshots, hit markers, reloads, pickups.
 * Positional sounds are attenuated by distance and panned by bearing, and
 * everything shares one room reverb, with more of it on far-away sounds.
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private master: GainNode | null = null;
  /** The shared reverb send. */
  private verb: GainNode | null = null;
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
    // Room reverb: a 1.4 s decaying noise impulse, a little darker in the tail.
    const ir = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 1.4), ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < ch.length; i++) {
        const k = i / ch.length;
        lp += ((Math.random() * 2 - 1) - lp) * (0.6 - k * 0.45);
        ch[i] = lp * Math.pow(1 - k, 2.6);
      }
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    this.verb = ctx.createGain();
    this.verb.gain.value = 0.55;
    this.verb.connect(conv).connect(this.master);
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  /** A sound's output: level, stereo position, and how much goes to the room reverb (0..1). */
  private out(gain: number, pan: number, wet = 0.15): GainNode | null {
    const ctx = this.ctx;
    if (!ctx || !this.master) return null;
    const g = ctx.createGain();
    g.gain.value = gain;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p).connect(this.master);
    if (this.verb && wet > 0) {
      const send = ctx.createGain();
      send.gain.value = wet;
      p.connect(send).connect(this.verb);
    }
    return g;
  }

  /** A burst of filtered noise: the building block of clicks, cracks and rustles. */
  private burst(out: AudioNode, at: number, type: BiquadFilterType, freq: number, dur: number, gain: number, q = 1, sweepTo?: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, at);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + dur);
    f.Q.value = q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, at);
    env.gain.exponentialRampToValueAtTime(0.001, at + dur);
    src.connect(f).connect(env).connect(out);
    src.start(at, Math.random() * 0.3, dur + 0.02);
  }

  /**
   * distance in metres, pan -1..1. own = the player's own weapon. behind: the
   * shooter is behind you (the sound comes through muffled).
   */
  gunshot(distance: number, pan: number, own: boolean, weapon: WeaponId = 'rifle', behind = false, suppressed = false): void {
    const tone = GUN_TONE[weapon] ?? GUN_TONE.rifle;
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    // A suppressor: much quieter, and the crack becomes a dull thud.
    const att = (own ? 1 : Math.min(0.8, 6 / (distance + 6))) * (suppressed ? 0.3 : 1);
    if (suppressed) behind = true;
    if (att < 0.02) return;
    // Far shots are mostly room; your own is mostly dry.
    const out = this.out(att, own ? 0 : pan, own ? 0.12 : Math.min(0.7, 0.18 + distance * 0.012));
    if (!out) return;
    const t = ctx.currentTime;
    // The Gavel: a wooden courtroom knock under the shot.
    if (weapon === 'gavel') {
      this.burst(out, t + 0.01, 'bandpass', 420, 0.09, 1.4, 3);
      this.burst(out, t + 0.12, 'bandpass', 380, 0.07, 0.9, 3);
    }
    // The Permaban: a rising electric whine.
    if (weapon === 'permaban') this.burst(out, t, 'bandpass', 900, 0.35, 0.5, 8, 4200);
    // The supersonic crack up close; behind you it's dulled.
    if (own || distance < 25) this.burst(out, t, 'highpass', behind ? 1800 : 3200, 0.018, (own ? 0.7 : 0.5) * tone.gain);
    // Your own gun: the bolt cycling.
    if (own) {
      this.burst(out, t + 0.035 * tone.length, 'bandpass', 2600, 0.025, 0.18, 4);
      this.burst(out, t + 0.06 * tone.length, 'bandpass', 1700, 0.03, 0.12, 4);
    }
    // Far away: the shot comes back off the walls.
    if (!own && distance > 30) {
      const echo = this.out(att * 0.35, -pan * 0.5, 0.6);
      if (echo) this.burst(echo, t + 0.12 + distance * 0.002, 'lowpass', 700, 0.3, 0.6);
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'lowpass';
    // Distant shots lose their crack.
    bp.frequency.value = (own ? 5200 : Math.max(900, 5000 - distance * 60)) * tone.bright * (behind ? 0.55 : 1);
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

  /** The hit marker "tick": a short bright click, sharper on headshots, with a chime on kills, over a body thud. */
  hitMarker(head: boolean, kill: boolean): void {
    const ctx = this.ctx;
    const thud = this.out(0.35, 0, 0.05);
    if (ctx && thud && this.noise) this.burst(thud, ctx.currentTime, 'lowpass', 380, 0.07, 1);
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

  /** Taking a hit: a dull body impact and a short breathy grunt. */
  hurt(): void {
    const ctx = this.ctx;
    const out = this.out(0.55, 0, 0.05);
    if (!ctx || !out || !this.noise) return;
    const t = ctx.currentTime;
    this.burst(out, t, 'lowpass', 260, 0.12, 1.2);
    this.burst(out, t + 0.02, 'bandpass', 520, 0.16, 0.5, 2, 380);
  }

  /** Reload: magazine out, magazine in, bolt back and forward. */
  reload(): void {
    const ctx = this.ctx;
    const out = this.out(0.3, 0, 0.08);
    if (!ctx || !out || !this.noise) return;
    const t = ctx.currentTime;
    this.burst(out, t + 0.15, 'bandpass', 1800, 0.04, 0.8, 5);
    this.burst(out, t + 0.22, 'bandpass', 900, 0.18, 0.25, 1.5, 600);
    this.burst(out, t + 1.15, 'bandpass', 1300, 0.05, 1, 6);
    this.burst(out, t + 1.2, 'lowpass', 500, 0.05, 0.6);
    this.burst(out, t + 1.75, 'bandpass', 2400, 0.03, 0.8, 6);
    this.burst(out, t + 1.9, 'bandpass', 3000, 0.035, 1, 6);
  }

  /** A bullet passing close by: a quick airy zip, on the side it passed. */
  whiz(pan: number): void {
    const ctx = this.ctx;
    const out = this.out(0.28, pan, 0.05);
    if (!ctx || !out || !this.noise) return;
    this.burst(out, ctx.currentTime, 'bandpass', 4200, 0.12, 1, 6, 1600);
  }

  /** Low health: a heartbeat (two soft thumps). */
  heartbeat(): void {
    const ctx = this.ctx;
    const out = this.out(0.45, 0, 0);
    if (!ctx || !out) return;
    const t = ctx.currentTime;
    for (const [at, f] of [[0, 62], [0.17, 52]] as const) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(f, t + at);
      o.frequency.exponentialRampToValueAtTime(30, t + at + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t + at);
      g.gain.linearRampToValueAtTime(0.9, t + at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + at + 0.14);
      o.connect(g).connect(out);
      o.start(t + at);
      o.stop(t + at + 0.15);
    }
  }

  pickup(): void {
    this.beep(660, 0.1, 0.2, 'sine');
    this.beep(990, 0.16, 0.2, 'sine', 0.08);
  }

  /** Explosion: noise burst plus a deep boom, muffled with distance. */
  explosion(distance: number, pan: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    const out = this.out(Math.min(1.2, 14 / (distance + 8)), pan, 0.5);
    if (!out) return;
    const t = ctx.currentTime;
    // Debris rattling down afterwards.
    for (let i = 0; i < 6; i++) this.burst(out, t + 0.25 + Math.random() * 0.6, 'bandpass', 1200 + Math.random() * 2500, 0.04, 0.12, 3);
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
    const out = this.out(g, pan, 0.1);
    if (!out) return;
    const t = ctx.currentTime;
    // Heel, then toe, with a little gear rattle.
    this.burst(out, t, 'lowpass', 420 + Math.random() * 260, 0.08, 1);
    this.burst(out, t + 0.05 + Math.random() * 0.02, 'lowpass', 700 + Math.random() * 300, 0.05, 0.5);
    if (Math.random() < 0.4) this.burst(out, t + 0.03, 'bandpass', 3000 + Math.random() * 1500, 0.03, 0.12, 4);
  }

  /** Switching weapons: a cloth rustle and the new gun clicking into place. */
  weaponSwitch(): void {
    const ctx = this.ctx;
    const out = this.out(0.25, 0, 0.05);
    if (!ctx || !out || !this.noise) return;
    const t = ctx.currentTime;
    this.burst(out, t, 'bandpass', 1100, 0.15, 0.35, 1, 700);
    this.burst(out, t + 0.16, 'bandpass', 2200, 0.03, 0.8, 6);
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
    const ctx = this.ctx;
    const out = this.out(0.3, 0, 0.03);
    if (!ctx || !out || !this.noise) return;
    this.burst(out, ctx.currentTime, 'bandpass', 2800, 0.025, 1, 8);
  }
}
