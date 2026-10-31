/**
 * Killstreak rewards. Each player picks three in the loadout menu; reaching
 * a reward's kill count without dying calls it in.
 */
export type StreakId = 'adrenaline' | 'uav' | 'supply' | 'counter' | 'airstrike' | 'cluster' | 'jugg' | 'nuke' | 'godview' | 'banwave' | 'restart';

export interface StreakDef {
  id: StreakId;
  name: string;
  kills: number;
  blurb: string;
  /** The admin account only (and never in ranked or tournaments). */
  admin?: boolean;
}

export const KILLSTREAKS: StreakDef[] = [
  { id: 'adrenaline', name: 'Adrenaline', kills: 2, blurb: 'Full health and 20 s of faster movement.' },
  { id: 'uav', name: 'UAV', kills: 3, blurb: 'Enemies show on your minimap for 30 s.' },
  { id: 'supply', name: 'Supply Drop', kills: 4, blurb: 'Full health, full ammo and two more grenades.' },
  { id: 'counter', name: 'Counter-UAV', kills: 4, blurb: 'Jams enemy minimaps for 25 s and shakes off anyone tracking you.' },
  { id: 'airstrike', name: 'Airstrike', kills: 5, blurb: 'A bombing run on the nearest enemy.' },
  { id: 'cluster', name: 'Cluster Strike', kills: 7, blurb: 'Three airstrikes, one after another.' },
  { id: 'jugg', name: 'Juggernaut', kills: 8, blurb: 'Heavy armour: take less than half damage until you die.' },
  { id: 'nuke', name: 'Tactical Nuke', kills: 20, blurb: 'Every enemy dies and your side wins the match.' },
  { id: 'godview', name: 'God View', kills: 5, blurb: 'Every enemy on your team’s minimap for 45 s. Can’t be jammed.', admin: true },
  { id: 'banwave', name: 'Ban Wave', kills: 9, blurb: 'Lightning strikes down on up to four enemies.', admin: true },
  { id: 'restart', name: 'Server Restart', kills: 14, blurb: 'Every enemy freezes for 3 s while their game “reconnects”.', admin: true }
];

export const DEFAULT_STREAKS: StreakId[] = ['uav', 'airstrike', 'jugg'];
export const STREAK_SLOTS = 3;

export const streakDef = (id: StreakId): StreakDef => KILLSTREAKS.find((s) => s.id === id) ?? KILLSTREAKS[1];

/** A valid pick of three, sorted by kill count (bad or missing picks fall back to the defaults). */
export const normalizeStreaks = (ids: readonly string[] | undefined): StreakId[] => {
  const valid = (ids ?? []).filter((id, i, all): id is StreakId => KILLSTREAKS.some((s) => s.id === id) && all.indexOf(id) === i).slice(0, STREAK_SLOTS);
  const out = valid.length === STREAK_SLOTS ? valid : DEFAULT_STREAKS.slice();
  return out.sort((a, b) => streakDef(a).kills - streakDef(b).kills);
};
