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
}

export const loadProfile = (): Profile => {
  const base: Profile = { xp: 0, matches: 0, wins: 0, kills: 0, deaths: 0 };
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
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
  win: { name: 'Match Won', xp: 500, big: true },
  played: { name: 'Match Complete', xp: 200 }
} satisfies Record<string, Medal>;
