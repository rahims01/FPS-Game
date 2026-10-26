import type { StatKey } from './cosmetics';

/**
 * Persistent player progression: XP, levels and ranks, saved in this browser.
 * Medals award XP during a match; the total is banked when the match ends.
 */

const KEY = 'fps-profile-v1';

export interface Profile {
  xp: number;
  matches: number;
  wins: number;
  kills: number;
  deaths: number;
  /** Kills with each weapon (unlocks its skins). */
  weaponKills: Record<string, number>;
  /** Ranked skill rating, placement progress and record. */
  sr: number;
  bestSr: number;
  rankedMatches: number;
  rankedWins: number;
  /** Lifetime stats that badges are earned from. */
  stats: Partial<Record<StatKey, number>>;
  /** Times you reset from level 55 (0..10). */
  prestige: number;
  /** Gunfight tournaments won, and the best finish (1 = won). */
  tourneyWins: number;
  /** Ranked 1v1: its own rating and record. */
  duelSr: number;
  duelBestSr: number;
  duelMatches: number;
  duelWins: number;
}

export const loadProfile = (): Profile => {
  const base: Profile = { xp: 0, matches: 0, wins: 0, kills: 0, deaths: 0, weaponKills: {}, sr: 1000, bestSr: 1000, rankedMatches: 0, rankedWins: 0, stats: {}, prestige: 0, tourneyWins: 0, duelSr: 1000, duelBestSr: 1000, duelMatches: 0, duelWins: 0 };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { ...base, ...raw, weaponKills: { ...(raw.weaponKills ?? {}) }, stats: { ...(raw.stats ?? {}) } };
  } catch {
    return base;
  }
};

export const saveProfile = (p: Profile): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: progress just isn't kept */
  }
};

/** Total XP needed to reach `level` (level 1 needs 0). Each level costs 250 more than the last. */
export const xpForLevel = (level: number): number => 125 * level * (level - 1);

export const MAX_LEVEL = 55;

export const levelOf = (xp: number): { level: number; into: number; need: number } => {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  const base = xpForLevel(level);
  const next = level < MAX_LEVEL ? xpForLevel(level + 1) : base;
  return { level, into: xp - base, need: Math.max(1, next - base) };
};

const RANKS = [
  'Recruit',
  'Private',
  'Private First Class',
  'Corporal',
  'Sergeant',
  'Staff Sergeant',
  'Master Sergeant',
  'Lieutenant',
  'Captain',
  'Major',
  'Colonel',
  'Brigadier',
  'General',
  'Commander',
  'Legend'
];

export const rankOf = (level: number): string => RANKS[Math.min(RANKS.length - 1, Math.floor((level - 1) / 4))];

export interface Medal {
  name: string;
  xp: number;
  /** Rarer medals get a bigger popup. */
  big?: boolean;
}

export const MEDALS = {
  kill: { name: 'Kill', xp: 100 },
  headshot: { name: 'Headshot', xp: 50 },
  double: { name: 'Double Kill', xp: 50, big: true },
  triple: { name: 'Triple Kill', xp: 100, big: true },
  multi: { name: 'Multi Kill', xp: 150, big: true },
  spree: { name: 'Killing Spree', xp: 100, big: true },
  unstoppable: { name: 'Unstoppable', xp: 200, big: true },
  godlike: { name: 'Godlike', xp: 300, big: true },
  firstBlood: { name: 'First Blood', xp: 100, big: true },
  revenge: { name: 'Revenge', xp: 50 },
  longshot: { name: 'Longshot', xp: 50 },
  pointBlank: { name: 'Point Blank', xp: 25 },
  knife: { name: 'Knife Kill', xp: 75 },
  frag: { name: 'Frag', xp: 50 },
  airstrike: { name: 'Airstrike Kill', xp: 25 },
  afterlife: { name: 'Afterlife', xp: 75, big: true },
  comeback: { name: 'Comeback', xp: 75 },
  buzzkill: { name: 'Buzzkill', xp: 50 },
  captured: { name: 'Point Captured', xp: 150 },
  confirmed: { name: 'Kill Confirmed', xp: 50 },
  denied: { name: 'Kill Denied', xp: 50 },
  infect: { name: 'Infected!', xp: 50 },
  flagTaken: { name: 'Flag Taken', xp: 50 },
  flagCaptured: { name: 'Flag Captured', xp: 300, big: true },
  flagReturned: { name: 'Flag Returned', xp: 100 },
  carrierKill: { name: 'Carrier Kill', xp: 75 },
  promoted: { name: 'Weapon Up', xp: 50 },
  freeze: { name: 'Freeze', xp: 100 },
  thaw: { name: 'Thawed a Teammate', xp: 75 },
  vipKill: { name: 'VIP Kill', xp: 200, big: true },
  planted: { name: 'Bomb Planted', xp: 200 },
  defused: { name: 'Bomb Defused', xp: 300, big: true },
  win: { name: 'Match Won', xp: 500, big: true },
  played: { name: 'Match Complete', xp: 200 }
} satisfies Record<string, Medal>;

// ---------------------------------------------------------------- ranked

/** Ranked matches before a division is shown. */
export const PLACEMENT_MATCHES = 5;

const DIVISIONS = [
  { name: 'Bronze', min: 0, color: '#c8814a' },
  { name: 'Silver', min: 900, color: '#c3cbd3' },
  { name: 'Gold', min: 1200, color: '#f2c94c' },
  { name: 'Platinum', min: 1500, color: '#5fd3c6' },
  { name: 'Diamond', min: 1800, color: '#7fb8ff' },
  { name: 'Champion', min: 2100, color: '#ff6b8a' }
];

export interface Division {
  /** e.g. "Gold II", or "Unranked" during placements. */
  name: string;
  color: string;
  /** Progress to the next tier, 0..1. */
  progress: number;
  placed: boolean;
}

/** Ranked has two queues with separate ratings: team modes, and 1v1 duels. */
export type RankedQueue = 'team' | 'duel';

/** One queue's rating and record. */
export const queueStats = (p: Profile, q: RankedQueue): { sr: number; best: number; matches: number; wins: number } =>
  q === 'duel' ? { sr: p.duelSr, best: p.duelBestSr, matches: p.duelMatches, wins: p.duelWins } : { sr: p.sr, best: p.bestSr, matches: p.rankedMatches, wins: p.rankedWins };

export const divisionOf = (p: Profile, q: RankedQueue = 'team'): Division => {
  const { sr, matches } = queueStats(p, q);
  if (matches < PLACEMENT_MATCHES) {
    return { name: `Placements ${matches}/${PLACEMENT_MATCHES}`, color: '#9aa4ad', progress: matches / PLACEMENT_MATCHES, placed: false };
  }
  let i = 0;
  while (i + 1 < DIVISIONS.length && sr >= DIVISIONS[i + 1].min) i++;
  const d = DIVISIONS[i];
  if (i === DIVISIONS.length - 1) return { name: d.name, color: d.color, progress: 1, placed: true };
  // Three tiers per division: III, II, I.
  const span = (DIVISIONS[i + 1].min - (i === 0 ? 600 : d.min)) / 3;
  const from = i === 0 ? 600 : d.min;
  const tier = Math.max(0, Math.min(2, Math.floor((sr - from) / span)));
  return { name: `${d.name} ${['III', 'II', 'I'][tier]}`, color: d.color, progress: Math.max(0, Math.min(1, (sr - from - tier * span) / span)), placed: true };
};

/** Modes in the ranked playlist (team modes where the result is down to how you play). */
export const RANKED_MODES = ['tdm', 'snd', 'dom', 'koth', '3v3', 'ctf', 'kc'] as const;

/** Opponent sharpness for a rating: aim error multiplier (lower = better) and damage taken. */
export const rankedDifficulty = (sr: number): { skill: number; damageToPlayer: number } => {
  const t = Math.max(0, Math.min(1, (sr - 600) / 1600));
  return { skill: 1.9 - 1.3 * t, damageToPlayer: 0.55 + 0.45 * t };
};

/** Rating change for one ranked result; placements move twice as far. */
export const srChange = (p: Profile, won: boolean, kills: number, deaths: number, q: RankedQueue = 'team'): number => {
  const perf = Math.max(-8, Math.min(8, (kills - deaths) * (q === 'duel' ? 0.5 : 1.5)));
  const base = won ? 25 : -22;
  return Math.round((base + perf) * (queueStats(p, q).matches < PLACEMENT_MATCHES ? 2 : 1));
};

/** Applies one ranked result to the saved profile and returns the change. */
export const recordRanked = (won: boolean, kills: number, deaths: number, q: RankedQueue = 'team'): number => {
  const p = loadProfile();
  const delta = srChange(p, won, kills, deaths, q);
  if (q === 'duel') {
    p.duelSr = Math.max(0, p.duelSr + delta);
    p.duelBestSr = Math.max(p.duelBestSr, p.duelSr);
    p.duelMatches++;
    if (won) p.duelWins++;
  } else {
    p.sr = Math.max(0, p.sr + delta);
    p.bestSr = Math.max(p.bestSr, p.sr);
    p.rankedMatches++;
    if (won) p.rankedWins++;
  }
  saveProfile(p);
  return delta;
};

// ---------------------------------------------------------------- prestige

export const MAX_PRESTIGE = 10;

/** At level 55 you can prestige: back to level 1 with a prestige rank, new cosmetics, and nothing else lost. */
export const canPrestige = (p: Profile): boolean => levelOf(p.xp).level >= MAX_LEVEL && p.prestige < MAX_PRESTIGE;

export const prestigeUp = (): Profile => {
  const p = loadProfile();
  if (!canPrestige(p)) return p;
  p.prestige++;
  p.xp = 0;
  saveProfile(p);
  return p;
};

/** "P3 · 27" style level label. */
export const levelLabel = (level: number, prestige: number): string => (prestige > 0 ? `P${prestige} · ${level}` : String(level));
