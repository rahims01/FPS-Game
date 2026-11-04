import { SKINS, type SkinChoice } from '../assets/skins';
import type { Match } from '../sim/Match';
import { MORE_FIRST_NAMES, MORE_TAG_FIRST, MORE_TAG_SECOND, MORE_USERNAMES, TAG_ADJ, TAG_WORDS } from './usernames';

/** Gamer tags for the other players in the lobby. */
const USERNAMES = [
  'xXSniperXx', 'NoScopeNinja', 'Ghost_42', 'ShadowHunter', 'Kai2009', 'lil_tactics', 'FragMaster', 'HeadshotHank',
  'PixelPusher', 'Raptor_77', 'DarkKnight', 'sweatyboi', 'ItzJake', 'Vortex', 'MrClutch', 'ZeroCool',
  'Toxic_Tom', 'QuickScope', 'NightOwl', 'Sn1perW0lf', 'GG_EZ', 'CampLord', 'Bulletproof', 'yeet_master',
  'RektYou', 'SilentStorm', 'Phantom_X', 'TryHard99', 'CaptainLag', 'Kr4ken', 'xD_Gamer', 'NoobSlayer',
  'CoffeeAddict', 'ProbablyAFK', 'WiFiWarrior', 'Mav3rick', 'IceCold', 'Reaper_01', 'Toaster', 'SweatLord',
  'potato_aim', 'BoomHeadshot', 'Dr_Frag', 'Lethal_Lily', 'NovaStar', 'ItsBrandon', 'Zyrex', 'Wolfpack',
  'FlickGod', 'eggplant', 'LowPing', 'Rambo2012', 'TacoTuesday', 'SneakyPete', 'ApexPred', 'Dingus',
  'Nebula', 'MomSaysBedtime', 'Spray_n_Pray', 'Crimson', 'jxsh', 'Sergeant_Salt', 'OneTap', 'Hydra',
  'BushCamper', 'LagSwitch', 'Glitch', 'KillJoy', 'Valk', 'Tilted', 'Bandit', 'xXGamerGirlXx',
  'Frosty', 'Orbit', 'xX_Slayer_Xx', 'DeadEye', 'Specter', 'ToxicAvenger', 'Mr_Bean_Bag', 'quickscopez',
  'Zombie_Slayer', 'PewPewPew', 'Bacon_Strips', 'SaltyDog', 'clutch_or_kick', 'Nightmare', 'xXDarkLordXx', 'RageQuit',
  'Sp00ky', 'TheRealDeal', 'BigBoss', 'ImHim', 'no_u', 'Bruh_Moment', 'Chad_Energy', 'GoldenGun',
  'AimBotAndy', 'Wh1sper', 'ColdBlooded', 'xxKillerxx', 'Ace_of_Spades', 'Gh0stRid3r', 'ChickenNugget', 'Mr_Sniper_Pants',
  'LagMonster', 'ilovecats', 'WatermelonMan', 'Toast_Master', 'Steve', 'Kevin2011', 'Liam_Plays', 'NoahTheGreat',
  'ElijahGG', 'OliverTwist', 'Lucas_Gamer', 'MasonMaster', 'JacobTheGreat', 'Daniel_Sam', 'Sebastian', 'Mateo_10',
  'Ryan_R', 'Carter_C', 'Jayden_J', 'Wyatt', 'Grayson', 'Leo_TheLion', 'Lincoln_Log', 'Emma_Plays',
  'SophiaS', 'Isabella', 'MiaMia', 'Charlotte_C', 'Amelia_A', 'Harper', 'Evelyn', 'Abby_Gail',
  'Em1ly', 'Ella_Ella', 'Lizzie', 'Sn1pez', 'Frag_Out', 'Tango_Down', 'Charlie_Mike', 'Oscar_Mike',
  'Danger_Close', 'Foxtrot', 'Bravo_Six', 'Arbiter', 'Gaz', 'Roach', 'Shepherd', 'Nemesis',
  'Tyrant', 'diamond_pickaxe', 'xXSteveXx', 'Sus_Imposter', 'RedSus', 'Emergency_Meeting', 'vent_jumper', 'Crewmate',
  'Ejected', 'Sabotage', 'TaskMaster', 'Default_Dance', 'BushWookie', 'Llama_Drama', 'NoBuildPro', 'Caustic',
  'sigma_grindset', 'GigaChad', 'based_god', 'rizzlord', 'ohio_final_boss', 'npc_behavior', 'touchgrass', 'MainCharacter',
  'goblin_mode', 'big_yikes', 'no_cap', 'bussin', 'lowkey_cracked', 'highkey_bad', 'sheeeesh', 'DadBod42',
  'SoccerMom', 'GrandpaGamer', 'WorkFromHome', 'OfficeSpace', 'MondayBlues', 'CasualFriday', 'Overtime', 'PizzaRat',
  'TrashPanda', 'Goose_Honk', 'DuckDuckGoose', 'Possum_Play', 'Sloth_Speed', 'TurboTurtle', 'Hamster_Wheel', 'Mac_n_Cheese',
  'Ramen_Noodle', 'Thunder', 'Lightning', 'Blizzard', 'Typhoon', 'Tornado', 'Avalanche', 'Earthquake',
  'Volcano', 'Wraith', 'Banshee', 'Revenant', 'Poltergeist', 'Shade', 'Spirit', 'Wight',
  'Cobra', 'Mamba', 'Python', 'Rattler', 'Anaconda', 'Komodo', 'Gator', 'Croc',
  'Falcon', 'Hawk', 'Eagle_Eye', 'Raven', 'Crow', 'Owl', 'Condor', 'Vulture',
  'Titan', 'Atlas_Prime', 'Kronos', 'Hyperion', 'Prometheus', 'Zeus', 'Ares', 'Athena'
];

/** Common gamer-tag building blocks, combined for extra variety beyond the hand-picked list. */
const TAG_FIRST = [...MORE_TAG_FIRST, 'Dark', 'Shadow', 'Silent', 'Toxic', 'Mad', 'Lil', 'Big', 'Pro', 'Epic', 'Savage', 'Frozen', 'Crimson', 'Rogue', 'Turbo', 'Hyper', 'Mega', 'Ultra', 'Sneaky', 'Lucky', 'Salty', 'Sweaty', 'Cracked', 'Feral', 'Spicy'];
const TAG_SECOND = [...MORE_TAG_SECOND, 'Wolf', 'Sniper', 'Ninja', 'Viper', 'Reaper', 'Ghost', 'Hunter', 'Dragon', 'Tiger', 'Knight', 'Gamer', 'Slayer', 'Phoenix', 'Panda', 'Shark', 'Fox', 'Bandit', 'Rebel', 'Demon', 'Samurai', 'Pirate', 'Cowboy', 'Goblin', 'Potato'];

const pick = <T>(arr: readonly T[], rand: () => number): T => arr[Math.floor(rand() * arr.length)];

const generatedTag = (rand: () => number): string => {
  const a = pick(TAG_FIRST, rand);
  const b = pick(TAG_SECOND, rand);
  const style = rand();
  const n = Math.floor(rand() * 100);
  if (style < 0.16) return `${a}${b}${n}`;
  if (style < 0.28) return `${a}_${b}`;
  if (style < 0.36) return `xX${a}${b}Xx`;
  if (style < 0.46) return `${a.toLowerCase()}_${b.toLowerCase()}${n}`;
  if (style < 0.52) return `TTV_${a}${b}`;
  // Lowercase run-together words: "sleepypickle", "the_cursed_goose", "spicytaco77".
  const adj = pick(TAG_ADJ, rand);
  const word = pick(TAG_WORDS, rand);
  if (style < 0.64) return `${adj}${word}`;
  if (style < 0.7) return `the_${adj}_${word}`;
  if (style < 0.78) return `${adj}${word}${Math.floor(rand() * 1000)}`;
  if (style < 0.83) return `not${a}${b}`;
  if (style < 0.88) return `${word}_irl`;
  if (style < 0.93) return `Im${a}${b}`;
  return `${a}${b}`;
};

/** Real-name style tags: "jake_2009", "TylerM", "emma.rose". */
const FIRST_NAMES = [...MORE_FIRST_NAMES, 'jake', 'tyler', 'ethan', 'mason', 'liam', 'noah', 'logan', 'aiden', 'caleb', 'ryan', 'kyle', 'austin', 'brandon', 'dylan', 'emma', 'olivia', 'ava', 'mia', 'chloe', 'maddie', 'jordan', 'alex', 'sam', 'chris', 'marcus', 'devon', 'jayden', 'carlos', 'luis', 'andre'];
const CLAN_TAGS = ['[RIP]', '[GG]', '[TTV]', '[AFK]', '[NoX]', '[OG]', '[KOS]', '[BRB]', '[MLG]', '[EZ]', 'CLAN|', 'v0id|'];

const casualTag = (rand: () => number): string => {
  const f = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
  const cap = f[0].toUpperCase() + f.slice(1);
  const letter = String.fromCharCode(65 + Math.floor(rand() * 26));
  const year = 2004 + Math.floor(rand() * 12);
  const style = rand();
  if (style < 0.3) return `${f}_${year}`;
  if (style < 0.5) return `${cap}${letter}`;
  if (style < 0.65) return `${f}${Math.floor(rand() * 1000)}`;
  if (style < 0.8) return `${f}.${FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)]}`;
  const clan = CLAN_TAGS[Math.floor(rand() * CLAN_TAGS.length)];
  return `${clan}${rand() < 0.5 ? cap : generatedTag(rand)}`;
};

/**
 * Players from abroad. The servers are US, so these are rare (about 1 in 33):
 * mostly Latin-script tags, with the odd name in its own script.
 */
const FOREIGN_USERNAMES = [
  // Spanish / Latin American
  'ElTerrible', 'Chamaco_MX', 'ElPibe10', 'Calaca', 'LosPollosHermanos', 'xXElMatadorXx', 'Pancho_Villa', 'Guerrero',
  'ElDiablito', 'ChupaCabra', 'Tío_Rico', 'NoMeMates',
  // Portuguese / Brazilian
  'BRZ_Matador', 'Capivara', 'Moleque_BR', 'kkkkkkk', 'Saci_Perere', 'Tranquilo', 'Brabo', 'Joãozinho',
  // French / German / Dutch / Nordic
  'LeFromage', 'Baguette_Sniper', 'Croissant', 'KartoffelKopf', 'Schnitzel99', 'DerJäger', 'Blitzkrieger', 'Ijsbeer',
  'Stroopwafel', 'Viking_Øl', 'Hjärtat', 'Sisu',
  // Italian / Polish / Russian / Ukrainian (Latin)
  'Pizzaiolo', 'Mamma_Mia', 'Bigos', 'Pierogi', 'Medved', 'Tovarisch', 'Babushka', 'Slav_Squat', 'Borscht', 'Kozak',
  // Turkish / Arabic / Persian (Latin)
  'Aslan', 'Kebab_King', 'Habibi', 'Yalla', 'Shahin', 'Rostam',
  // Hindi / Filipino / Indonesian / Vietnamese
  'DesiBoy', 'Chai_Wala', 'Pare_Ko', 'Lodi', 'Garuda', 'Mantap', 'Phở_King',
  // Japanese / Korean / Chinese (romanised)
  'Kitsune', 'Senpai', 'Baka_Neko', 'Ronin', 'Oni_San', 'Hwarang', 'Daebak', 'Oppa', 'Xiao_Long', 'Laoban', '666_CN',
  // Native scripts (rarest of all, mixed in with the rest)
  'Охотник', 'Волк', 'Снайпер', 'サムライ', 'ねこ', '忍者', '사냥꾼', '호랑이', '龙', '狙击手', 'صقر', 'नमस्ते', 'Λύκος', 'שועל'
];
const FOREIGN_NAME_CHANCE = 0.03;

/** Some people never change the name they start with: "Player" + 4 digits (about 1 in 12). */
const DEFAULT_NAME_CHANCE = 0.08;
export const defaultUsername = (): string => `Player${Math.floor(1000 + Math.random() * 9000)}`;

/** One tag, mixing styles: default names, foreign, real-name style, generated combos, else hand-picked. */
const pickTag = (handPicked: string): string => {
  const r = Math.random();
  if (r < DEFAULT_NAME_CHANCE) return defaultUsername();
  if (r < DEFAULT_NAME_CHANCE + FOREIGN_NAME_CHANCE) return FOREIGN_USERNAMES[Math.floor(Math.random() * FOREIGN_USERNAMES.length)];
  if (r < 0.24) return casualTag(Math.random);
  if (r < 0.4) return generatedTag(Math.random);
  return handPicked;
};

/** Every hand-picked tag, without duplicates. */
const ALL_NAMES = [...new Set([...USERNAMES, ...MORE_USERNAMES])];

/**
 * Names shown in recent matches, so the same tags don't keep turning up.
 * A real lobby is full of strangers; seeing "Kai2009" three games running
 * would give the game away.
 */
const RECENT_KEY = 'fps-recent-names';
const RECENT_MAX = 260;
const loadRecent = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};
const rememberNames = (names: string[]): void => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([...loadRecent(), ...names].slice(-RECENT_MAX)));
  } catch {
    /* no storage: names may repeat a little more */
  }
};

/** A shuffled pool of unique tags, avoiding names seen recently and any in `exclude`. */
const tagPool = (count: number, exclude: Iterable<string> = []): string[] => {
  const recent = new Set(loadRecent());
  const shuffled = ALL_NAMES.slice().sort(() => Math.random() - 0.5);
  // Fresh names first; recently seen ones only if we somehow run out.
  const pool = [...shuffled.filter((n) => !recent.has(n)), ...shuffled.filter((n) => recent.has(n))];
  const out: string[] = [];
  const used = new Set<string>(exclude);
  for (let i = 0; out.length < count && i < pool.length * 2; i++) {
    const tag = pickTag(pool[i % pool.length]);
    if (used.has(tag) || (i < pool.length && recent.has(tag))) continue;
    used.add(tag);
    out.push(tag);
  }
  rememberNames(out);
  return out;
};

export interface PlayerColor {
  name: string;
  hex: number;
}

export const COLORS: PlayerColor[] = [
  { name: 'Blue', hex: 0x3d7bd9 },
  { name: 'Red', hex: 0xd9483d },
  { name: 'Orange', hex: 0xe08a2e },
  { name: 'Yellow', hex: 0xd9c43d },
  { name: 'Green', hex: 0x3db85a },
  { name: 'Teal', hex: 0x2fb8b0 },
  { name: 'Purple', hex: 0x8f3dd9 },
  { name: 'Pink', hex: 0xe05aa8 },
  { name: 'White', hex: 0xe6e6e6 },
  { name: 'Black', hex: 0x2b2b2b },
  { name: 'Lime', hex: 0x9ad93d },
  { name: 'Brown', hex: 0x8a5a33 }
];

export const cssColor = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;

/** True for colours too dark to read on the dark HUD panels; such names get a light outline. */
export const isDark = (css: string): boolean => {
  const n = parseInt(css.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 70;
};

export interface Identities {
  names: string[];
  colors: number[];
  /** Weapon skins by agent id (null = factory finish everywhere). */
  skins: (SkinChoice | null)[];
  /** Team colours for team modes, indexed by team (team 0 is yours). */
  teamColors: [number, number] | null;
}

/**
 * Names and colours for everyone in the match. In team modes everyone wears
 * their team's colour (picked at random, so you are not always blue); in
 * free-for-all modes you wear the colour you chose and nobody else does.
 */
export const assignIdentities = (match: Match, playerName: string, playerColor: number, playerSkins: SkinChoice = {}): Identities => {
  const agents = match.sim.agents;
  const tags = preset && preset.length >= agents.length - 1 ? [...preset] : withFriends(tagPool(agents.length));
  preset = null;
  friendsNext = [];
  let next = 0;
  const names = agents.map((a) => (a === match.player ? playerName : tags[next++ % tags.length]));
  // Other players: the camo they always run, if they have one (the game drops it for obvious bots).
  const skins = agents.map((a, i): SkinChoice | null => (a === match.player ? playerSkins : lookingLikeAPlayer(names[i], a.weapons)));
  if (match.mode === 'zombies') {
  // Survivors in blue, the horde in rotten green.
    const teamColors: [number, number] = [0x3d7bd9, 0x5f8a2f];
    return { names, colors: agents.map((a) => teamColors[a.team === 0 ? 0 : 1]), teamColors, skins };
  }
  if (match.def.teams) {
  // Your side is always blue, the other side red (colourblind modes swap these later).
    const teamColors: [number, number] = [COLORS[0].hex, COLORS[1].hex];
    return { names, colors: agents.map((a) => teamColors[a.team === match.player.team ? 0 : 1]), teamColors, skins };
  }
  // Opponents never wear yellow: yellow means you.
  const others = COLORS.filter((c) => c.name !== 'Yellow')
    .map((c) => c.hex)
    .filter((h) => h !== playerColor)
    .sort(() => Math.random() - 0.5);
  let k = 0;
  return { names, colors: agents.map((a) => (a === match.player ? playerColor : others[k++ % others.length])), teamColors: null, skins };
};

/** Colour for agents spawned after the match started (survival waves). */
export const lateJoinerColor = (ids: Identities, team: number): number =>
  ids.teamColors ? ids.teamColors[team === 0 ? 0 : 1] : COLORS[Math.floor(Math.random() * COLORS.length)].hex;

/** Names picked for the matchmaking screen, used by the next match so the lobby you watched fill up is the one you play. */
let preset: string[] | null = null;
export const prepareLobby = (count: number): string[] => {
  preset = withFriends(tagPool(count)).slice(0, count);
  return preset;
};

/** Bot friends you invited (or who invited you): they take the first seats on your side. */
let friendsNext: string[] = [];
export const bringFriends = (names: string[]): void => {
  friendsNext = names.slice(0, 3);
};
const withFriends = (tags: string[]): string[] => (friendsNext.length ? [...friendsNext, ...tags.filter((t) => !friendsNext.includes(t))] : tags);

/** Fresh names without touching the next match's lobby. */
export const freshNames = (count: number): string[] => tagPool(count);

/** Sets exactly who the next match's other players are (in agent order after you). */
export const presetLobby = (names: string[]): void => {
  preset = names.slice();
};

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** Random numbers fixed by a player's name, so the same person looks the same every match. */
export const nameRand = (name: string, salt: string): (() => number) => {
  let s = hash(`${name}#${salt}`);
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * The camo a player-like bot runs: the same every match for the same name, and only
 * what someone at their level could have earned. Most people run Factory; a few put
 * one camo on their main gun (sometimes their pistol too); only veterans have the
 * animated or mastery ones.
 */
export const lookingLikeAPlayer = (name: string, weapons: readonly string[]): SkinChoice | null => {
  const rand = nameRand(name, 'camo');
  const level = levelFor(name);
  if (level < 5 || rand() < 0.55) return null;
  const fancy = level >= 45 && rand() < 0.3;
  // Roughly the kills a player at this level has on their favourite gun.
  const budget = level * 6;
  const pool = SKINS.filter((k) => k.id !== 'none' && k.kills < 1_000_000 && (fancy ? !!k.kind : !k.kind && k.kills <= budget));
  if (!pool.length || !weapons[0]) return null;
  const camo = pool[Math.floor(rand() * pool.length)].id;
  return rand() < 0.35 && weapons[1] ? { [weapons[0]]: camo, [weapons[1]]: camo } : { [weapons[0]]: camo };
};

/**
 * A player's level (1-55), fixed per name. Default-name players are new; most
 * people sit in the middle; a few are maxed out.
 */
export const levelFor = (name: string): number => {
  const h = hash(name);
  const u = (h % 1000) / 1000;
  if (/^Player\d{4}$/.test(name)) return 1 + (h % 6);
  if (u < 0.25) return 2 + (h % 14);
  if (u < 0.8) return 15 + (h % 30);
  return 45 + (h % 11);
};

/** A believable connection for a player: mostly 20-80 ms, some laggier. */
export const basePingFor = (name: string): number => {
  const h = hash(name + '#ping');
  const u = (h % 1000) / 1000;
  return u < 0.75 ? 18 + (h % 60) : u < 0.95 ? 80 + (h % 60) : 140 + (h % 90);
};

/** A fresh name for someone joining mid-match (not already in `taken`). */
export const randomUsername = (taken: Iterable<string> = []): string => tagPool(1, taken)[0] ?? defaultUsername();
