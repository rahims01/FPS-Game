/**
 * First-match control hints. One at a time, at the moment it's useful, in the
 * player's own keys (or controller / touch buttons). A hint retires for good
 * once the player has done that thing twice, or after it has been shown three
 * times, so returning players never see it again. Progress lives in the
 * browser, like the rest of the profile.
 */
export type HintId = 'move' | 'swap' | 'reload' | 'lethal' | 'tactical' | 'knife' | 'scores' | 'pause';

interface Store {
  learned: Partial<Record<HintId, number>>;
  shown: Partial<Record<HintId, number>>;
}

const KEY = 'fps-hints-v1';
const SHOW_FOR = 6;
const GAP = 7;
const LEARNED_AFTER = 2;
const SHOW_AT_MOST = 3;

/** When each hint becomes due, in seconds alive this match. Reload is triggered by a low magazine instead. */
const DUE: [HintId, number][] = [
  ['move', 1.5],
  ['swap', 14],
  ['scores', 28],
  ['lethal', 40],
  ['knife', 55],
  ['tactical', 70],
  ['pause', 85]
];

const load = (): Store => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Store;
    return { learned: s.learned ?? {}, shown: s.shown ?? {} };
  } catch {
    return { learned: {}, shown: {} };
  }
};

export const resetHints = (): void => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
};

export interface HintContext {
  /** Seconds alive in this match (0 while dead). */
  aliveFor: number;
  /** Magazine fill, 0..1 (1 for melee-only). */
  ammo: number;
  reloading: boolean;
  /** Whether a hint may show right now (alive, not paused, no killcam or lineup). */
  ok: boolean;
  time: number;
}

export class Hints {
  private store = load();
  private active: { id: HintId; until: number } | null = null;
  private nextAt = 0;
  private dirty = false;

  constructor(private enabled: boolean) {}

  private retired(id: HintId): boolean {
    return (this.store.learned[id] ?? 0) >= LEARNED_AFTER || (this.store.shown[id] ?? 0) >= SHOW_AT_MOST;
  }

  /** The player did the thing: count it, and clear the hint if it's the one on screen. */
  learn(id: HintId): void {
    if (!this.enabled) return;
    this.store.learned[id] = (this.store.learned[id] ?? 0) + 1;
    this.dirty = true;
    if (this.active?.id === id) this.active = null;
  }

  /** The hint to show now, if any. */
  update(c: HintContext): HintId | null {
    if (!this.enabled) return null;
    if (this.active && (c.time > this.active.until || !c.ok)) this.active = null;
    if (!this.active && c.ok && c.time >= this.nextAt) {
      const lowAmmo = c.ammo <= 0.3 && !c.reloading && !this.retired('reload');
      const due = lowAmmo ? 'reload' : (DUE.find(([id, at]) => c.aliveFor >= at && !this.retired(id) && !this.seenThisMatch.has(id))?.[0] ?? null);
      if (due) {
        this.active = { id: due, until: c.time + SHOW_FOR };
        this.nextAt = c.time + SHOW_FOR + GAP;
        this.seenThisMatch.add(due);
        this.store.shown[due] = (this.store.shown[due] ?? 0) + 1;
        this.dirty = true;
      }
    }
    if (this.dirty) this.save();
    return this.active?.id ?? null;
  }

  private seenThisMatch = new Set<HintId>();

  private save(): void {
    this.dirty = false;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.store));
    } catch {
      /* storage unavailable: hints just repeat next time */
    }
  }
}
