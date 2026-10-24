import type { Match } from '../sim/Match';

/** Gamer tags for the other players in the lobby. */
const USERNAMES = [
  'xXSniperXx', 'NoScopeNinja', 'Ghost_42', 'TTV_Blaze', 'ShadowHunter', 'Kai2009', 'lil_tactics', 'FragMaster',
  'HeadshotHank', 'PixelPusher', 'Raptor_77', 'DarkKnight', 'sweatyboi', 'ItzJake', 'Vortex', 'MrClutch',
  'ZeroCool', 'BigChungus', 'Toxic_Tom', 'QuickScope', 'NightOwl', 'BlazeIt420', 'Sn1perW0lf', 'GG_EZ',
  'CampLord', 'Bulletproof', 'yeet_master', 'RektYou', 'SilentStorm', 'Phantom_X', 'TryHard99', 'CaptainLag',
  'Kr4ken', 'xD_Gamer', 'NoobSlayer', 'CoffeeAddict', 'ProbablyAFK', 'WiFiWarrior', 'Mav3rick', 'IceCold',
  'Reaper_01', 'Toaster', 'SweatLord', 'potato_aim', 'BoomHeadshot', 'Dr_Frag', 'Lethal_Lily', 'NovaStar',
  'ItsBrandon', 'Zyrex', 'Kappa_Pride', 'Wolfpack', 'FlickGod', 'eggplant', 'Juicy_J', 'LowPing',
  'Rambo2012', 'TacoTuesday', 'SneakyPete', 'ApexPred', 'Dingus', 'Viper_YT', 'Nebula', 'MomSaysBedtime',
  'Spray_n_Pray', 'Crimson', 'jxsh', 'Sergeant_Salt', 'OneTap', 'Hydra', 'BushCamper', 'LagSwitch',
  'Glitch', 'KillJoy', 'Valk', 'Tilted', 'Bandit', 'xXGamerGirlXx', 'Frosty', 'Orbit',
  'xX_Slayer_Xx', 'DeadEye', 'Specter', 'ToxicAvenger', 'KushKing', 'Mr_Bean_Bag', 'quickscopez', 'TTV_Ninja_Jr',
  'Zombie_Slayer', 'PewPewPew', 'Bacon_Strips', 'SaltyDog', 'clutch_or_kick', 'Nightmare', 'xXDarkLordXx', 'RageQuit',
  'Sp00ky', 'TheRealDeal', 'BigBoss', 'Shrek_Is_Love', 'ImHim', 'no_u', 'Bruh_Moment', 'Chad_Energy',
  'GoldenGun', 'AimBotAndy', 'Wh1sper', 'ColdBlooded', 'xxKillerxx', 'Ace_of_Spades', 'Gh0stRid3r', 'Panda_Express',
  'ChickenNugget', 'Mr_Sniper_Pants', 'LagMonster', 'ilovecats', 'WatermelonMan', 'Toast_Master', 'Steve', 'Kevin2011',
  'Aiden_YT', 'Liam_Plays', 'NoahTheGreat', 'ElijahGG', 'OliverTwist', 'JamesBond007', 'Lucas_Gamer', 'MasonMaster',
  'EthanHunt', 'LoganPaulFan', 'JacobTheGreat', 'MichaelMyers', 'Daniel_Sam', 'Henry_VIII', 'JackSparrow', 'Sebastian',
  'Mateo_10', 'Ryan_R', 'Carter_C', 'Jayden_J', 'Wyatt', 'Grayson', 'Leo_TheLion', 'Lincoln_Log',
  'Emma_Plays', 'OliviaRod', 'Ava_Max', 'SophiaS', 'Isabella', 'MiaMia', 'Charlotte_C', 'Amelia_A',
  'Harper', 'Evelyn', 'Abby_Gail', 'Em1ly', 'Ella_Ella', 'Lizzie', 'Scarlett_J', 'Zoey101',
  'Sn1pez', 'Frag_Out', 'Tango_Down', 'Charlie_Mike', 'Oscar_Mike', 'Danger_Close', 'Foxtrot', 'Bravo_Six',
  'Overwatch', 'Sierra117', 'MasterChief', 'Cortana', 'Arbiter', 'Spartan_Locke', 'Noble6', 'Kat_B320',
  'Soap_MacTavish', 'Ghost_Riley', 'Captain_Price', 'Gaz', 'Roach', 'Makarov', 'Zakhaev', 'Shepherd',
  'Leon_K', 'ClaireR', 'Jill_Valentine', 'ChrisRedfield', 'Ada_Wong', 'Wesker', 'Nemesis', 'Tyrant',
  'Kratos', 'Atreus', 'Ellie_W', 'JoelMiller', 'Abby_A', 'Arthur_Morgan', 'Dutch_V', 'JohnMarston',
  'Geralt', 'Ciri', 'Yennefer', 'Dandelion', 'Link_Hero', 'Zelda_Fan', 'Ganon', 'Navi_Hey_Listen',
  'Mario_Bros', 'LuigiTime', 'Wario64', 'Yoshi', 'KirbySucks', 'MetaKnight', 'Samus', 'FoxMcCloud',
  'Pikachu', 'Charizard', 'Mewtwo', 'Snorlax_Nap', 'Gengar', 'Lucario', 'Eevee', 'Bulbasaur',
  'creeper_aww_man', 'Herobrine', 'Notch_Fan', 'diamond_pickaxe', 'enderman', 'xXSteveXx', 'Alex_MC', 'Villager_Hmm',
  'Sus_Imposter', 'RedSus', 'Emergency_Meeting', 'vent_jumper', 'Crewmate', 'Ejected', 'Sabotage', 'TaskMaster',
  'FortniteKid', 'Default_Dance', 'BushWookie', 'TiltedTowers', 'VictoryRoyale', 'ChugJug', 'Llama_Drama', 'NoBuildPro',
  'Apex_Wraith', 'BloodhoundBro', 'LifelineHeal', 'Pathy', 'Octane_Stim', 'GibbyBubble', 'Caustic', 'Mirage_Bamboozle',
  'Valorant_Jett', 'Sage_Res', 'Reyna_Feed', 'PhoenixRise', 'Omen_Tp', 'CypherCam', 'KillJoy_Turret', 'Sova_Dart',
  'Tracer_Blink', 'Genji_Main', 'MercyMain', 'Reinhardt', 'D_Va', 'Widowmaker', 'Hanzo_Main', 'Lucio_Ball',
  'sigma_grindset', 'GigaChad', 'based_god', 'rizzlord', 'skibidi', 'ohio_final_boss', 'npc_behavior', 'touchgrass',
  'MainCharacter', 'goblin_mode', 'big_yikes', 'no_cap', 'bussin', 'lowkey_cracked', 'highkey_bad', 'sheeeesh',
  'DadBod42', 'SoccerMom', 'GrandpaGamer', 'WorkFromHome', 'OfficeSpace', 'MondayBlues', 'CasualFriday', 'Overtime',
  'PizzaRat', 'TrashPanda', 'Goose_Honk', 'DuckDuckGoose', 'Possum_Play', 'Sloth_Speed', 'TurboTurtle', 'Hamster_Wheel',
  'Captain_Crunch', 'FrootLoop', 'Cheerio', 'PopTart', 'Hot_Pocket', 'Mac_n_Cheese', 'Taco_Bell', 'Ramen_Noodle',
  'Thunder', 'Lightning', 'Blizzard', 'Typhoon', 'Tornado', 'Avalanche', 'Earthquake', 'Volcano',
  'Wraith', 'Banshee', 'Revenant', 'Poltergeist', 'Shade', 'Spirit', 'Wight', 'Lich_King',
  'Cobra', 'Mamba', 'Python', 'Rattler', 'Anaconda', 'Komodo', 'Gator', 'Croc',
  'Falcon', 'Hawk', 'Eagle_Eye', 'Raven', 'Crow', 'Owl', 'Condor', 'Vulture',
  'Titan', 'Atlas_Prime', 'Kronos', 'Hyperion', 'Prometheus', 'Zeus', 'Ares', 'Athena'
];

/** Common gamer-tag building blocks, combined for extra variety beyond the hand-picked list. */
const TAG_FIRST = ['Dark', 'Shadow', 'Silent', 'Toxic', 'Mad', 'Lil', 'Big', 'Pro', 'Epic', 'Savage', 'Frozen', 'Crimson', 'Rogue', 'Turbo', 'Hyper', 'Mega', 'Ultra', 'Sneaky', 'Lucky', 'Salty', 'Sweaty', 'Cracked', 'Feral', 'Spicy'];
const TAG_SECOND = ['Wolf', 'Sniper', 'Ninja', 'Viper', 'Reaper', 'Ghost', 'Hunter', 'Dragon', 'Tiger', 'Knight', 'Gamer', 'Slayer', 'Phoenix', 'Panda', 'Shark', 'Fox', 'Bandit', 'Rebel', 'Demon', 'Samurai', 'Pirate', 'Cowboy', 'Goblin', 'Potato'];

const generatedTag = (rand: () => number): string => {
  const a = TAG_FIRST[Math.floor(rand() * TAG_FIRST.length)];
  const b = TAG_SECOND[Math.floor(rand() * TAG_SECOND.length)];
  const style = rand();
  const n = Math.floor(rand() * 100);
  if (style < 0.25) return `${a}${b}${n}`;
  if (style < 0.45) return `${a}_${b}`;
  if (style < 0.6) return `xX${a}${b}Xx`;
  if (style < 0.75) return `${a.toLowerCase()}_${b.toLowerCase()}${n}`;
  if (style < 0.85) return `TTV_${a}${b}`;
  return `${a}${b}`;
};

/** Real-name style tags: "jake_2009", "TylerM", "emma.rose". */
const FIRST_NAMES = ['jake', 'tyler', 'ethan', 'mason', 'liam', 'noah', 'logan', 'aiden', 'caleb', 'ryan', 'kyle', 'austin', 'brandon', 'dylan', 'emma', 'olivia', 'ava', 'mia', 'chloe', 'maddie', 'jordan', 'alex', 'sam', 'chris', 'marcus', 'devon', 'jayden', 'carlos', 'luis', 'andre'];
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
  'ElTerrible', 'Chamaco_MX', 'ElPibe10', 'Calaca', 'LosPollosHermanos', 'xXElMatadorXx', 'Pancho_Villa', 'Guerrero', 'ElDiablito', 'ChupaCabra', 'Tío_Rico', 'NoMeMates',
  // Portuguese / Brazilian
  'BRZ_Matador', 'Capivara', 'Moleque_BR', 'kkkkkkk', 'Saci_Perere', 'Tranquilo', 'Brabo', 'Joãozinho',
  // French / German / Dutch / Nordic
  'LeFromage', 'Baguette_Sniper', 'Croissant', 'KartoffelKopf', 'Schnitzel99', 'DerJäger', 'Blitzkrieger', 'Ijsbeer', 'Stroopwafel', 'Viking_Øl', 'Hjärtat', 'Sisu',
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

/** A shuffled pool of unique tags. */
const tagPool = (count: number): string[] => {
  const pool = USERNAMES.slice().sort(() => Math.random() - 0.5);
  const out: string[] = [];
  const used = new Set<string>();
  for (const t of pool) {
    if (out.length >= count) break;
    const tag = pickTag(t);
    if (used.has(tag)) continue;
    used.add(tag);
    out.push(tag);
  }
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

/** Contrasting team pairs; one is picked per match and the sides are shuffled. */
const TEAM_PAIRS: [number, number][] = [
  [0, 1], // blue / red
  [4, 6], // green / purple
  [2, 5], // orange / teal
  [3, 7], // yellow / pink
  [8, 9], // white / black
  [1, 5] // red / teal
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
  /** Team colours for team modes, indexed by team (team 0 is yours). */
  teamColors: [number, number] | null;
}

/**
 * Names and colours for everyone in the match. In team modes everyone wears
 * their team's colour (picked at random, so you are not always blue); in
 * free-for-all modes you wear the colour you chose and nobody else does.
 */
export const assignIdentities = (match: Match, playerName: string, playerColor: number): Identities => {
  const agents = match.sim.agents;
  const tags = tagPool(agents.length);
  const names = agents.map((a, i) => (a === match.player ? playerName : tags[i % tags.length]));
  if (match.mode === 'zombies') {
    // Survivors in blue, the horde in rotten green.
    const teamColors: [number, number] = [0x3d7bd9, 0x5f8a2f];
    return { names, colors: agents.map((a) => teamColors[a.team === 0 ? 0 : 1]), teamColors };
  }
  if (match.def.teams) {
    const pair = TEAM_PAIRS[Math.floor(Math.random() * TEAM_PAIRS.length)];
    const flip = Math.random() < 0.5;
    const teamColors: [number, number] = [COLORS[pair[flip ? 1 : 0]].hex, COLORS[pair[flip ? 0 : 1]].hex];
    return { names, colors: agents.map((a) => teamColors[a.team === match.player.team ? 0 : 1]), teamColors };
  }
  const others = COLORS.map((c) => c.hex)
    .filter((h) => h !== playerColor)
    .sort(() => Math.random() - 0.5);
  let k = 0;
  return { names, colors: agents.map((a) => (a === match.player ? playerColor : others[k++ % others.length])), teamColors: null };
};

/** Colour for agents spawned after the match started (survival waves). */
export const lateJoinerColor = (ids: Identities, team: number): number =>
  ids.teamColors ? ids.teamColors[team === 0 ? 0 : 1] : COLORS[Math.floor(Math.random() * COLORS.length)].hex;

export const randomUsername = (): string => pickTag(USERNAMES[Math.floor(Math.random() * USERNAMES.length)]);
