/**
 * Player cosmetics: calling cards (a banner shown when you kill someone or
 * win MVP), emblems (an icon by your name), weapon charms (a trinket hanging
 * off your gun), plus the badges that unlock them and per-gun mastery.
 */

export interface Cosmetics {
  card: string;
  emblem: string;
  charm: string;
}

export const DEFAULT_COSMETICS: Cosmetics = { card: 'recruit', emblem: 'star', charm: 'none' };

/** What a cosmetic needs: free, a player level, or a badge. */
export type Unlock = { level: number } | { badge: string } | null;

export interface CardDef {
  id: string;
  name: string;
  /** CSS background. */
  bg: string;
  /** Text colour on it. */
  ink: string;
  unlock: Unlock;
}

export const CARDS: CardDef[] = [
  { id: 'recruit', name: 'Recruit', bg: 'linear-gradient(120deg,#2b3a2b,#13190f)', ink: '#e8efe6', unlock: null },
  { id: 'dusk', name: 'Dusk', bg: 'linear-gradient(120deg,#ff7e5f,#6a3093)', ink: '#fff', unlock: null },
  { id: 'ocean', name: 'Deep Blue', bg: 'linear-gradient(120deg,#0f2027,#2c5364)', ink: '#bfe9ff', unlock: { level: 5 } },
  { id: 'forest', name: 'Forest', bg: 'repeating-linear-gradient(60deg,#203a1e 0 14px,#2e5129 14px 28px)', ink: '#d6f5c9', unlock: { level: 8 } },
  { id: 'sunrise', name: 'Sunrise', bg: 'linear-gradient(120deg,#f6d365,#fda085)', ink: '#3a1d0a', unlock: { level: 12 } },
  { id: 'hazard', name: 'Hazard', bg: 'repeating-linear-gradient(45deg,#1a1a1a 0 16px,#ffcc33 16px 32px)', ink: '#fff', unlock: { level: 16 } },
  { id: 'aurora', name: 'Aurora', bg: 'linear-gradient(120deg,#00c9a7,#845ec2,#2c73d2)', ink: '#fff', unlock: { level: 20 } },
  { id: 'circuit', name: 'Circuit', bg: 'repeating-linear-gradient(90deg,#062b1a 0 2px,#0b0f0d 2px 18px),linear-gradient(#0b0f0d,#062b1a)', ink: '#5aff8a', unlock: { level: 25 } },
  { id: 'crimson', name: 'Crimson Tide', bg: 'linear-gradient(120deg,#5a0716,#d9183c)', ink: '#fff', unlock: { level: 30 } },
  { id: 'galaxy', name: 'Galaxy', bg: 'radial-gradient(circle at 30% 40%,#8f5cff 0,transparent 40%),radial-gradient(circle at 70% 60%,#2bd2ff 0,transparent 35%),#0a0618', ink: '#fff', unlock: { level: 40 } },
  { id: 'legend', name: 'Legend', bg: 'linear-gradient(120deg,#000,#3a2a00 50%,#d4a933)', ink: '#ffe58a', unlock: { level: 55 } },
  { id: 'blood', name: 'First Blood', bg: 'linear-gradient(120deg,#2a0000,#8a0000)', ink: '#ffd0d0', unlock: { badge: 'firstblood' } },
  { id: 'skulls', name: 'Headhunter', bg: 'repeating-radial-gradient(circle at 0 0,#1d1d1d 0 10px,#2b2b2b 10px 20px)', ink: '#ff5a4a', unlock: { badge: 'headhunter' } },
  { id: 'blade', name: 'Cold Steel', bg: 'linear-gradient(160deg,#cfd8dc,#607d8b 60%,#263238)', ink: '#0d1418', unlock: { badge: 'knifemaster' } },
  { id: 'inferno', name: 'Inferno', bg: 'linear-gradient(0deg,#ff4e00,#ec9f05 60%,#3a0a00)', ink: '#fff', unlock: { badge: 'firestarter' } },
  { id: 'nuke', name: 'Mushroom Cloud', bg: 'radial-gradient(circle at 50% 120%,#fff6a8 0,#ff9a3c 30%,#5a1d00 70%)', ink: '#fff', unlock: { badge: 'nuke' } },
  { id: 'crown', name: 'Royalty', bg: 'linear-gradient(120deg,#3a1c71,#d76d77,#ffaf7b)', ink: '#fff', unlock: { badge: 'champion' } },
  { id: 'giant', name: 'Giant Slayer', bg: 'linear-gradient(120deg,#141e30,#243b55)', ink: '#ffd34d', unlock: { badge: 'giantslayer' } },
  { id: 'flawless', name: 'Flawless', bg: 'linear-gradient(120deg,#e0eafc,#cfdef3)', ink: '#1b2735', unlock: { badge: 'flawless' } },
  { id: 'diamondcard', name: 'Diamond', bg: 'linear-gradient(120deg,#a8e9ff,#5fb8e6 50%,#e6f9ff)', ink: '#0b2a3a', unlock: { badge: 'diamondhands' } },
  { id: 'ranked', name: 'Top Rank', bg: 'linear-gradient(120deg,#ff6b8a,#7f00ff)', ink: '#fff', unlock: { badge: 'rankedchamp' } }
];

export interface EmblemDef {
  id: string;
  glyph: string;
  color: string;
  unlock: Unlock;
}

export const EMBLEMS: EmblemDef[] = [
  { id: 'star', glyph: '★', color: '#ffcc33', unlock: null },
  { id: 'chevron', glyph: '︽', color: '#9ad93d', unlock: null },
  { id: 'target', glyph: '◎', color: '#ff5a4a', unlock: null },
  { id: 'bolt', glyph: '⚡', color: '#ffe14d', unlock: { level: 4 } },
  { id: 'wolf', glyph: '🐺', color: '#c3cbd3', unlock: { level: 7 } },
  { id: 'skull', glyph: '☠', color: '#e6e6e6', unlock: { level: 10 } },
  { id: 'swords', glyph: '⚔', color: '#c8d2dc', unlock: { level: 14 } },
  { id: 'crosshair', glyph: '⌖', color: '#5aff8a', unlock: { level: 18 } },
  { id: 'eagle', glyph: '🦅', color: '#d4a25a', unlock: { level: 22 } },
  { id: 'snake', glyph: '🐍', color: '#3db85a', unlock: { level: 26 } },
  { id: 'dragon', glyph: '🐉', color: '#e05a3a', unlock: { level: 32 } },
  { id: 'crown', glyph: '♛', color: '#f2c94c', unlock: { level: 45 } },
  { id: 'diamond', glyph: '◆', color: '#7fd8ff', unlock: { level: 55 } },
  { id: 'fire', glyph: '🔥', color: '#ff7a1a', unlock: { badge: 'firestarter' } },
  { id: 'knife', glyph: '🔪', color: '#d0d6dc', unlock: { badge: 'knifemaster' } },
  { id: 'brain', glyph: '🧠', color: '#ff9ab0', unlock: { badge: 'brainsurgeon' } },
  { id: 'radiation', glyph: '☢', color: '#d9ff3d', unlock: { badge: 'nuke' } },
  { id: 'trophy', glyph: '🏆', color: '#ffcc33', unlock: { badge: 'champion' } },
  { id: 'shield', glyph: '🛡', color: '#5aa0ff', unlock: { badge: 'flawless' } },
  { id: 'ghost', glyph: '👻', color: '#e6e6ff', unlock: { badge: 'unstoppable' } },
  { id: 'robot', glyph: '🤖', color: '#9aa4ad', unlock: { badge: 'giantslayer' } },
  { id: 'gem', glyph: '💎', color: '#7fd8ff', unlock: { badge: 'diamondhands' } },
  { id: 'medal', glyph: '🎖', color: '#ffcc33', unlock: { badge: 'veteran' } },
  { id: 'spear', glyph: '🗡', color: '#c8a46a', unlock: { badge: 'bullseye' } }
];

export interface CharmDef {
  id: string;
  name: string;
  shape: 'none' | 'ball' | 'dice' | 'gem' | 'ring' | 'cone' | 'star' | 'heart' | 'skull' | 'duck';
  color: number;
  unlock: Unlock;
}

export const CHARMS: CharmDef[] = [
  { id: 'none', name: 'None', shape: 'none', color: 0, unlock: null },
  { id: 'ball', name: 'Lucky Ball', shape: 'ball', color: 0xff5a4a, unlock: null },
  { id: 'dice', name: 'Fuzzy Die', shape: 'dice', color: 0xf2f2f2, unlock: { level: 6 } },
  { id: 'ring', name: 'Gold Ring', shape: 'ring', color: 0xd4a933, unlock: { level: 11 } },
  { id: 'gem', name: 'Emerald', shape: 'gem', color: 0x2fd07a, unlock: { level: 17 } },
  { id: 'cone', name: 'Traffic Cone', shape: 'cone', color: 0xff8a1a, unlock: { level: 23 } },
  { id: 'duck', name: 'Rubber Duck', shape: 'duck', color: 0xffd400, unlock: { level: 29 } },
  { id: 'heart', name: 'Heart', shape: 'heart', color: 0xff3d7a, unlock: { level: 35 } },
  { id: 'star', name: 'Gold Star', shape: 'star', color: 0xffcc33, unlock: { badge: 'centurion' } },
  { id: 'skull', name: 'Bone Skull', shape: 'skull', color: 0xe8e2d0, unlock: { badge: 'headhunter' } },
  { id: 'ruby', name: 'Ruby', shape: 'gem', color: 0xd9183c, unlock: { badge: 'unstoppable' } },
  { id: 'diamondcharm', name: 'Diamond', shape: 'gem', color: 0x9fe8ff, unlock: { badge: 'diamondhands' } }
];

// ---------------------------------------------------------------- badges

/** Lifetime stats that badges are earned from (saved in the profile). */
export type StatKey =
  | 'headshots'
  | 'knifeKills'
  | 'throwKills'
  | 'fragKills'
  | 'molotovKills'
  | 'longshots'
  | 'tripleKills'
  | 'nukes'
  | 'bestStreak'
  | 'flawlessWins'
  | 'brWins'
  | 'squadWins'
  | 'bossWins'
  | 'aimBest'
  | 'paintballWins'
  | 'clutches';

export interface ProfileLike {
  xp: number;
  matches: number;
  wins: number;
  kills: number;
  weaponKills: Record<string, number>;
  bestSr: number;
  rankedMatches: number;
  stats: Partial<Record<StatKey, number>>;
}

export interface BadgeDef {
  id: string;
  name: string;
  blurb: string;
  icon: string;
  /** Progress toward it: [have, need]. */
  progress: (p: ProfileLike, level: number) => [number, number];
}

const stat = (p: ProfileLike, k: StatKey) => p.stats[k] ?? 0;
/** Mastery tier thresholds (kills with one gun). */
export const MASTERY = [
  { name: 'Bronze', kills: 25, color: '#c8814a' },
  { name: 'Silver', kills: 75, color: '#c3cbd3' },
  { name: 'Gold', kills: 200, color: '#f2c94c' },
  { name: 'Diamond', kills: 500, color: '#7fd8ff' }
];
export const masteryOf = (kills: number): { tier: number; name: string; color: string; next: number | null } => {
  let tier = -1;
  for (let i = 0; i < MASTERY.length; i++) if (kills >= MASTERY[i].kills) tier = i;
  return { tier, name: tier >= 0 ? MASTERY[tier].name : 'None', color: tier >= 0 ? MASTERY[tier].color : '#666', next: tier + 1 < MASTERY.length ? MASTERY[tier + 1].kills : null };
};
const bestMastery = (p: ProfileLike) => Math.max(0, ...Object.values(p.weaponKills));

export const BADGES: BadgeDef[] = [
  { id: 'firstblood', name: 'First Blood', blurb: 'Get your first kill.', icon: '🩸', progress: (p) => [p.kills, 1] },
  { id: 'centurion', name: 'Centurion', blurb: '100 kills.', icon: '💯', progress: (p) => [p.kills, 100] },
  { id: 'thousand', name: 'Thousand Club', blurb: '1,000 kills.', icon: '🏅', progress: (p) => [p.kills, 1000] },
  { id: 'headhunter', name: 'Headhunter', blurb: '100 headshots.', icon: '🎯', progress: (p) => [stat(p, 'headshots'), 100] },
  { id: 'brainsurgeon', name: 'Brain Surgeon', blurb: '500 headshots.', icon: '🧠', progress: (p) => [stat(p, 'headshots'), 500] },
  { id: 'knifemaster', name: 'Knife Master', blurb: '25 knife kills.', icon: '🔪', progress: (p) => [stat(p, 'knifeKills'), 25] },
  { id: 'bullseye', name: 'Bullseye', blurb: '10 kills with throwing knives or spears.', icon: '🗡', progress: (p) => [stat(p, 'throwKills'), 10] },
  { id: 'fragout', name: 'Frag Out', blurb: '25 grenade kills.', icon: '💣', progress: (p) => [stat(p, 'fragKills'), 25] },
  { id: 'firestarter', name: 'Firestarter', blurb: '10 molotov kills.', icon: '🔥', progress: (p) => [stat(p, 'molotovKills'), 10] },
  { id: 'longarm', name: 'Long Arm', blurb: '25 kills from over 35 m.', icon: '🔭', progress: (p) => [stat(p, 'longshots'), 25] },
  { id: 'triple', name: 'Hat Trick', blurb: '10 triple kills or better.', icon: '🎩', progress: (p) => [stat(p, 'tripleKills'), 10] },
  { id: 'unstoppable', name: 'Unstoppable', blurb: 'A 10-kill streak.', icon: '⚡', progress: (p) => [stat(p, 'bestStreak'), 10] },
  { id: 'godlike', name: 'Godlike', blurb: 'A 20-kill streak.', icon: '👑', progress: (p) => [stat(p, 'bestStreak'), 20] },
  { id: 'nuke', name: 'Tactical Nuke', blurb: 'Call in a nuke.', icon: '☢', progress: (p) => [stat(p, 'nukes'), 1] },
  { id: 'flawless', name: 'Flawless', blurb: 'Win a match without dying (at least 5 kills).', icon: '🛡', progress: (p) => [stat(p, 'flawlessWins'), 1] },
  { id: 'champion', name: 'Champion', blurb: 'Win a solo Battle Royale.', icon: '🏆', progress: (p) => [stat(p, 'brWins'), 1] },
  { id: 'squadgoals', name: 'Squad Goals', blurb: 'Win Battle Royale Duos or Trios.', icon: '🤝', progress: (p) => [stat(p, 'squadWins'), 1] },
  { id: 'giantslayer', name: 'Giant Slayer', blurb: 'Beat the boss.', icon: '🗿', progress: (p) => [stat(p, 'bossWins'), 1] },
  { id: 'splat', name: 'Splat!', blurb: 'Win a paintball match.', icon: '🎨', progress: (p) => [stat(p, 'paintballWins'), 1] },
  { id: 'veteran', name: 'Veteran', blurb: 'Play 50 matches.', icon: '🎖', progress: (p) => [p.matches, 50] },
  { id: 'winner', name: 'Winner', blurb: 'Win 25 matches.', icon: '🥇', progress: (p) => [p.wins, 25] },
  { id: 'rankedgold', name: 'Gold Standard', blurb: 'Reach Gold in ranked.', icon: '🥈', progress: (p) => [p.rankedMatches >= 5 ? p.bestSr : 0, 1200] },
  { id: 'rankedchamp', name: 'Champion Rank', blurb: 'Reach Champion in ranked.', icon: '💠', progress: (p) => [p.rankedMatches >= 5 ? p.bestSr : 0, 2100] },
  { id: 'sharpshooter', name: 'Sharpshooter', blurb: 'Score 60 in the Aim Trainer.', icon: '🎯', progress: (p) => [stat(p, 'aimBest'), 60] },
  { id: 'clutch', name: 'Clutch', blurb: 'Win 5 rounds as the last one alive on your team.', icon: '😤', progress: (p) => [stat(p, 'clutches'), 5] },
  { id: 'masterofarms', name: 'Master of Arms', blurb: 'Gold mastery with any gun (200 kills).', icon: '⭐', progress: (p) => [bestMastery(p), 200] },
  { id: 'diamondhands', name: 'Diamond Hands', blurb: 'Diamond mastery with any gun (500 kills).', icon: '💎', progress: (p) => [bestMastery(p), 500] },
  { id: 'maxed', name: 'Maxed Out', blurb: 'Reach level 55.', icon: '🔝', progress: (_p, level) => [level, 55] }
];

export const earned = (b: BadgeDef, p: ProfileLike, level: number): boolean => {
  const [have, need] = b.progress(p, level);
  return have >= need;
};

export const unlocked = (u: Unlock, p: ProfileLike, level: number): boolean => {
  if (!u) return true;
  if ('level' in u) return level >= u.level;
  const b = BADGES.find((x) => x.id === u.badge);
  return !!b && earned(b, p, level);
};

export const unlockText = (u: Unlock): string => {
  if (!u) return '';
  if ('level' in u) return `Level ${u.level}`;
  const b = BADGES.find((x) => x.id === u.badge);
  return b ? `Badge: ${b.name}` : '';
};

/** Random cosmetics for a computer player (higher levels show off more). */
export const randomCosmetics = (level: number, rand: () => number = Math.random): Cosmetics => {
  const cards = CARDS.filter((c) => !c.unlock || ('level' in c.unlock ? c.unlock.level <= level : rand() < 0.25));
  const emblems = EMBLEMS.filter((e) => !e.unlock || ('level' in e.unlock ? e.unlock.level <= level : rand() < 0.25));
  const charms = CHARMS.filter((c) => !c.unlock || ('level' in c.unlock ? c.unlock.level <= level : rand() < 0.2));
  return {
    card: cards[Math.floor(rand() * cards.length)].id,
    emblem: emblems[Math.floor(rand() * emblems.length)].id,
    charm: rand() < 0.5 ? 'none' : charms[Math.floor(rand() * charms.length)].id
  };
};

export const cardDef = (id: string): CardDef => CARDS.find((c) => c.id === id) ?? CARDS[0];
export const emblemDef = (id: string): EmblemDef => EMBLEMS.find((e) => e.id === id) ?? EMBLEMS[0];
export const charmDef = (id: string): CharmDef => CHARMS.find((c) => c.id === id) ?? CHARMS[0];
