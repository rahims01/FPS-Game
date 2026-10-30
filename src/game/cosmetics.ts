/**
 * Player cosmetics: calling cards (a banner shown when you kill someone or
 * win MVP), emblems (an icon by your name), weapon charms (a trinket hanging
 * off your gun), plus the badges that unlock them and per-gun mastery.
 */

import { MELEES } from '../assets/melees';

export interface Cosmetics {
  card: string;
  emblem: string;
  charm: string;
  title: string;
  frame: string;
  nametag: string;
  tracer: string;
  flash: string;
  /** Soldier style: finish, pattern, animation or interactive. */
  style?: string;
  /** Shown next to your level (0 = never prestiged). */
  prestige?: number;
  /** Melee weapon in the knife slot (looks only; see assets/melees). */
  melee?: string;
}

export const DEFAULT_COSMETICS: Cosmetics = { card: 'recruit', emblem: 'star', charm: 'none', title: 'none', frame: 'none', nametag: 'plain', tracer: 'default', flash: 'default', style: 'none', melee: 'knife' };

/**
 * What a cosmetic needs: free, a player level, a badge, a prestige, a
 * tournament win, or weapon mastery (Diamond on `count` guns, say).
 */
/** How something unlocks. `special` items are only ever given (by the admin, a code or an event). */
export type Unlock = { level: number } | { badge: string } | { prestige: number } | { tourney: number } | { mastery: number; count: number } | { special: string } | null;

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export const RARITY: Record<Rarity, { name: string; color: string }> = {
  common: { name: 'Common', color: '#9aa4ad' },
  rare: { name: 'Rare', color: '#4fa3ff' },
  epic: { name: 'Epic', color: '#b46bff' },
  legendary: { name: 'Legendary', color: '#ffb02e' },
  mythic: { name: 'Mythic', color: '#ff4f7b' }
};

/** How rare something is, from what it takes to unlock (or set explicitly). */
export const rarityOf = (item: { unlock: Unlock; rarity?: Rarity }): Rarity => {
  if (item.rarity) return item.rarity;
  const u = item.unlock;
  if (!u) return 'common';
  if ('level' in u) return u.level < 15 ? 'rare' : u.level < 40 ? 'epic' : 'legendary';
  if ('badge' in u) return 'epic';
  if ('mastery' in u) return 'legendary';
  return 'mythic';
};

export interface CardDef {
  id: string;
  name: string;
  /** CSS background. */
  bg: string;
  /** Text colour on it. */
  ink: string;
  unlock: Unlock;
  rarity?: Rarity;
  secret?: boolean;
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
  { id: 'ranked', name: 'Top Rank', bg: 'linear-gradient(120deg,#ff6b8a,#7f00ff)', ink: '#fff', unlock: { badge: 'rankedchamp' } },
  { id: 'prestige1', name: 'Prestige', bg: 'linear-gradient(120deg,#1b1b2f,#5b2a86 60%,#d4a933)', ink: '#ffe58a', unlock: { prestige: 1 } },
  { id: 'prestige5', name: 'Elite', bg: 'radial-gradient(circle at 80% 50%,#ffd34d 0,transparent 30%),linear-gradient(120deg,#0b0b0b,#2b1d00)', ink: '#ffd34d', unlock: { prestige: 5 } },
  { id: 'prestige10', name: 'Immortal', bg: 'linear-gradient(120deg,#ff4f7b,#ffb02e,#4fa3ff,#b46bff)', ink: '#fff', unlock: { prestige: 10 } },
  { id: 'trophy', name: 'Bracket Boss', bg: 'linear-gradient(120deg,#0f2027,#d4a933)', ink: '#fff6c8', unlock: { tourney: 1 } },
  { id: 'dynasty', name: 'Dynasty', bg: 'repeating-linear-gradient(135deg,#d4a933 0 10px,#8a6510 10px 20px)', ink: '#1b1200', unlock: { tourney: 5 } },
  { id: 'armory', name: 'Weapon Master', bg: 'linear-gradient(120deg,#000,#1f3b4d 50%,#7fd8ff)', ink: '#e6f9ff', unlock: { mastery: 3, count: 3 } },
  { id: 'void', name: '???', bg: 'radial-gradient(circle,#000 30%,#2b0040)', ink: '#c9b6ff', unlock: { badge: 'godlike' }, secret: true, rarity: 'mythic' }
];

export interface EmblemDef {
  id: string;
  glyph: string;
  color: string;
  unlock: Unlock;
  rarity?: Rarity;
  secret?: boolean;
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
  { id: 'spear', glyph: '🗡', color: '#c8a46a', unlock: { badge: 'bullseye' } },
  { id: 'prestige', glyph: '✪', color: '#ffd34d', unlock: { prestige: 1 } },
  { id: 'phoenix', glyph: '🐦‍🔥', color: '#ff7a1a', unlock: { prestige: 3 } },
  { id: 'cup', glyph: '🏅', color: '#ffd34d', unlock: { tourney: 1 } },
  { id: 'alien', glyph: '👽', color: '#9bff2a', unlock: { badge: 'nuke' }, secret: true, rarity: 'mythic' },
  { id: 'eye', glyph: '👁', color: '#c9b6ff', unlock: { badge: 'flawless' }, secret: true, rarity: 'mythic' }
];

export interface CharmDef {
  id: string;
  name: string;
  shape: 'none' | 'ball' | 'dice' | 'gem' | 'ring' | 'cone' | 'star' | 'heart' | 'skull' | 'duck';
  color: number;
  unlock: Unlock;
  rarity?: Rarity;
  secret?: boolean;
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
  { id: 'diamondcharm', name: 'Diamond', shape: 'gem', color: 0x9fe8ff, unlock: { badge: 'diamondhands' } },
  { id: 'prestigestar', name: 'Prestige Star', shape: 'star', color: 0xb46bff, unlock: { prestige: 1 } },
  { id: 'trophycharm', name: 'Mini Trophy', shape: 'cone', color: 0xd4a933, unlock: { tourney: 1 } },
  { id: 'goldenduck', name: 'Golden Duck', shape: 'duck', color: 0xffcc00, unlock: { badge: 'giantslayer' }, secret: true, rarity: 'mythic' }
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
  | 'clutches'
  // Career totals.
  | 'damage'
  | 'shots'
  | 'hits'
  | 'seconds'
  | 'meters'
  | 'longestKill'
  | 'bestMatchKills'
  | 'accurateMatches'
  | 'zombieWave'
  | 'survivalWave'
  | 'friends'
  | 'messages'
  // Secret achievements.
  | 'noKillWins'
  | 'ownGoals'
  | 'airKills'
  | 'crouchKnives'
  | 'lastBullet'
  | 'nightOwl'
  | 'earlyBird'
  | 'courseBest';

export interface ProfileLike {
  xp: number;
  prestige?: number;
  tourneyWins?: number;
  matches: number;
  wins: number;
  kills: number;
  weaponKills: Record<string, number>;
  bestSr: number;
  rankedMatches: number;
  duelBestSr?: number;
  duelMatches?: number;
  stats: Partial<Record<StatKey, number>>;
  /** Items given outright (admin gifts, codes); "*" unlocks everything. */
  granted?: string[];
  /** Lifetime count of each medal (by MEDALS key). */
  medals?: Record<string, number>;
  /** Matches played and won in each mode. */
  modes?: Record<string, { played: number; won: number }>;
}

export type BadgeGroup = 'Combat' | 'Weapons' | 'Modes' | 'Career' | 'Social' | 'Secret';

export interface BadgeDef {
  id: string;
  name: string;
  blurb: string;
  icon: string;
  /** Where it shows in the list (the original badges are Combat unless set). */
  group?: BadgeGroup;
  /** Hidden (name and how to get it) until earned. */
  secret?: boolean;
  /** Progress toward it: [have, need]. */
  progress: (p: ProfileLike, level: number) => [number, number];
}

const stat = (p: ProfileLike, k: StatKey) => p.stats[k] ?? 0;
const medal = (p: ProfileLike, k: string) => p.medals?.[k] ?? 0;
const modeWins = (p: ProfileLike, m: string) => p.modes?.[m]?.won ?? 0;
const killsWith = (p: ProfileLike, ids: string[]) => ids.reduce((n, id) => n + (p.weaponKills[id] ?? 0), 0);
/** Every gun (melee aside), for "with every weapon" goals. */
export const GUN_IDS = ['rifle', 'ak', 'scar', 'burst', 'smg', 'uzi', 'shotgun', 'autoshotgun', 'dmr', 'sniper', 'barrett', 'lmg', 'pistol', 'revolver', 'deagle', 'mpistol'];
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

/** Best placed rating across both ranked queues (team and 1v1). */
const bestRanked = (p: ProfileLike): number =>
  Math.max(p.rankedMatches >= 5 ? p.bestSr : 0, (p.duelMatches ?? 0) >= 5 ? (p.duelBestSr ?? 0) : 0);

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
  { id: 'rankedgold', name: 'Gold Standard', blurb: 'Reach Gold in ranked (team or 1v1).', icon: '🥈', progress: (p) => [bestRanked(p), 1200] },
  { id: 'rankedchamp', name: 'Champion Rank', blurb: 'Reach Champion in ranked (team or 1v1).', icon: '💠', progress: (p) => [bestRanked(p), 2100] },
  { id: 'sharpshooter', name: 'Sharpshooter', blurb: 'Score 60 in the Aim Trainer.', icon: '🎯', progress: (p) => [stat(p, 'aimBest'), 60] },
  { id: 'clutch', name: 'Clutch', blurb: 'Win 5 rounds as the last one alive on your team.', icon: '😤', progress: (p) => [stat(p, 'clutches'), 5] },
  { id: 'masterofarms', name: 'Master of Arms', blurb: 'Gold mastery with any weapon (200 kills).', icon: '⭐', progress: (p) => [bestMastery(p), 200] },
  { id: 'diamondhands', name: 'Diamond Hands', blurb: 'Diamond mastery with any weapon (500 kills).', icon: '💎', progress: (p) => [bestMastery(p), 500] },
  { id: 'maxed', name: 'Maxed Out', blurb: 'Reach level 55.', icon: '🔝', progress: (p, level) => [effectiveLevel(p, level), 55] },

  // Combat.
  { id: 'fivek', name: 'Five Thousand', blurb: '5,000 kills.', icon: '🔱', group: 'Combat', progress: (p) => [p.kills, 5000] },
  { id: 'headmaster', name: 'Headmaster', blurb: '2,000 headshots.', icon: '🎓', group: 'Combat', progress: (p) => [stat(p, 'headshots'), 2000] },
  { id: 'doubletrouble', name: 'Double Trouble', blurb: '50 double kills.', icon: '✌', group: 'Combat', progress: (p) => [medal(p, 'double'), 50] },
  { id: 'multikill', name: 'Wrecking Ball', blurb: '10 multi kills (4 in quick succession).', icon: '💥', group: 'Combat', progress: (p) => [medal(p, 'multi'), 10] },
  { id: 'spreemaster', name: 'On a Roll', blurb: '25 killing sprees.', icon: '🎳', group: 'Combat', progress: (p) => [medal(p, 'spree'), 25] },
  { id: 'payback', name: 'Payback', blurb: '50 revenge kills.', icon: '↩', group: 'Combat', progress: (p) => [medal(p, 'revenge'), 50] },
  { id: 'tooclose', name: 'Too Close for Comfort', blurb: '50 point-blank kills.', icon: '👃', group: 'Combat', progress: (p) => [medal(p, 'pointBlank'), 50] },
  { id: 'ghost', name: 'From Beyond', blurb: '10 afterlife kills.', icon: '👻', group: 'Combat', progress: (p) => [medal(p, 'afterlife'), 10] },
  { id: 'nevergiveup', name: 'Never Give Up', blurb: '25 comeback kills.', icon: '📈', group: 'Combat', progress: (p) => [medal(p, 'comeback'), 25] },
  { id: 'partypooper', name: 'Party Pooper', blurb: 'End 25 enemy streaks.', icon: '🎈', group: 'Combat', progress: (p) => [medal(p, 'buzzkill'), 25] },
  { id: 'openingact', name: 'Opening Act', blurb: 'Get first blood 25 times.', icon: '🎬', group: 'Combat', progress: (p) => [medal(p, 'firstBlood'), 25] },
  { id: 'heavyhitter', name: 'Heavy Hitter', blurb: 'Deal 100,000 damage.', icon: '🔨', group: 'Combat', progress: (p) => [stat(p, 'damage'), 100000] },
  { id: 'steadyhands', name: 'Steady Hands', blurb: 'Finish 10 matches with 50% accuracy and 10+ kills.', icon: '🤚', group: 'Combat', progress: (p) => [stat(p, 'accurateMatches'), 10] },
  { id: 'acrossthemap', name: 'Across the Map', blurb: 'A kill from 80 m away.', icon: '🗺', group: 'Combat', progress: (p) => [stat(p, 'longestKill'), 80] },
  { id: 'onemanarmy', name: 'One-Man Army', blurb: '30 kills in one match.', icon: '🪖', group: 'Combat', progress: (p) => [stat(p, 'bestMatchKills'), 30] },

  // Weapons.
  { id: 'eagleeye', name: 'Eagle Eye', blurb: '500 kills with snipers and the DMR.', icon: '🦅', group: 'Weapons', progress: (p) => [killsWith(p, ['sniper', 'barrett', 'dmr']), 500] },
  { id: 'sidearm', name: 'Quick Draw', blurb: '250 kills with pistols.', icon: '🤠', group: 'Weapons', progress: (p) => [killsWith(p, ['pistol', 'revolver', 'deagle', 'mpistol']), 250] },
  { id: 'boomstick', name: 'Boomstick', blurb: '250 shotgun kills.', icon: '💨', group: 'Weapons', progress: (p) => [killsWith(p, ['shotgun', 'autoshotgun']), 250] },
  { id: 'spraypray', name: 'Spray and Pray', blurb: '1,000 kills with SMGs.', icon: '🌧', group: 'Weapons', progress: (p) => [killsWith(p, ['smg', 'uzi', 'mpistol']), 1000] },
  { id: 'bullethose', name: 'Bullet Hose', blurb: '500 LMG kills.', icon: '🚿', group: 'Weapons', progress: (p) => [killsWith(p, ['lmg']), 500] },
  { id: 'rifleman', name: 'Rifleman', blurb: '1,000 kills with assault rifles.', icon: '🎖', group: 'Weapons', progress: (p) => [killsWith(p, ['rifle', 'ak', 'scar', 'burst']), 1000] },
  { id: 'arsenal', name: 'Arsenal', blurb: '25 kills with every gun.', icon: '🗄', group: 'Weapons', progress: (p) => [GUN_IDS.filter((g) => (p.weaponKills[g] ?? 0) >= 25).length, GUN_IDS.length] },
  { id: 'golden5', name: 'Golden Touch', blurb: 'Gold mastery on 5 guns.', icon: '🪙', group: 'Weapons', progress: (p) => [Object.values(p.weaponKills).filter((k) => k >= 200).length, 5] },

  // Modes.
  { id: 'survivor', name: 'Survivor', blurb: 'Reach wave 10 in Zombies.', icon: '🧟', group: 'Modes', progress: (p) => [stat(p, 'zombieWave'), 10] },
  { id: 'undying', name: 'Undying', blurb: 'Reach wave 20 in Zombies.', icon: '⚰', group: 'Modes', progress: (p) => [stat(p, 'zombieWave'), 20] },
  { id: 'laststand', name: 'Last Stand', blurb: 'Reach wave 10 in Survival.', icon: '🏰', group: 'Modes', progress: (p) => [stat(p, 'survivalWave'), 10] },
  { id: 'flagbearer', name: 'Flag Bearer', blurb: 'Capture 10 flags.', icon: '🚩', group: 'Modes', progress: (p) => [medal(p, 'flagCaptured'), 10] },
  { id: 'demolition', name: 'Demolition', blurb: 'Plant 10 bombs.', icon: '🧨', group: 'Modes', progress: (p) => [medal(p, 'planted'), 10] },
  { id: 'wirecutter', name: 'Wire Cutter', blurb: 'Defuse 5 bombs.', icon: '✂', group: 'Modes', progress: (p) => [medal(p, 'defused'), 5] },
  { id: 'tagcollector', name: 'Tag Collector', blurb: 'Confirm 100 kills.', icon: '🏷', group: 'Modes', progress: (p) => [medal(p, 'confirmed'), 100] },
  { id: 'pointman', name: 'Point Man', blurb: 'Capture 50 points.', icon: '📍', group: 'Modes', progress: (p) => [medal(p, 'captured'), 50] },
  { id: 'gunrunner', name: 'Gun Runner', blurb: 'Win Gun Game 5 times.', icon: '🔫', group: 'Modes', progress: (p) => [modeWins(p, 'gungame'), 5] },
  { id: 'onebullet', name: 'One and Done', blurb: 'Win One in the Chamber.', icon: '1️⃣', group: 'Modes', progress: (p) => [modeWins(p, 'oitc'), 1] },
  { id: 'patientzero', name: 'Patient Zero', blurb: 'Win Infected 5 times.', icon: '🦠', group: 'Modes', progress: (p) => [modeWins(p, 'infected'), 5] },
  { id: 'tourist', name: 'Tourist', blurb: 'Play 20 different modes.', icon: '🧳', group: 'Modes', progress: (p) => [Object.values(p.modes ?? {}).filter((m) => m.played > 0).length, 20] },
  { id: 'allrounder', name: 'All-Rounder', blurb: 'Win in 10 different modes.', icon: '🎡', group: 'Modes', progress: (p) => [Object.values(p.modes ?? {}).filter((m) => m.won > 0).length, 10] },

  // Career.
  { id: 'dedicated', name: 'Dedicated', blurb: 'Play for 10 hours.', icon: '⏱', group: 'Career', progress: (p) => [Math.floor(stat(p, 'seconds') / 3600), 10] },
  { id: 'nolife', name: 'Living Legend', blurb: 'Play for 50 hours.', icon: '⌛', group: 'Career', progress: (p) => [Math.floor(stat(p, 'seconds') / 3600), 50] },
  { id: 'marathon', name: 'Marathon', blurb: 'Run 42 km in matches.', icon: '🏃', group: 'Career', progress: (p) => [Math.floor(stat(p, 'meters') / 1000), 42] },
  { id: 'lifer', name: 'Lifer', blurb: 'Play 500 matches.', icon: '📅', group: 'Career', progress: (p) => [p.matches, 500] },
  { id: 'centurywins', name: 'Hundred Wins', blurb: 'Win 100 matches.', icon: '🏁', group: 'Career', progress: (p) => [p.wins, 100] },
  { id: 'freshstart', name: 'Fresh Start', blurb: 'Prestige for the first time.', icon: '🔄', group: 'Career', progress: (p) => [p.prestige ?? 0, 1] },
  { id: 'prestigemaster', name: 'Prestige Master', blurb: 'Reach the top prestige.', icon: '🌟', group: 'Career', progress: (p) => [p.prestige ?? 0, 10] },

  // Social.
  { id: 'makingfriends', name: 'Making Friends', blurb: 'Add a friend.', icon: '🤝', group: 'Social', progress: (p) => [stat(p, 'friends'), 1] },
  { id: 'popular', name: 'Popular', blurb: 'Have 10 friends.', icon: '🎉', group: 'Social', progress: (p) => [stat(p, 'friends'), 10] },
  { id: 'chatterbox', name: 'Chatterbox', blurb: 'Send 100 messages to friends.', icon: '💬', group: 'Social', progress: (p) => [stat(p, 'messages'), 100] },

  // Secret: shown as ??? until earned.
  { id: 'pacifist', name: 'Pacifist', blurb: 'Win a match without a single kill.', icon: '🕊', group: 'Secret', secret: true, progress: (p) => [stat(p, 'noKillWins'), 1] },
  { id: 'oops', name: 'Oops', blurb: 'Take yourself out with your own explosive.', icon: '🤦', group: 'Secret', secret: true, progress: (p) => [stat(p, 'ownGoals'), 1] },
  { id: 'skyhigh', name: 'Sky High', blurb: '25 kills while in the air.', icon: '🪂', group: 'Secret', secret: true, progress: (p) => [stat(p, 'airKills'), 25] },
  { id: 'silentdeadly', name: 'Silent but Deadly', blurb: '10 knife kills while crouching.', icon: '🐈', group: 'Secret', secret: true, progress: (p) => [stat(p, 'crouchKnives'), 10] },
  { id: 'cuttingitclose', name: 'Cutting It Close', blurb: '10 kills with the last bullet in your magazine.', icon: '🎲', group: 'Secret', secret: true, progress: (p) => [stat(p, 'lastBullet'), 10] },
  { id: 'nightowl', name: 'Night Owl', blurb: 'Finish a match between midnight and 4 am.', icon: '🦉', group: 'Secret', secret: true, progress: (p) => [stat(p, 'nightOwl'), 1] },
  { id: 'earlybird', name: 'Early Bird', blurb: 'Finish a match between 5 and 7 am.', icon: '🐓', group: 'Secret', secret: true, progress: (p) => [stat(p, 'earlyBird'), 1] },
  { id: 'rampage', name: 'Rampage', blurb: '50 kills in one match.', icon: '🦖', group: 'Secret', secret: true, progress: (p) => [stat(p, 'bestMatchKills'), 50] },
  { id: 'satellite', name: 'Satellite', blurb: 'A kill from 150 m away.', icon: '🛰', group: 'Secret', secret: true, progress: (p) => [stat(p, 'longestKill'), 150] },
  { id: 'nuke3', name: 'Mushroom Season', blurb: 'Call in 3 nukes.', icon: '🍄', group: 'Secret', secret: true, progress: (p) => [stat(p, 'nukes'), 3] },
  { id: 'everything', name: 'Completionist', blurb: 'Earn every other achievement.', icon: '🏛', group: 'Secret', secret: true, progress: (p, level) => [BADGES.filter((b) => b.id !== 'everything' && earned(b, p, level)).length, BADGES.length - 1] }
];

/**
 * Collections: sets to complete. Finishing one gives a title you can't get
 * any other way (added to your granted items the moment it's done).
 */
export interface CollectionDef {
  id: string;
  name: string;
  blurb: string;
  /** The title it awards (a TITLES id with a `special` unlock). */
  reward: string;
  progress: (p: ProfileLike, level: number) => [number, number];
}

export const earned = (b: BadgeDef, p: ProfileLike, level: number): boolean => {
  const [have, need] = b.progress(p, level);
  return have >= need;
};

/** Level unlocks stay unlocked after you prestige. */
export const effectiveLevel = (p: ProfileLike, level: number): number => ((p.prestige ?? 0) > 0 ? 55 : level);

export const unlocked = (u: Unlock, p: ProfileLike, level: number, id?: string): boolean => {
  if (!u) return true;
  if (p.granted && (p.granted.includes('*') || (id !== undefined && p.granted.includes(id)))) return true;
  if ('special' in u) return false;
  const lvl = effectiveLevel(p, level);
  if ('level' in u) return lvl >= u.level;
  if ('prestige' in u) return (p.prestige ?? 0) >= u.prestige;
  if ('tourney' in u) return (p.tourneyWins ?? 0) >= u.tourney;
  if ('mastery' in u) return Object.values(p.weaponKills).filter((k) => masteryOf(k).tier >= u.mastery).length >= u.count;
  const b = BADGES.find((x) => x.id === u.badge);
  return !!b && earned(b, p, lvl);
};

export const unlockText = (u: Unlock): string => {
  if (!u) return '';
  if ('level' in u) return `Level ${u.level}`;
  if ('prestige' in u) return `Prestige ${u.prestige}`;
  if ('tourney' in u) return u.tourney === 1 ? 'Win a tournament' : `Win ${u.tourney} tournaments`;
  if ('mastery' in u) return `${MASTERY[u.mastery].name} mastery on ${u.count} guns`;
  if ('special' in u) return u.special;
  const b = BADGES.find((x) => x.id === u.badge);
  return b ? `Badge: ${b.name}` : '';
};

/** Random cosmetics for a computer player (higher levels show off more). */
/**
 * Cosmetics for a computer player, as if they had played for a while: level
 * unlocks up to their level, the odd badge item, rarely a prestige or
 * tournament one, and plenty of people leaving things on default.
 */
export const randomCosmetics = (level: number, rand: () => number = Math.random, prestige = 0): Cosmetics => {
  const ok = (u: Unlock): boolean => {
    if (!u) return true;
    if ('level' in u) return u.level <= (prestige > 0 ? 55 : level);
    if ('prestige' in u) return u.prestige <= prestige;
    if ('tourney' in u) return rand() < 0.04;
    if ('mastery' in u) return level > 40 && rand() < 0.15;
    if ('special' in u) return false;
    return rand() < 0.2;
  };
  const pick = <T extends { id: string; unlock: Unlock; secret?: boolean }>(list: T[], keepDefault: number): string => {
    if (rand() < keepDefault) return list[0].id;
    const pool = list.filter((x) => !x.secret && ok(x.unlock));
    return pool[Math.floor(rand() * pool.length)].id;
  };
  return {
    card: pick(CARDS, 0.15),
    emblem: pick(EMBLEMS, 0.2),
    charm: pick(CHARMS, 0.5),
    title: pick(TITLES, 0.45),
    frame: pick(FRAMES, 0.4),
    nametag: pick(NAMETAGS, 0.55),
    tracer: pick(TRACERS, 0.6),
    flash: pick(FLASHES, 0.7),
    style: pick(STYLES, 0.6),
    melee: pick(MELEES, 0.45),
    prestige
  };
};

export const cardDef = (id: string): CardDef => CARDS.find((c) => c.id === id) ?? CARDS[0];
export const emblemDef = (id: string): EmblemDef => EMBLEMS.find((e) => e.id === id) ?? EMBLEMS[0];
export const charmDef = (id: string): CharmDef => CHARMS.find((c) => c.id === id) ?? CHARMS[0];

// ---------------------------------------------------------------- titles, frames, name tags, tracers, flashes

export interface TitleDef {
  id: string;
  text: string;
  unlock: Unlock;
  rarity?: Rarity;
  secret?: boolean;
}

export const TITLES: TitleDef[] = [
  { id: 'none', text: 'No title', unlock: null },
  // Collection rewards and staff titles: only ever given.
  { id: 'collector', text: 'The Collector', unlock: { special: 'Collection: Armory' } },
  { id: 'gilded', text: 'Gilded', unlock: { special: 'Collection: Gold Rush' } },
  { id: 'blademaster', text: 'Blademaster', unlock: { special: 'Collection: Sharp Things' } },
  { id: 'decorated', text: 'Decorated', unlock: { special: 'Collection: Medal Case' } },
  { id: 'fashionista', text: 'Fashionista', unlock: { special: 'Collection: Wardrobe' } },
  { id: 'luckycharm', text: 'Lucky Charm', unlock: { special: 'Collection: Charmed' } },
  { id: 'jackofall', text: 'Jack of All Trades', unlock: { special: 'Collection: Mode Master' } },
  { id: 'staff_admin', text: 'Admin', unlock: { special: 'Staff only' } },
  { id: 'staff_mod', text: 'Moderator', unlock: { special: 'Staff only' } },
  { id: 'rookie', text: 'Rookie', unlock: null },
  { id: 'grinder', text: 'The Grinder', unlock: { level: 10 } },
  { id: 'veteran', text: 'Veteran', unlock: { badge: 'veteran' } },
  { id: 'sharp', text: 'Sharpshooter', unlock: { badge: 'sharpshooter' } },
  { id: 'surgeon', text: 'Brain Surgeon', unlock: { badge: 'brainsurgeon' } },
  { id: 'blade', text: 'Knife Lord', unlock: { badge: 'knifemaster' } },
  { id: 'pyro', text: 'Pyromaniac', unlock: { badge: 'firestarter' } },
  { id: 'clutch', text: 'Clutch King', unlock: { badge: 'clutch' } },
  { id: 'unstoppable', text: 'Unstoppable', unlock: { badge: 'unstoppable' } },
  { id: 'champion', text: 'Last One Standing', unlock: { badge: 'champion' } },
  { id: 'giantslayer', text: 'Giant Slayer', unlock: { badge: 'giantslayer' } },
  { id: 'master', text: 'Weapon Master', unlock: { mastery: 3, count: 3 } },
  { id: 'prestige', text: 'Prestige', unlock: { prestige: 1 } },
  { id: 'legend', text: 'Living Legend', unlock: { prestige: 5 } },
  { id: 'immortal', text: 'Immortal', unlock: { prestige: 10 } },
  { id: 'tourney', text: 'Tournament Champion', unlock: { tourney: 1 } },
  { id: 'dynasty', text: 'Dynasty', unlock: { tourney: 5 } },
  { id: 'rankedchamp', text: 'Ranked Champion', unlock: { badge: 'rankedchamp' } },
  { id: 'untouchable', text: 'Untouchable', unlock: { badge: 'flawless' }, secret: true, rarity: 'mythic' },
  { id: 'nuclear', text: 'Nuclear Option', unlock: { badge: 'nuke' }, secret: true, rarity: 'mythic' }
];

/** Frames around your level number (CSS border and background). */
export interface FrameDef {
  id: string;
  name: string;
  border: string;
  bg: string;
  unlock: Unlock;
  rarity?: Rarity;
  secret?: boolean;
}

export const FRAMES: FrameDef[] = [
  { id: 'none', name: 'Standard', border: 'transparent', bg: 'var(--accent)', unlock: null },
  { id: 'bronze', name: 'Bronze', border: '#c8814a', bg: '#3a2412', unlock: { level: 10 } },
  { id: 'silver', name: 'Silver', border: '#c3cbd3', bg: '#2a3036', unlock: { level: 25 } },
  { id: 'gold', name: 'Gold', border: '#f2c94c', bg: '#3a2c00', unlock: { level: 40 } },
  { id: 'diamond', name: 'Diamond', border: '#7fd8ff', bg: '#0b2a3a', unlock: { level: 55 } },
  { id: 'prestige', name: 'Prestige', border: '#b46bff', bg: 'linear-gradient(135deg,#2b0040,#5b2a86)', unlock: { prestige: 1 } },
  { id: 'prestige5', name: 'Prestige Elite', border: '#ffd34d', bg: 'linear-gradient(135deg,#3a2c00,#b46bff)', unlock: { prestige: 5 } },
  { id: 'immortal', name: 'Immortal', border: '#ff4f7b', bg: 'linear-gradient(135deg,#ff4f7b,#ffb02e,#4fa3ff)', unlock: { prestige: 10 } },
  { id: 'champion', name: 'Champion', border: '#ffd34d', bg: 'linear-gradient(135deg,#0f2027,#d4a933)', unlock: { tourney: 1 } }
];

/** Name tag styles (drawn above your head and on the scoreboard). */
export interface NametagDef {
  id: string;
  name: string;
  unlock: Unlock;
  rarity?: Rarity;
  secret?: boolean;
}

export const NAMETAGS: NametagDef[] = [
  { id: 'plain', name: 'Plain', unlock: null },
  { id: 'outline', name: 'Outlined', unlock: { level: 5 } },
  { id: 'gold', name: 'Gold Plate', unlock: { level: 20 } },
  { id: 'neon', name: 'Neon', unlock: { level: 30 } },
  { id: 'ice', name: 'Frozen', unlock: { badge: 'longarm' } },
  { id: 'flame', name: 'On Fire', unlock: { badge: 'firestarter' } },
  { id: 'royal', name: 'Royal', unlock: { prestige: 1 } },
  { id: 'rainbow', name: 'Rainbow', unlock: { tourney: 1 } },
  { id: 'toxic', name: '???', unlock: { badge: 'nuke' }, secret: true, rarity: 'mythic' }
];

/** Bullet tracer colours (`rainbow` cycles). */
export interface TracerDef {
  id: string;
  name: string;
  color: number | 'rainbow';
  unlock: Unlock;
  rarity?: Rarity;
  secret?: boolean;
}

export const TRACERS: TracerDef[] = [
  { id: 'default', name: 'Standard', color: 0xffe9a8, unlock: null },
  { id: 'red', name: 'Red', color: 0xff3b3b, unlock: { level: 8 } },
  { id: 'green', name: 'Green', color: 0x3bff6b, unlock: { level: 14 } },
  { id: 'blue', name: 'Blue', color: 0x3bb9ff, unlock: { level: 22 } },
  { id: 'purple', name: 'Purple', color: 0xb46bff, unlock: { level: 34 } },
  { id: 'pink', name: 'Hot Pink', color: 0xff4fd8, unlock: { badge: 'centurion' } },
  { id: 'rainbow', name: 'Rainbow', color: 'rainbow', unlock: { prestige: 2 } },
  { id: 'golden', name: 'Golden', color: 0xffcc33, unlock: { badge: 'masterofarms' }, secret: true, rarity: 'mythic' }
];

/** Muzzle flash colours and sizes. */
export interface FlashDef {
  id: string;
  name: string;
  color: number;
  scale: number;
  unlock: Unlock;
  rarity?: Rarity;
  secret?: boolean;
}

export const FLASHES: FlashDef[] = [
  { id: 'default', name: 'Standard', color: 0xffffff, scale: 1, unlock: null },
  { id: 'blue', name: 'Plasma Blue', color: 0x6ab8ff, scale: 1, unlock: { level: 12 } },
  { id: 'green', name: 'Toxic Green', color: 0x8aff5a, unlock: { level: 26 }, scale: 1 },
  { id: 'purple', name: 'Void Purple', color: 0xc08aff, scale: 1.1, unlock: { level: 38 } },
  { id: 'big', name: 'Cannon', color: 0xffd08a, scale: 1.6, unlock: { badge: 'thousand' } },
  { id: 'dragon', name: "Dragon's Breath", color: 0xff6a1a, scale: 1.8, unlock: { badge: 'firestarter' }, secret: true, rarity: 'mythic' }
];

/** Unlockable player colours (free-for-all modes and your soldier); the 12 basics are free. */
export interface ThemeColorDef {
  id: string;
  name: string;
  hex: number;
  /** flat paint, metallic, glowing, or cycling through the rainbow. */
  finish: 'flat' | 'metal' | 'glow' | 'rainbow';
  unlock: Unlock;
  rarity?: Rarity;
  secret?: boolean;
}

export const THEME_COLORS: ThemeColorDef[] = [
  { id: 'crimson', name: 'Crimson', hex: 0x9e0f2b, finish: 'flat', unlock: { level: 6 } },
  { id: 'mint', name: 'Mint', hex: 0x6ff0c0, finish: 'flat', unlock: { level: 9 } },
  { id: 'sky', name: 'Sky', hex: 0x8fd3ff, finish: 'flat', unlock: { level: 12 } },
  { id: 'coral', name: 'Coral', hex: 0xff7b6b, finish: 'flat', unlock: { level: 15 } },
  { id: 'lavender', name: 'Lavender', hex: 0xb9a3ff, finish: 'flat', unlock: { level: 18 } },
  { id: 'army', name: 'Army', hex: 0x4b5a2a, finish: 'flat', unlock: { level: 21 } },
  { id: 'chrome', name: 'Chrome', hex: 0xd8dde3, finish: 'metal', unlock: { level: 28 } },
  { id: 'bronze', name: 'Bronze', hex: 0xb07a3c, finish: 'metal', unlock: { level: 33 } },
  { id: 'neonpink', name: 'Neon Pink', hex: 0xff2bd6, finish: 'glow', unlock: { level: 37 } },
  { id: 'neongreen', name: 'Toxic', hex: 0x7dff2a, finish: 'glow', unlock: { level: 42 } },
  { id: 'gold', name: 'Gold', hex: 0xe8b63a, finish: 'metal', unlock: { level: 50 } },
  { id: 'lava', name: 'Lava', hex: 0xff4e00, finish: 'glow', unlock: { badge: 'firestarter' } },
  { id: 'ice', name: 'Ice', hex: 0x9fe8ff, finish: 'glow', unlock: { badge: 'longarm' } },
  { id: 'obsidian', name: 'Obsidian', hex: 0x1a1426, finish: 'metal', unlock: { mastery: 3, count: 3 } },
  { id: 'royal', name: 'Royal Purple', hex: 0x6a2bd9, finish: 'metal', unlock: { prestige: 1 } },
  { id: 'champion', name: 'Champion Gold', hex: 0xffd34d, finish: 'glow', unlock: { tourney: 1 } },
  { id: 'spectral', name: '???', hex: 0xbaffef, finish: 'glow', unlock: { badge: 'godlike' }, secret: true, rarity: 'mythic' }
];

/** The finish for a soldier colour (themed colours glow, shine or cycle). */
export const finishOf = (hex: number): ThemeColorDef['finish'] => THEME_COLORS.find((c) => c.hex === hex)?.finish ?? 'flat';

export const titleDef = (id: string): TitleDef => TITLES.find((t) => t.id === id) ?? TITLES[0];
export const frameDef = (id: string): FrameDef => FRAMES.find((f) => f.id === id) ?? FRAMES[0];
export const tracerDef = (id: string): TracerDef => TRACERS.find((t) => t.id === id) ?? TRACERS[0];
export const flashDef = (id: string): FlashDef => FLASHES.find((f) => f.id === id) ?? FLASHES[0];

// ---------------------------------------------------------------- soldier styles

/**
 * How your soldier wears its colour: a finish, a pattern (in your colour), an
 * animation, or something that reacts to how you are playing.
 */
export interface StyleDef {
  id: string;
  name: string;
  kind: 'finish' | 'pattern' | 'animated' | 'interactive';
  /** Changes the hue itself (rainbow, glitch...): team modes swap these for a pulse in the team colour. */
  hueShift?: boolean;
  blurb: string;
  unlock: Unlock;
  rarity?: Rarity;
  secret?: boolean;
}

export const STYLES: StyleDef[] = [
  { id: 'none', name: 'Plain', kind: 'finish', blurb: 'Your colour, nothing else.', unlock: null },
  { id: 'matte', name: 'Matte', kind: 'finish', blurb: 'Flat, no shine.', unlock: null },
  { id: 'metal', name: 'Metallic', kind: 'finish', blurb: 'Polished and shiny.', unlock: { level: 7 } },
  { id: 'glow', name: 'Glow', kind: 'finish', blurb: 'Lit from within.', unlock: { level: 13 } },
  { id: 'realmetal', name: 'Real Metal', kind: 'finish', blurb: 'Brushed metal that reflects the world around it, tinted by your colour.', unlock: { level: 20 } },
  { id: 'stripes', name: 'Stripes', kind: 'pattern', blurb: 'Bold diagonal stripes.', unlock: { level: 4 } },
  { id: 'checker', name: 'Checker', kind: 'pattern', blurb: 'Racing checks.', unlock: { level: 9 } },
  { id: 'polka', name: 'Polka Dots', kind: 'pattern', blurb: 'Dots. Lots of dots.', unlock: { level: 11 } },
  { id: 'camo', name: 'Camo', kind: 'pattern', blurb: 'Blotchy camouflage in your colour.', unlock: { level: 16 } },
  { id: 'zebra', name: 'Zebra', kind: 'pattern', blurb: 'Wavy stripes.', unlock: { level: 19 } },
  { id: 'tiger', name: 'Tiger', kind: 'pattern', blurb: 'Tiger stripes.', unlock: { level: 23 } },
  { id: 'digital', name: 'Digital', kind: 'pattern', blurb: 'Pixel camo.', unlock: { level: 27 } },
  { id: 'hex', name: 'Hex Armour', kind: 'pattern', blurb: 'Honeycomb plating.', unlock: { level: 31 } },
  { id: 'circuit', name: 'Circuit', kind: 'pattern', blurb: 'Glowing circuit traces.', unlock: { badge: 'triple' } },
  { id: 'stars', name: 'Starfield', kind: 'pattern', blurb: 'A night sky.', unlock: { level: 44 } },
  { id: 'pulse', name: 'Pulse', kind: 'animated', blurb: 'A slow breathing glow.', unlock: { level: 17 } },
  { id: 'rainbow', name: 'Rainbow', kind: 'animated', hueShift: true, blurb: 'Cycles through every colour.', unlock: { level: 35 } },
  { id: 'mono', name: 'Monochrome', kind: 'animated', hueShift: true, blurb: 'Fades between black and white.', unlock: { level: 24 } },
  { id: 'holo', name: 'Holographic', kind: 'animated', hueShift: true, blurb: 'Iridescent: shifts as it moves.', unlock: { level: 47 } },
  { id: 'glitch', name: 'Glitch', kind: 'animated', hueShift: true, blurb: 'Corrupted: random colour jumps and flicker.', unlock: { badge: 'triple' } },
  { id: 'lava', name: 'Lava Flow', kind: 'animated', blurb: 'Molten cracks flowing over you.', unlock: { badge: 'firestarter' } },
  { id: 'electric', name: 'Electric', kind: 'animated', blurb: 'Crackling, flickering energy.', unlock: { level: 52 } },
  { id: 'aurora', name: 'Aurora', kind: 'animated', hueShift: true, blurb: 'Green, blue and purple waves.', unlock: { prestige: 1 } },
  { id: 'ghost', name: 'Ghost', kind: 'animated', blurb: 'See-through and shimmering.', unlock: { prestige: 3 } },
  { id: 'heartbeat', name: 'Heartbeat', kind: 'interactive', blurb: 'Pulses red, faster the lower your health.', unlock: { badge: 'clutch' } },
  { id: 'streakheat', name: 'Killstreak Heat', kind: 'interactive', blurb: 'Glows hotter with every kill in your streak.', unlock: { badge: 'unstoppable' } },
  { id: 'chameleon', name: 'Chameleon', kind: 'interactive', blurb: 'Fades toward the ground colour when you stand still or crouch.', unlock: { badge: 'longarm' } },
  { id: 'thermal', name: 'Thermal', kind: 'interactive', hueShift: true, blurb: 'Blue when still, red hot when sprinting.', unlock: { level: 40 } },
  { id: 'hitflash', name: 'Shockwave', kind: 'interactive', blurb: 'Flashes white whenever you get hit.', unlock: { level: 29 } },
  { id: 'trophy', name: 'Trophy', kind: 'interactive', blurb: 'Turns more golden with every kill this match.', unlock: { tourney: 1 } },
  { id: 'voidwalker', name: '???', kind: 'animated', hueShift: true, blurb: 'A swirling void.', unlock: { badge: 'godlike' }, secret: true, rarity: 'mythic' }
];

export const styleDef = (id: string): StyleDef => STYLES.find((s) => s.id === id) ?? STYLES[0];

/** Collections and their rewards (see CollectionDef). Uses the lists above, so it lives at the end. */
export const COLLECTIONS: CollectionDef[] = [
  { id: 'armory', name: 'Armory', blurb: '15 kills with every gun (its first camos).', reward: 'collector', progress: (p) => [GUN_IDS.filter((g) => (p.weaponKills[g] ?? 0) >= 15).length, GUN_IDS.length] },
  { id: 'goldrush', name: 'Gold Rush', blurb: 'Gold mastery (200 kills) on 8 guns.', reward: 'gilded', progress: (p) => [GUN_IDS.filter((g) => (p.weaponKills[g] ?? 0) >= 200).length, 8] },
  { id: 'sharp', name: 'Sharp Things', blurb: 'Unlock every melee weapon.', reward: 'blademaster', progress: (p, level) => [MELEE_UNLOCKS.filter((u) => unlocked(u, p, level)).length, MELEE_UNLOCKS.length] },
  { id: 'medals', name: 'Medal Case', blurb: 'Earn 50 achievements.', reward: 'decorated', progress: (p, level) => [BADGES.filter((b) => earned(b, p, level)).length, 50] },
  { id: 'wardrobe', name: 'Wardrobe', blurb: 'Unlock 30 calling cards.', reward: 'fashionista', progress: (p, level) => [CARDS.filter((c) => unlocked(c.unlock, p, level, c.id)).length, 30] },
  { id: 'charmed', name: 'Charmed', blurb: 'Unlock every charm.', reward: 'luckycharm', progress: (p, level) => [CHARMS.filter((c) => !c.secret && unlocked(c.unlock, p, level, c.id)).length, CHARMS.filter((c) => !c.secret).length] },
  { id: 'modemaster', name: 'Mode Master', blurb: 'Win in 15 different modes.', reward: 'jackofall', progress: (p) => [Object.values(p.modes ?? {}).filter((m) => m.won > 0).length, 15] }
];

/** The melee unlock rules (kept here, not imported, so this file has no asset dependencies). */
const MELEE_UNLOCKS: Unlock[] = [null, { level: 6 }, { level: 12 }, { level: 18 }, { level: 24 }, { level: 30 }, { level: 38 }, { level: 46 }, { badge: 'knifemaster' }];

/** Grants every finished collection's reward title. Returns the titles newly given. */
export const claimCollections = <P extends ProfileLike>(p: P, level: number): string[] => {
  const fresh: string[] = [];
  for (const c of COLLECTIONS) {
    const [have, need] = c.progress(p, level);
    if (have >= need && !(p.granted ?? []).includes(c.reward)) fresh.push(c.reward);
  }
  if (fresh.length) p.granted = [...(p.granted ?? []), ...fresh];
  return fresh;
};
