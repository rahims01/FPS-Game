import { BOT_STYLES, STYLE_KIT, isHuman, magOf, setLoadout, type Agent, type Control, type DeathCause } from './Agent';
import type { AttachChoice } from './attachments';
import type { ArenaLayout, Point } from './Arena';
import { SIM } from './config';
import { FpsSim, type DamageRule, type PlayerInput, type Rally } from './FpsSim';
import { classicLayout, COURSE, courseLayout, randomLayout, rangeLayout } from './layouts';
import { yawTo } from './math';
import { GUN_GAME_KILLS_PER_TIER, GUN_GAME_LADDER, PRIMARIES, SECONDARIES, WEAPONS, type WeaponId } from './weapons';
import { DEFAULT_STREAKS, normalizeStreaks, streakDef, type StreakId } from './killstreaks';
import { hasPerk, LETHALS, normalizePerks, PERKS, TACTICALS, THROWABLES, type PerkId, type ThrowableId } from './gear';

const WEAPONS_NAME = (w: WeaponId) => WEAPONS[w].name;

export type ModeId =
  | '1v1'
  | '2v2'
  | '3v3'
  | 'tdm'
  | 'kc'
  | 'dom'
  | 'ctf'
  | 'koth'
  | 'infected'
  | 'ffa'
  | 'gungame'
  | 'headshot'
  | 'instagib'
  | 'snipers'
  | 'survival'
  | 'br'
  | 'jugg'
  | 'oitc'
  | 'sharp'
  | 'knife'
  | 'lowgrav'
  | 'bighead'
  | 'friends_ffa'
  | 'friends_tdm'
  | 'hideseek'
  | 'potato'
  | 'snd'
  | 'freeze'
  | 'vip'
  | 'hardcore'
  | 'lms'
  | 'zombies'
  | 'cranked'
  | 'roulette'
  | 'defender'
  | 'gunfight'
  | 'marksman'
  | 'training'
  | 'aimtrainer'
  | 'freeroam'
  | 'br_duos'
  | 'br_trios'
  | 'paintball'
  | 'boss'
  | 'course'
  | 'race'
  | 'tag'
  | 'dodgeball';

export interface ModeDef {
  id: ModeId;
  name: string;
  blurb: string;
  /** Players in the lobby, you included. */
  players: number;
  /** Two fixed teams (everyone wears their team's colour). */
  teams: boolean;
  /** Menu grouping. */
  group: 'Practice' | 'Team' | 'Objective' | 'Free-for-all' | 'Party' | 'Special' | 'Online only';
  /** Humans only: no computer players, so it needs friends online. */
  humansOnly?: boolean;
  /** Fewest humans needed to start (online-only modes). */
  minPlayers?: number;
}

export const MODES: ModeDef[] = [
  { id: 'training', name: 'Training Range', blurb: 'Target dummies at 10, 25 and 45 m, some strafing. Nobody shoots back. B tries the next gun, or the next pistol while holding your sidearm.', players: 1, teams: true, group: 'Practice' },
  { id: 'aimtrainer', name: 'Aim Trainer', blurb: '60 seconds: targets appear around the range, and each one you drop pops up somewhere else. Beat your best score.', players: 1, teams: true, group: 'Practice' },
  { id: 'course', name: 'Movement Course', blurb: 'A timed parkour run: steps, gap jumps, a beam, stepping stones and a tower. Don’t touch the ground. Beat your best time.', players: 1, teams: true, group: 'Practice' },
  { id: 'freeroam', name: 'Free Roam', blurb: 'A big random map with nobody hunting you. Explore, practise movement, try guns and pistols (B). Bring friends online.', players: 1, teams: true, group: 'Practice' },
  { id: 'tdm', name: 'Team Deathmatch', blurb: '5v5 with respawns. First team to 40 kills.', players: 10, teams: true, group: 'Team' },
  { id: 'kc', name: 'Kill Confirmed', blurb: "5v5. A kill only counts when someone grabs the dog tags. Grab your team's tags to deny. First to 30.", players: 10, teams: true, group: 'Team' },
  { id: '1v1', name: '1v1 Duel', blurb: 'Just you and one opponent. Rounds, first to 5.', players: 2, teams: true, group: 'Team' },
  { id: '2v2', name: '2v2 Gunfight', blurb: 'Two a side, no respawns. First to 5 rounds.', players: 4, teams: true, group: 'Team' },
  { id: '3v3', name: '3v3 Gunfight', blurb: 'Three a side, no respawns. First to 5 rounds.', players: 6, teams: true, group: 'Team' },
  { id: 'dom', name: 'Domination', blurb: '6v6. Capture and hold flags A, B and C to score. First to 150.', players: 12, teams: true, group: 'Objective' },
  { id: 'ctf', name: 'Capture the Flag', blurb: "5v5. Steal the enemy flag and bring it home while yours is safe. First to 3 captures.", players: 10, teams: true, group: 'Objective' },
  { id: 'koth', name: 'Hardpoint', blurb: '4v4. Hold the hill alone to score; it moves every 45 s. First to 60.', players: 8, teams: true, group: 'Objective' },
  { id: 'infected', name: 'Infected', blurb: 'One player starts infected with a knife. Anyone they kill joins them. Survivors must last 3 minutes.', players: 10, teams: true, group: 'Objective' },
  { id: 'ffa', name: 'Free-for-all', blurb: '8 players, everyone for themselves. First to 20 kills.', players: 8, teams: false, group: 'Free-for-all' },
  { id: 'gungame', name: 'Gun Game', blurb: 'Every 2 kills upgrades your gun: pistol, SMG, shotgun, rifle, LMG, sniper, knife. A knife kill wins. Get knifed and you drop a gun.', players: 8, teams: false, group: 'Free-for-all' },
  { id: 'snipers', name: 'Snipers Only', blurb: 'Free-for-all with bolt-action snipers. First to 15.', players: 8, teams: false, group: 'Free-for-all' },
  { id: 'headshot', name: 'Headhunters', blurb: 'Free-for-all where only headshots do damage. First to 15.', players: 8, teams: false, group: 'Free-for-all' },
  { id: 'instagib', name: 'One Shot', blurb: 'Free-for-all where any hit kills. First to 25.', players: 8, teams: false, group: 'Free-for-all' },
  { id: 'jugg', name: 'Juggernaut', blurb: 'One armoured Juggernaut with an LMG against everyone. Kill them to become them. Score a point per second as the Juggernaut; first to 100.', players: 8, teams: false, group: 'Party' },
  { id: 'oitc', name: 'One in the Chamber', blurb: 'A pistol with one bullet and a knife. Every hit kills, every kill earns a bullet. Three lives; last one standing wins.', players: 8, teams: false, group: 'Party' },
  { id: 'sharp', name: 'Sharpshooter', blurb: 'Everyone gets the same random gun, and it changes every 30 seconds. First to 20.', players: 8, teams: false, group: 'Party' },
  { id: 'knife', name: 'Knife Fight', blurb: 'Knives only. First to 15.', players: 8, teams: false, group: 'Party' },
  { id: 'lowgrav', name: 'Low Gravity', blurb: 'Free-for-all with moon jumps. First to 20.', players: 8, teams: false, group: 'Party' },
  { id: 'bighead', name: 'Big Heads', blurb: 'Huge heads, huge headshot hitboxes. First to 20.', players: 8, teams: false, group: 'Party' },
  { id: 'friends_ffa', name: 'Friends Free-for-all', blurb: 'Just you and your friends, no computer players. First to 25.', players: 2, teams: false, group: 'Online only', humansOnly: true, minPlayers: 2 },
  { id: 'race', name: 'Race', blurb: 'Everyone on the movement course at once. Jumps, gaps, a beam and a tower: first across the finish wins. Fall and you go back to your last checkpoint.', players: 2, teams: false, group: 'Online only', humansOnly: true, minPlayers: 2 },
  { id: 'tag', name: 'Tag', blurb: 'One player is IT. Hit someone with your melee to pass it on (no tag-backs for 2 s). After 2½ minutes, whoever was IT for the least time wins.', players: 2, teams: false, group: 'Online only', humansOnly: true, minPlayers: 2 },
  { id: 'dodgeball', name: 'Dodgeball', blurb: 'Two teams, unlimited balls, one hit and you’re out for the round. Throw with your lethal key. First team to 3 rounds.', players: 2, teams: true, group: 'Online only', humansOnly: true, minPlayers: 2 },
  { id: 'friends_tdm', name: 'Friends Team Deathmatch', blurb: 'Friends split into two teams, no computer players. First team to 30.', players: 2, teams: true, group: 'Online only', humansOnly: true, minPlayers: 2 },
  { id: 'hideseek', name: 'Hide & Seek', blurb: 'Seekers are blindfolded for 20 s while everyone hides. Found hiders join the seekers. Hiders win if anyone lasts 3 minutes.', players: 3, teams: true, group: 'Online only', humansOnly: true, minPlayers: 3 },
  { id: 'potato', name: 'Hot Potato', blurb: 'One player holds a ticking bomb and passes it on with a knife hit. Holding it when it blows = out. Last one standing wins.', players: 3, teams: false, group: 'Online only', humansOnly: true, minPlayers: 3 },
  { id: 'snd', name: 'Search & Destroy', blurb: '4v4, one life per round. Attackers plant the bomb at A or B; defenders stop them or defuse it. First to 4 rounds.', players: 8, teams: true, group: 'Objective' },
  { id: 'freeze', name: 'Freeze Tag', blurb: '5v5. Kills freeze instead of killing. Stand next to a frozen teammate to thaw them. Freeze the whole enemy team to win the round. First to 3.', players: 10, teams: true, group: 'Objective' },
  { id: 'vip', name: 'Kill Order', blurb: 'Each team has a VIP. Kill the enemy VIP to score; protect yours. 5v5, first to 8.', players: 10, teams: true, group: 'Team' },
  { id: 'hardcore', name: 'Hardcore TDM', blurb: 'Team deathmatch with triple damage, no health regen, no crosshair and no minimap. First to 40.', players: 10, teams: true, group: 'Team' },
  { id: 'cranked', name: 'Cranked', blurb: '5v5. A kill makes you faster for 30 s, but if you fail to get another kill in time, you explode. First team to 40.', players: 10, teams: true, group: 'Team' },
  { id: 'defender', name: 'Team Defender', blurb: '5v5. Grab the flag and keep it: kills by the team holding it are worth double. First to 60 points.', players: 10, teams: true, group: 'Objective' },
  { id: 'gunfight', name: 'Gunfight Roulette', blurb: '2v2, no respawns. Every round everyone gets the same random loadout. First to 5 rounds.', players: 4, teams: true, group: 'Team' },
  { id: 'roulette', name: 'Weapon Roulette', blurb: 'Free-for-all where every life hands you a random gun. First to 20.', players: 8, teams: false, group: 'Party' },
  { id: 'marksman', name: 'Marksmen', blurb: 'DMRs and magnums only. Free-for-all, first to 20.', players: 8, teams: false, group: 'Free-for-all' },
  { id: 'lms', name: 'Last Man Standing', blurb: '8 players, normal loadouts, 3 lives each. Last one standing wins.', players: 8, teams: false, group: 'Free-for-all' },
  { id: 'zombies', name: 'Zombies', blurb: 'Waves of zombies that get faster and tougher every round. Play co-op online with friends. Survive as long as you can.', players: 1, teams: true, group: 'Special' },
  { id: 'br', name: 'Battle Royale', blurb: 'Huge random 250 m map, 24 players, one life. Grab medkits and stay inside the shrinking zone.', players: 24, teams: false, group: 'Special' },
  { id: 'br_duos', name: 'Battle Royale Duos', blurb: '24 players in 12 pairs on a huge random map. Stick with your partner; the last pair standing wins.', players: 24, teams: false, group: 'Special' },
  { id: 'br_trios', name: 'Battle Royale Trios', blurb: '24 players in 8 squads of three. The last squad standing wins.', players: 24, teams: false, group: 'Special' },
  { id: 'paintball', name: 'Paintball', blurb: 'Friends only. Two teams, one paint hit and you are out until you respawn. First team to 30 splats.', players: 2, teams: true, group: 'Online only', humansOnly: true, minPlayers: 2 },
  { id: 'boss', name: 'Boss Fight', blurb: 'Friends only, co-op. Take down a giant armoured boss with an LMG, airstrikes and minions. Three lives each.', players: 2, teams: true, group: 'Online only', humansOnly: true, minPlayers: 2 },
  { id: 'survival', name: 'Survival', blurb: 'Hold out against endless waves. One life, health refills between waves.', players: 1, teams: true, group: 'Special' }
];

export const modeDef = (id: ModeId): ModeDef => MODES.find((m) => m.id === id)!;

export type Difficulty = 'easy' | 'normal' | 'hard';

const DIFFICULTY: Record<Difficulty, { skill: number; damageToPlayer: number }> = {
  easy: { skill: 1.7, damageToPlayer: 0.45 },
  normal: { skill: 1.1, damageToPlayer: 0.7 },
  hard: { skill: 0.7, damageToPlayer: 1 }
};

/** Host-chosen rules for a private online lobby. */
export interface LobbyRules {
  /** Health multiplier: 0.5 (fragile) .. 2 (tanky). */
  health: number;
  gravity: 'normal' | 'low' | 'high';
  /** Score target multiplier. */
  score: number;
  /** Every player's primary weapon, or 'any' for their own pick. */
  weapon: WeaponId | 'any';
  /** Fill empty slots with computer players. */
  bots: boolean;
  regen: boolean;
  time: 'day' | 'night' | 'random';
}

export const DEFAULT_RULES: LobbyRules = { health: 1, gravity: 'normal', score: 1, weapon: 'any', bots: true, regen: true, time: 'random' };

export interface MatchOptions {
  mode: ModeId;
  difficulty: Difficulty;
  /** The player's throwables and perks. */
  lethal?: ThrowableId;
  tactical?: ThrowableId;
  perks?: PerkId[];
  /** Exact opponent difficulty (ranked), overriding `difficulty`. */
  skill?: { skill: number; damageToPlayer: number };
  /** The player's secondary weapon. */
  secondary?: WeaponId;
  /** The player's chosen killstreaks. */
  streaks?: StreakId[];
  /** Private-lobby rules (online). */
  rules?: LobbyRules;
  /** Night map: dark, with flashlights (decided by the host or at random). */
  night?: boolean;
  /** How the other players choose actions: the trained policy, or the hand-written baseline. */
  botControl: Control;
  /** The player's primary weapon. */
  primary?: WeaponId;
  /** Humans in an online lobby (host included); humans-only modes spawn exactly this many players. */
  humans?: number;
  seed?: number;
  /** Watch this player (a bot friend) instead of playing: your soldier is played by the computer. */
  watch?: string;
  /** Your weapon attachments. */
  attachments?: AttachChoice;
}

export type MatchPhase = 'live' | 'roundOver' | 'over';

/** Things the HUD announces: killstreaks, captures, confirms. */
export type MatchNotice =
  | { kind: 'streak'; id: StreakId; name: string; kills: number; agent: number }
  | { kind: 'cranked'; agent: number; event: 'cranked' | 'exploded' }
  | { kind: 'defender'; event: 'taken' | 'dropped'; agent: number; team: number }
  | { kind: 'boss'; event: 'phase' | 'minions' | 'down'; phase: number }
  | { kind: 'capture'; flag: string; team: number; on: number[] }
  | { kind: 'tag'; confirmed: boolean; by: number }
  | { kind: 'promote'; weapon: WeaponId; agent: number }
  | { kind: 'demote'; weapon: WeaponId; agent: number }
  | { kind: 'infected'; by: number; victim: number }
  | { kind: 'jugg'; agent: number }
  | { kind: 'sharp'; weapon: WeaponId }
  | { kind: 'potato'; holder: number; from: number }
  | { kind: 'tagit'; holder: number; from: number }
  | { kind: 'course'; agent: number; checkpoint: number; name: string; finished: boolean; time: number }
  | { kind: 'frozen'; agent: number; by: number }
  | { kind: 'thawed'; agent: number; by: number[] }
  | { kind: 'vip'; agent: number; team: number }
  | { kind: 'vipkill'; by: number; team: number }
  | { kind: 'snd'; event: 'planted' | 'defused' | 'exploded' | 'pickup' | 'dropped'; by: number; site: string }
  | { kind: 'ctf'; event: 'taken' | 'captured' | 'returned' | 'dropped'; team: number; by: number };

/** Capture the flag: one flag per team. */
export interface CtfFlag {
  team: number;
  homeX: number;
  homeZ: number;
  x: number;
  z: number;
  /** Agent carrying it, or -1. */
  carrier: number;
  home: boolean;
  droppedAt: number;
}

export interface Flag {
  label: string;
  x: number;
  z: number;
  r: number;
  /** -1 neutral, else team. */
  owner: number;
  /** -1 (team 1 owns) .. +1 (team 0 owns). */
  progress: number;
}

const ROUND_TARGET = 5;
const BR_HALF = 125;
const BR_PLAYERS = 24;
const ROUND_BREAK = 3.5;
const KILLCAM_BREAK = 6.5;
const WAVE_BREAK = 5;
const HILL_R = 4.5;
const HILL_MOVE = 45;
const INFECTED_TIME = 180;
/** Score to win for each mode that has one. */
export const TARGETS: Partial<Record<ModeId, number>> = {
  '1v1': ROUND_TARGET,
  '2v2': ROUND_TARGET,
  '3v3': ROUND_TARGET,
  tdm: 40,
  kc: 30,
  dom: 150,
  dodgeball: 3,
  ctf: 3,
  koth: 60,
  ffa: 20,
  headshot: 15,
  instagib: 25,
  snipers: 15,
  sharp: 20,
  knife: 15,
  lowgrav: 20,
  bighead: 20,
  friends_ffa: 25,
  friends_tdm: 30,
  jugg: 100,
  hardcore: 40,
  vip: 8,
  snd: 4,
  freeze: 3,
  cranked: 40,
  defender: 60,
  gunfight: ROUND_TARGET,
  roulette: 20,
  marksman: 20,
  paintball: 30
};
const FFA_MODES: ModeId[] = ['ffa', 'headshot', 'instagib', 'snipers', 'gungame', 'jugg', 'oitc', 'sharp', 'knife', 'lowgrav', 'bighead', 'friends_ffa', 'potato', 'lms', 'roulette', 'marksman'];
const RESPAWN_MODES: ModeId[] = [
  'ffa',
  'headshot',
  'instagib',
  'snipers',
  'gungame',
  'tdm',
  'kc',
  'dom',
  'ctf',
  'koth',
  'infected',
  'jugg',
  'oitc',
  'sharp',
  'knife',
  'lowgrav',
  'bighead',
  'friends_ffa',
  'friends_tdm',
  'hideseek',
  'lms',
  'vip',
  'hardcore',
  'cranked',
  'defender',
  'roulette',
  'marksman',
  'training',
  'freeroam',
  'paintball',
  'boss'
];
const CRANK_TIME = 30;
/** Calm modes with no opponents: no matchmaking, XP, camo progress or killcams. */
/** Tag lasts this long (seconds). */
const TAG_TIME = 150;
/** The rules run every 6 sim ticks. */
const RULE_DT = 6 / 60;

export const PRACTICE_MODES: ModeId[] = ['training', 'aimtrainer', 'freeroam', 'course'];
const AIM_TIME = 60;
/** Battle-royale squad sizes. */
const SQUAD_SIZE: Partial<Record<ModeId, number>> = { br_duos: 2, br_trios: 3 };
export const isBrMode = (m: ModeId): boolean => m === 'br' || m === 'br_duos' || m === 'br_trios';
const BOSS_LIVES = 3;
/** Squad battle royale: seconds before a downed player redeploys next to a living squadmate. */
const SQUAD_RESPAWN = 30;
const AIM_COUNTDOWN = 3;
/** The range's shooting line (targets are placed at distances from it). */
const RANGE_Z = -30;
/** Respawn modes where a matchmade lobby sees people leave and join. */
const CHURN_MODES: ModeId[] = ['tdm', 'kc', 'dom', 'ctf', 'koth', 'ffa', 'headshot', 'instagib', 'snipers', 'sharp', 'lowgrav', 'bighead', 'hardcore', 'cranked', 'defender', 'roulette', 'marksman', 'knife'];
/** Every gun but the knife, for roulette loadouts. */
const ROULETTE_POOL: WeaponId[] = [...PRIMARIES, ...SECONDARIES];
const SND_FUSE = 35;
const SND_PLANT = 3.5;
const SND_DEFUSE = 6;
const SND_ROUND = 120;
const THAW_TIME = 2.5;
const SHARP_POOL: WeaponId[] = ['rifle', 'smg', 'shotgun', 'sniper', 'lmg', 'pistol', 'ak', 'burst', 'dmr', 'revolver'];
const OITC_LIVES = 3;
const HIDE_TIME = 20;
const SEEK_TIME = 180;
const FLAG_RETURN = 20;
const HILLS: Point[] = [
  { x: 0, z: -12 },
  { x: 12, z: 0 },
  { x: 0, z: 12 },
  { x: -12, z: 0 }
];
/** Weighted primaries for the other players. */
const PRIMARY_POOL: WeaponId[] = ['rifle', 'rifle', 'rifle', 'smg', 'smg', 'shotgun', 'lmg', 'sniper'];

/** One battle-royale zone phase: hold, then shrink to `r` over `shrink` seconds. */
const BR_PHASES = [
  { hold: 60, shrink: 45, scale: 0.6, dps: 2 },
  { hold: 45, shrink: 40, scale: 0.55, dps: 4 },
  { hold: 35, shrink: 30, scale: 0.5, dps: 7 },
  { hold: 25, shrink: 25, scale: 0.45, dps: 10 },
  { hold: 20, shrink: 20, scale: 0.4, dps: 13 },
  { hold: 15, shrink: 18, scale: 0.0, dps: 18 }
];

/**
 * Game rules on top of the simulation: spawns, loadouts, scores, rounds,
 * waves, objectives, killstreaks, the battle-royale zone and pickups. Pure
 * TypeScript, so a match can run headless exactly as it runs in the browser.
 */
export class Match {
  readonly sim: FpsSim;
  readonly mode: ModeId;
  readonly def: ModeDef;
  /** The local player (on an online client, the agent this browser controls). */
  player!: Agent;
  phase: MatchPhase = 'live';
  /** Rounds won, team kills, confirms, flag points or hill points, by team. */
  scores: [number, number] = [0, 0];
  round = 1;
  wave = 0;
  /** Time at which the current break (round over, wave break) ends. */
  breakUntil = 0;
  banner = '';
  bannerUntil = 0;
  result: 'win' | 'lose' | null = null;
  /** Battle-royale placement of the player (1 = winner). */
  placement = 0;
  /** Hardpoint: which team holds it right now (-1 none, -2 contested). */
  hillHolder = -1;
  flags: Flag[] = [];
  ctf: CtfFlag[] = [];
  /** Party modes. */
  party = {
    juggId: -1,
    /** Juggernaut seconds, by agent id. */
    points: {} as Record<number, number>,
    sharpWeapon: 'rifle' as WeaponId,
    sharpNext: 0,
    holder: -1,
    explodeAt: 0,
    passCd: 0,
    /** Tag: who was IT before (they can't be tagged straight back). */
    lastIt: -1,
    nextBomb: 3,
    hideRelease: -1,
    /** Search & Destroy. */
    snd: {
      attackers: 0,
      sites: [] as { label: string; x: number; z: number }[],
      site: 0,
      state: 'carried' as 'carried' | 'dropped' | 'planted' | 'done',
      carrier: -1,
      bx: 0,
      bz: 0,
      plant: 0,
      defuse: 0,
      plantedAt: 0,
      roundStart: 0
    },
    /** Movement course and Race: checkpoint reached, start and finish times, by agent id. */
    course: { cp: {} as Record<number, number>, started: {} as Record<number, number>, finished: {} as Record<number, number>, falls: {} as Record<number, number> },
    /** Tag: seconds each player has been IT. */
    itTime: {} as Record<number, number>,
    /** Freeze tag: thaw progress by agent id. */
    thaw: {} as Record<number, number>,
    /** Kill order: VIP agent per team (-1 = being chosen). */
    vipIds: [-1, -1] as [number, number],
    /** Cranked: when each cranked player explodes, by agent id. */
    cranked: {} as Record<number, number>,
    /** Team defender: the flag. */
    defender: { carrier: -1, x: 0, z: 0 },
    /** Counter-UAV: minimaps of this team are jammed until then, by team. */
    jamUntil: {} as Record<number, number>,
    /** Aim trainer: when the run ends, and the best score so far (set by the game). */
    aimEnd: 0,
    aimBest: 0,
    /** Boss fight: the boss, its phase (0..2) and its armour per point of health. */
    bossId: -1,
    bossPhase: 0
  };
  /** Players who left mid-match (their slot is empty), by agent id. */
  private away = new Set<number>();
  /** Team kills by players who have since left. */
  private bankedKills: [number, number] = [0, 0];
  /** Killstreak picks for humans, by agent id. */
  streakChoices: Record<number, StreakId[]> = {};
  private pendingStrikes: { at: number; agent: number }[] = [];
  private adrenalineUntil = new Map<number, number>();
  /** Score target multiplier (private lobby rules). */
  private targetMul = 1;
  /** UAV killstreak: enemies show on that player's minimap until this time, by agent id. */
  uavUntil: Record<number, number> = {};
  /** Team that won (or the winner's team in free-for-all), -1 if none. */
  winTeam = -1;
  /** Team-relative banner: shown as `banner` to `bannerTeam`, as `bannerOther` to everyone else. */
  bannerTeam = -1;
  bannerOther = '';
  readonly notices: MatchNotice[] = [];
  readonly startTime: number;
  hillIndex = 0;
  hillMovedAt = 0;
  waveQueue = 0;
  private respawnAt = new Map<number, number>();
  brPhase = -1;
  brPhaseStart = 0;
  zoneFrom = { x: 0, z: 0, r: 0 };
  zoneTo = { x: 0, z: 0, r: 0 };
  private nextMedkitT = 0;
  private lastScoreTick = 0;
  readonly opts: MatchOptions;

  constructor(opts: MatchOptions) {
    this.opts = opts;
    this.mode = opts.mode;
    this.def = modeDef(opts.mode);
    const mode = opts.mode;
    const seed = opts.seed ?? (Math.random() * 1e9) | 0;
    const layout: ArenaLayout =
      mode === 'training' || mode === 'aimtrainer'
        ? rangeLayout()
        : mode === 'course' || mode === 'race'
          ? courseLayout()
          : mode === 'tag'
            ? randomLayout(seed, 30)
            : mode === 'dodgeball'
              ? randomLayout(seed, 24)
        : mode === 'freeroam'
          ? randomLayout(seed, 70)
          : mode === 'boss'
            ? randomLayout(seed, 34)
            : mode === 'paintball'
              ? randomLayout(seed, 36)
          : isBrMode(mode)
        ? randomLayout(seed, BR_HALF)
        : ['tdm', 'kc', 'dom', 'ctf', 'infected', 'hideseek', 'friends_tdm', 'snd', 'freeze', 'vip', 'hardcore', 'cranked', 'defender'].includes(mode)
          ? randomLayout(seed, 42)
          : FFA_MODES.includes(mode)
            ? randomLayout(seed, 36)
            : classicLayout();
    const diff = opts.skill ?? DIFFICULTY[opts.difficulty];
    const rules = opts.rules ?? DEFAULT_RULES;
    this.targetMul = rules.score;
    const damageRule: DamageRule = mode === 'headshot' ? 'headshot' : mode === 'instagib' || mode === 'oitc' ? 'instagib' : mode === 'potato' || mode === 'course' || mode === 'race' || mode === 'tag' ? 'none' : 'normal';
    this.sim = new FpsSim({
      seed,
      layout,
      damageToPlayerScale: diff.damageToPlayer,
      regen: mode !== 'br' && mode !== 'hardcore' && rules.regen,
      hunt: mode !== 'br',
      damageRule,
      ...(isBrMode(mode) ? { viewRange: 40, hearingRange: 30 } : {})
    });
    const sim = this.sim;
    this.startTime = 0;
    const other = (team: number, p: Point) => {
      const a = sim.spawn(team, opts.botControl, p.x, p.z, yawTo(p.x, p.z, 0, 0));
      a.style = BOT_STYLES[sim.rng.int(BOT_STYLES.length)];
      a.skill = diff.skill * STYLE_KIT[a.style].aim * (0.85 + sim.rng.next() * 0.3);
      return a;
    };

    // Without computer players to fill the lobby, only the humans play (at least two sides).
    const fill = !this.def.humansOnly && rules.bots;
    const humans = Math.max(1, opts.humans ?? 1);
    const lobby = this.def.humansOnly ? humans : fill ? this.def.players : Math.min(this.def.players, Math.max(2, humans));
    if (SQUAD_SIZE[mode]) {
      // Squads land together: one spawn point per squad, members a couple of metres apart.
      const size = SQUAD_SIZE[mode]!;
      const count = fill ? BR_PLAYERS : Math.max(2, humans);
      const squads = Math.ceil(count / size);
      // Landing spots spread across the map, as far apart as we can find.
      const H = sim.arena.half;
      const spots: Point[] = [];
      for (let s = 0; s < squads; s++) {
        let best: Point | null = null;
        let bestD = -1;
        for (let k = 0; k < 40; k++) {
          const p = sim.arena.randomFreePoint(() => sim.rng.next(), 0, 0, H * 0.92);
          if (!p) continue;
          const d = Math.min(Infinity, ...spots.map((q) => Math.hypot(q.x - p.x, q.z - p.z)));
          if (d > bestD) {
            bestD = d;
            best = p;
          }
        }
        spots.push(best ?? { x: 0, z: 0 });
      }
      for (let i = 0; i < count; i++) {
        const team = Math.floor(i / size);
        const k = i % size;
        const base = spots[team];
        const p = sim.arena.randomFreePoint(() => sim.rng.next(), base.x + (k - 1) * 2, base.z, 2) ?? base;
        if (i === 0) this.player = sim.spawn(team, 'player', p.x, p.z, 0);
        else other(team, p).squad = team;
      }
      this.player.squad = 0;
    } else if (mode === 'boss') {
      const spawns = sim.arena.teamSpawns[0];
      this.player = sim.spawn(0, 'player', spawns[0].x, spawns[0].z, 0);
      for (let i = 1; i < humans; i++) sim.spawn(0, opts.botControl, spawns[i % spawns.length].x, spawns[i % spawns.length].z, 0);
    } else if (PRACTICE_MODES.includes(mode)) {
      // Everyone (you and any friends) on the shooting line, on one team.
      const spawns = sim.arena.teamSpawns[0];
      this.player = sim.spawn(0, 'player', spawns[0].x, spawns[0].z, mode === 'freeroam' ? 0 : 0);
      for (let i = 1; i < humans; i++) sim.spawn(0, opts.botControl, spawns[i % spawns.length].x, spawns[i % spawns.length].z, 0);
    } else if (mode === 'infected' || mode === 'hideseek') {
      // Everyone starts on the same side, spread out; the first infected / seekers are picked later.
      const spawns = shuffle(sim.arena.spawns.slice(), () => sim.rng.next());
      this.player = sim.spawn(0, 'player', spawns[0].x, spawns[0].z, yawTo(spawns[0].x, spawns[0].z, 0, 0));
      for (let i = 1; i < lobby; i++) other(0, spawns[i % spawns.length]);
    } else if (this.def.teams && mode !== 'survival' && mode !== 'zombies') {
      const n0 = Math.ceil(lobby / 2);
      const n1 = Math.floor(lobby / 2);
      const [s0, s1] = sim.arena.teamSpawns;
      const at = (s: Point[], i: number) => (i < s.length ? s[i] : { x: s[i % s.length].x + 1.2 * Math.floor(i / s.length), z: s[i % s.length].z });
      this.player = sim.spawn(0, 'player', s0[0].x, s0[0].z, yawTo(s0[0].x, s0[0].z, 0, 0));
      for (let i = 1; i < n0; i++) other(0, at(s0, i));
      for (let i = 0; i < n1; i++) other(1, at(s1, i));
    } else if (mode === 'survival' || mode === 'zombies') {
      const p = sim.arena.teamSpawns[0][0];
      this.player = sim.spawn(0, 'player', 0, -7, yawTo(p.x, p.z, 0, 0));
    } else {
      // Free-for-all styles and battle royale: everyone on their own team.
      const spawns = shuffle(sim.arena.spawns.slice(), () => sim.rng.next());
      this.player = sim.spawn(0, 'player', spawns[0].x, spawns[0].z, yawTo(spawns[0].x, spawns[0].z, 0, 0));
      const count = isBrMode(mode) ? (fill ? BR_PLAYERS : Math.max(2, humans)) : lobby;
      for (let i = 1; i < count; i++) {
        const p = spawns[i % spawns.length];
        other(i, { x: p.x + (i >= spawns.length ? 2 : 0), z: p.z });
      }
    }

    // Loadouts.
    for (const a of sim.agents) {
      if (mode === 'gungame') setLoadout(a, [GUN_GAME_LADDER[0]]);
      else if (mode === 'snipers') setLoadout(a, ['sniper', 'pistol']);
      else if (mode === 'knife' || mode === 'potato' || mode === 'hideseek' || mode === 'course' || mode === 'race' || mode === 'tag' || mode === 'dodgeball') {
        setLoadout(a, ['knife']);
        a.grenades = 0;
      } else if (mode === 'oitc') {
        setLoadout(a, ['pistol']);
        a.ammo = 1;
        a.grenades = 0;
      }
      else if (mode === 'roulette') setLoadout(a, this.rouletteLoadout());
      else if (mode === 'marksman') setLoadout(a, ['dmr', 'revolver']);
      else if (mode === 'gunfight') continue;
      else if (rules.weapon !== 'any') setLoadout(a, [rules.weapon, a === this.player ? (opts.secondary ?? 'pistol') : 'pistol']);
      else if (a === this.player) setLoadout(a, [opts.primary ?? 'rifle', opts.secondary ?? 'pistol']);
      else {
        const kit = STYLE_KIT[a.style];
        setLoadout(a, [kit.guns[sim.rng.int(kit.guns.length)], sim.rng.next() < 0.25 ? 'revolver' : 'pistol']);
      }
    }
    if (mode === 'gunfight') this.gunfightLoadout();
    // Your attachments (online players get theirs from the host's session).
    if (opts.attachments && !opts.watch) {
      this.player.attach = opts.attachments;
      setLoadout(this.player, this.player.weapons);
    }
    // Throwables and perks: yours from the loadout, everyone else's picked at random.
    for (const a of sim.agents) {
      if (a === this.player) {
        a.lethal = opts.lethal ?? 'frag';
        a.tactical = opts.tactical ?? 'flash';
        a.perks = normalizePerks(opts.perks);
      } else this.randomGear(a);
      const noThrows = mode === 'knife' || mode === 'oitc' || mode === 'potato' || mode === 'hideseek' || mode === 'paintball' || mode === 'course' || mode === 'race' || mode === 'tag';
      if (mode === 'dodgeball') a.lethal = 'ball';
      a.grenades = noThrows ? 0 : THROWABLES[a.lethal].count;
      a.tacticals = noThrows || mode === 'dodgeball' ? 0 : THROWABLES[a.tactical].count;
    }
    // Matchmade lobbies (not online rooms): the odd smurf, and now and then a squad of friends queued together.
    if (!opts.rules && !this.def.humansOnly && !PRACTICE_MODES.includes(mode)) {
      for (const a of sim.agents) {
        if (a === this.player || sim.rng.next() > 0.04) continue;
        a.smurf = true;
        a.skill *= 0.5;
      }
      if (this.def.teams && this.def.players >= 8 && sim.rng.next() < 0.15) {
        const team = sim.rng.next() < 0.5 ? 0 : 1;
        const mates = sim.agents.filter((a) => a !== this.player && a.team === team).slice(0, 2 + sim.rng.int(2));
        for (const a of mates) a.squad = 100;
      }
    }
    // Private-lobby rules.
    if (rules.health !== 1) sim.damageMul /= rules.health;
    if (rules.gravity === 'low') {
      sim.gravity = 6.5;
      sim.jumpMul = 1.45;
    } else if (rules.gravity === 'high') {
      sim.gravity = 34;
      sim.jumpMul = 0.85;
    }
    this.streakChoices[this.player.id] = normalizeStreaks(opts.streaks ?? DEFAULT_STREAKS);
    sim.onKill = (v, k, cause) => this.onKill(v, k, cause);
    // A player or two is still loading in when the match starts.
    if (RESPAWN_MODES.includes(mode) || isBrMode(mode)) {
      for (const a of sim.agents) if (a !== this.player && sim.rng.next() < 0.12) a.afkUntil = 2 + sim.rng.next() * 7;
    }

    switch (mode) {
      case 'koth':
        this.placeHill(0);
        this.announce('Capture the hardpoint');
        break;
      case 'tdm':
        this.announce(`First team to ${this.goal('tdm')} kills`);
        break;
      case 'kc':
        sim.botsWantTags = true;
        sim.onPickup = (a, p) => {
          if (p.kind !== 'tag') return;
          const confirmed = a.team !== p.team;
          if (confirmed) this.scores[a.team as 0 | 1]++;
          this.notices.push({ kind: 'tag', confirmed, by: a.id });
        };
        this.announce('Collect the dog tags');
        break;
      case 'dom':
        this.setupFlags();
        this.announce('Capture the flags');
        break;
      case 'ctf':
        this.setupCtf();
        this.announce('Capture the enemy flag');
        break;
      case 'infected': {
        const bots = sim.agents.filter((a) => a !== this.player);
        this.infect(bots[sim.rng.int(bots.length)]);
        this.announce('Survive!');
        break;
      }
      case 'survival':
        this.startWave();
        break;
      case 'zombies':
        this.startZombieWave();
        break;
      case 'snd':
        this.setupSnd();
        break;
      case 'freeze':
        sim.onLethal = (v, k) => this.freezeAgent(v, k);
        sim.rallyFor = this.freezeRally;
        this.announce('Freeze the whole enemy team');
        break;
      case 'vip':
        this.announce('Kill the enemy VIP. Protect yours.');
        break;
      case 'hardcore':
        sim.damageMul *= 3;
        this.announce('Hardcore: no regen, no HUD help');
        break;
      case 'lms':
        this.announce('Three lives. Last one standing wins.');
        break;
      case 'cranked':
        this.announce('Get a kill to get cranked. Keep killing or explode!');
        break;
      case 'defender': {
        const c = sim.arena.randomFreePoint(() => 0.5, 0, 0, 4) ?? { x: 0, z: 0 };
        this.party.defender = { carrier: -1, x: c.x, z: c.z };
        sim.rallyFor = this.defenderRally;
        this.announce('Grab the flag and hold it');
        break;
      }
      case 'gunfight':
        this.announce('Round 1 · same loadout for everyone');
        break;
      case 'training': {
        sim.damageToPlayerScale = 0;
        // Still targets in the outer lanes, strafing ones in the middle lanes.
        for (const [x, dummy] of [[-18, 'still'], [-6, 'strafe'], [6, 'strafe'], [18, 'still']] as const) {
          for (const d of [10, 25, 45]) this.addDummy(x, RANGE_Z + d, dummy);
        }
        this.announce('Training range');
        break;
      }
      case 'aimtrainer':
        sim.damageToPlayerScale = 0;
        for (let i = 0; i < 3; i++) {
          const p = this.aimSpot();
          this.addDummy(p.x, p.z, 'still');
        }
        this.party.aimEnd = AIM_COUNTDOWN + AIM_TIME;
        this.announce('Get ready…', AIM_COUNTDOWN);
        break;
      case 'freeroam':
        sim.damageToPlayerScale = 0;
        this.announce('Free roam');
        break;
      case 'paintball':
        sim.damageRule = 'instagib';
        this.announce('Paintball! One hit and you are out');
        break;
      case 'boss':
        this.spawnBoss(humans);
        this.announce('Take down the boss!', 3);
        break;
      case 'roulette':
        this.announce('Every life, a new gun');
        break;
      case 'br':
      case 'br_duos':
      case 'br_trios': {
        const H = sim.arena.half;
        sim.zone = { x: 0, z: 0, r: H * 1.45, dps: 1 };
        this.zoneTo = { x: 0, z: 0, r: H * 1.45 };
        for (let i = 0; i < 36; i++) this.dropMedkit();
        this.nextMedkitT = 8;
        this.announce('Last one standing wins');
        break;
      }
      case 'gungame':
        this.announce('Climb the gun ladder');
        break;
      case 'jugg': {
        const others = sim.agents.filter((a) => a !== this.player);
        this.makeJugg(others.length ? others[sim.rng.int(others.length)] : this.player);
        this.announce('Kill the Juggernaut to become the Juggernaut');
        break;
      }
      case 'oitc':
        sim.noReload = true;
        this.announce('One bullet. Make it count.');
        break;
      case 'sharp':
        this.announce('Sharpshooter');
        break;
      case 'knife':
        this.announce('Knives out');
        break;
      case 'lowgrav':
        sim.gravity = 6.5;
        sim.jumpMul = 1.45;
        this.announce('Low gravity');
        break;
      case 'bighead':
        sim.headScale = 2.3;
        this.announce('Big heads!');
        break;
      case 'hideseek':
        this.announce(`Hide! Seekers are picked in a moment`);
        break;
      case 'course':
        this.announce('Go! Don’t touch the ground');
        break;
      case 'race':
        this.announce('Race to the finish!');
        break;
      case 'dodgeball':
        this.announce('Dodgeball! One hit and you’re out');
        break;
      case 'tag':
        sim.onMeleeHit = (a, b) => {
          // IT passes on with a hit; no tag-backs for 2 s.
          if (a.id === this.party.holder && sim.time > this.party.passCd && b.id !== this.party.lastIt) {
            this.party.lastIt = a.id;
            this.party.holder = b.id;
            this.party.passCd = sim.time + 2;
            this.notices.push({ kind: 'tagit', holder: b.id, from: a.id });
          }
          return true;
        };
        this.announce('Tag! Don’t be IT');
        break;
      case 'potato':
        sim.onMeleeHit = (a, b) => {
          if (a.id === this.party.holder && sim.time > this.party.passCd) {
            this.party.holder = b.id;
            this.party.passCd = sim.time + 1;
            this.notices.push({ kind: 'potato', holder: b.id, from: a.id });
          }
          // Knives never hurt in hot potato; they only pass the bomb.
          return true;
        };
        this.announce('Hot potato! Don\'t be holding the bomb');
        break;
      default:
        if (FFA_MODES.includes(mode)) this.announce(`First to ${this.goal(mode)} kills`);
        else this.announce('Round 1');
    }
  }

  private announce(text: string, seconds = 2.5): void {
    this.banner = text;
    this.bannerTeam = -1;
    this.bannerUntil = this.sim.time + seconds;
  }

  /** A banner worded for `team`, with different wording for everyone else. */
  private announceTeam(team: number, forTeam: string, forOthers: string, seconds = 2.5): void {
    this.announce(forTeam, seconds);
    this.bannerTeam = team;
    this.bannerOther = forOthers;
  }

  /** The banner as `team` should see it. */
  bannerFor(team: number): string {
    return this.bannerTeam >= 0 && this.bannerTeam !== team ? this.bannerOther : this.banner;
  }

  /** Advances the simulation by one tick and applies the mode's rules. */
  step(input: PlayerInput): void {
    if (this.phase === 'over') {
      // Keep the world animating (ragdolls, remaining players) but stop the rules.
      this.sim.step({ ...input, fire: false, forward: 0, right: 0, jump: false, grenade: false, melee: false });
      return;
    }
    this.sim.step(input);
    if (this.sim.tick % 6 !== 0) return;
    this.tickStreaks();
    if ((this.phase as MatchPhase) === 'over') return; // a nuke can end it
    switch (this.mode) {
      case '1v1':
      case '2v2':
      case '3v3':
        this.rulesRounds();
        break;
      case 'tdm':
        this.rulesTdm();
        break;
      case 'kc':
        this.rulesKc();
        break;
      case 'dom':
        this.rulesDom();
        break;
      case 'ctf':
        this.rulesCtf();
        break;
      case 'koth':
        this.rulesKoth();
        break;
      case 'infected':
        this.rulesInfected();
        break;
      case 'survival':
        this.rulesSurvival();
        break;
      case 'br':
      case 'br_duos':
      case 'br_trios':
        this.rulesBr();
        break;
      case 'jugg':
        this.rulesJugg();
        break;
      case 'oitc':
        this.rulesOitc();
        break;
      case 'sharp':
        this.rulesSharp();
        break;
      case 'friends_tdm':
      case 'hardcore':
        this.rulesTdm();
        break;
      case 'snd':
        this.rulesSnd();
        break;
      case 'freeze':
        this.rulesFreeze();
        break;
      case 'vip':
        this.rulesVip();
        break;
      case 'lms':
        this.rulesOitc();
        break;
      case 'cranked':
        this.rulesCranked();
        break;
      case 'defender':
        this.rulesDefender();
        break;
      case 'gunfight':
        this.rulesRounds();
        break;
      case 'course':
      case 'race':
        this.rulesCourse();
        break;
      case 'tag':
        this.rulesTag();
        break;
      case 'dodgeball':
        // Balls never run out.
        for (const a of this.sim.agents) if (a.alive) a.grenades = 99;
        this.rulesRounds();
        break;
      case 'training':
      case 'freeroam':
        this.rulesPractice();
        break;
      case 'aimtrainer':
        this.rulesAimTrainer();
        break;
      case 'paintball':
        this.rulesTdm();
        break;
      case 'boss':
        this.rulesBoss();
        break;
      case 'zombies':
        this.rulesZombies();
        break;
      case 'hideseek':
        this.rulesHideSeek();
        break;
      case 'potato':
        this.rulesPotato();
        break;
      default:
        this.rulesFfa();
    }
  }

  // ---------------------------------------------------------------- killstreaks, lobby rules

  /** A mode's score target, scaled by the lobby's rules. */
  goal(mode: ModeId): number | undefined {
    const t = TARGETS[mode];
    return t === undefined ? undefined : Math.max(1, Math.round(t * this.targetMul));
  }

  /** Modes where people drop out and others join mid-match (matchmade lobbies only). */
  get allowsChurn(): boolean {
    return CHURN_MODES.includes(this.mode) && this.phase === 'live';
  }

  /** A player left: their slot stays empty until someone new joins. */
  setAway(a: Agent): void {
    this.away.add(a.id);
    if (a.alive) {
      a.alive = false;
      a.deathT = this.sim.time;
    }
  }

  /** Someone new takes the empty slot: fresh stats, new personality, and they spawn in. */
  fillSlot(a: Agent): void {
    this.resetSlot(a);
    this.away.delete(a.id);
    this.respawnSafely(a);
  }

  /** A new occupant for `a`'s slot (a bot or a new player): fresh stats, personality and guns. */
  resetSlot(a: Agent): void {
    const sim = this.sim;
    if (this.def.teams) this.bankedKills[a.team as 0 | 1] += a.kills;
    a.kills = 0;
    a.deaths = 0;
    a.streak = 0;
    a.bestStreak = 0;
    a.damageDealt = 0;
    a.damageTaken = 0;
    a.shots = 0;
    a.hits = 0;
    a.headshots = 0;
    a.style = BOT_STYLES[sim.rng.int(BOT_STYLES.length)];
    const diff = this.opts.skill ?? DIFFICULTY[this.opts.difficulty];
    a.skill = diff.skill * STYLE_KIT[a.style].aim * (0.85 + sim.rng.next() * 0.3);
    if (this.mode === 'roulette') setLoadout(a, this.rouletteLoadout());
    else if (this.mode === 'marksman') setLoadout(a, ['dmr', 'revolver']);
    else if (this.mode === 'snipers') setLoadout(a, ['sniper', 'pistol']);
    else if (this.mode === 'sharp') setLoadout(a, [this.party.sharpWeapon]);
    else if (this.lobbyWeapon === 'any') {
      const kit = STYLE_KIT[a.style];
      setLoadout(a, [kit.guns[sim.rng.int(kit.guns.length)], sim.rng.next() < 0.25 ? 'revolver' : 'pistol']);
    }
  }

  /** The private lobby's forced weapon, if any. */
  get lobbyWeapon(): WeaponId | 'any' {
    return (this.opts.rules ?? DEFAULT_RULES).weapon;
  }

  /** The killstreaks `a` has picked. */
  streaksFor(a: Agent): StreakId[] {
    return this.streakChoices[a.id] ?? DEFAULT_STREAKS;
  }

  /** A random throwable pair and three perks for a computer player. */
  private randomGear(a: Agent): void {
    const rng = this.sim.rng;
    const r = rng.next();
    a.lethal = r < 0.6 ? 'frag' : r < 0.75 ? 'molotov' : r < 0.9 ? 'tknife' : 'spear';
    if (a.style === 'rusher' && rng.next() < 0.4) a.lethal = 'tknife';
    a.tactical = TACTICALS[rng.int(TACTICALS.length)];
    const pool = PERKS.map((p) => p.id).sort(() => rng.next() - 0.5);
    a.perks = pool.slice(0, 3);
    void LETHALS;
  }

  // ---------------------------------------------------------------- boss fight

  private spawnBoss(humans: number): void {
    const sim = this.sim;
    const p = sim.arena.teamSpawns[1][0];
    const boss = sim.spawn(1, this.opts.botControl, p.x, p.z, Math.PI);
    boss.scale = 2.3;
    boss.style = 'soldier';
    boss.skill = 1.15;
    // Tougher with more players: roughly 110 rifle body shots for two players.
    boss.armor = 0.06 / Math.max(1, humans);
    boss.speedMul = 0.75;
    boss.meleeDamage = 70;
    boss.perks = ['flakjacket', 'tacmask', 'coldblooded'];
    setLoadout(boss, ['lmg', 'pistol']);
    boss.grenades = 3;
    boss.tacticals = 0;
    this.party.bossId = boss.id;
    this.party.bossPhase = 0;
  }

  /** Boss health 0..1 (the HUD shows it as a bar). */
  bossHealth(): number {
    const b = this.sim.agents[this.party.bossId];
    return b ? Math.max(0, b.hp / 100) : 0;
  }

  private rulesBoss(): void {
    const sim = this.sim;
    const boss = sim.agents[this.party.bossId];
    if (!boss) return;
    if (!boss.alive) {
      this.notices.push({ kind: 'boss', event: 'down', phase: this.party.bossPhase });
      this.finish(true, 0, 0);
      return;
    }
    // Everyone (bots included) goes for the players.
    const heroes = sim.agents.filter((a) => a.team === 0);
    if (heroes.every((a) => !a.alive && a.deaths >= BOSS_LIVES)) {
      this.finish(false, 0, 1);
      return;
    }
    // Phases at two thirds and one third health: airstrikes, then minions.
    const hp = boss.hp / 100;
    const phase = hp < 0.34 ? 2 : hp < 0.67 ? 1 : 0;
    if (phase > this.party.bossPhase) {
      this.party.bossPhase = phase;
      this.notices.push({ kind: 'boss', event: 'phase', phase });
      if (phase === 1) {
        sim.callAirstrike(boss);
        boss.speedMul = 0.9;
      } else {
        const n = Math.min(6, 2 * heroes.length);
        for (let i = 0; i < n; i++) {
          const m = sim.spawn(1, this.opts.botControl, boss.x + sim.rng.range(-4, 4), boss.z + sim.rng.range(-4, 4), Math.PI);
          m.style = 'rusher';
          m.skill = 1.6;
          setLoadout(m, ['smg', 'pistol']);
          m.grenades = 0;
        }
        this.notices.push({ kind: 'boss', event: 'minions', phase });
      }
    }
    // Every 20 s in the last phase it calls another strike.
    if (phase >= 1 && sim.tick % (60 * 20) === 0) sim.callAirstrike(boss);
    // Players come back with lives left; minions don't.
    for (const a of heroes) {
      if (a.alive || a.deaths >= BOSS_LIVES) continue;
      const at = this.respawnAt.get(a.id);
      if (at === undefined) this.respawnAt.set(a.id, sim.time + 5);
      else if (sim.time >= at) {
        this.respawnAt.delete(a.id);
        this.respawnSafely(a);
      }
    }
  }

  /** Squad battle royale: seconds until `a` redeploys (null if not waiting). */
  redeployIn(a: Agent): number | null {
    if (!SQUAD_SIZE[this.mode] || a.alive) return null;
    if (!this.sim.agents.some((b) => b.alive && b.team === a.team)) return null;
    return Math.max(0, SQUAD_RESPAWN - (this.sim.time - a.deathT));
  }

  /** Whether a dead `a` will come back this match (respawn modes, lives left). */
  respawns(a: Agent): boolean {
    return RESPAWN_MODES.includes(this.mode) && !this.eliminated(a);
  }

  private callStreak(a: Agent, id: StreakId): void {
    const sim = this.sim;
    const s = streakDef(id);
    switch (id) {
      case 'adrenaline':
        a.hp = 100;
        a.speedMul = 1.25;
        this.adrenalineUntil.set(a.id, sim.time + 20);
        break;
      case 'uav':
        this.uavUntil[a.id] = sim.time + 30;
        break;
      case 'supply':
        a.hp = 100;
        a.grenades += 2;
        a.ammo = magOf(a, a.weapons[a.slot]);
        a.weapons.forEach((w, i) => (a.stash[i] = magOf(a, w)));
        a.reloadT = 0;
        break;
      case 'counter':
        // Jam every other team's minimap, and anyone hunting us loses the trail.
        for (const b of sim.agents) {
          if (b.team === a.team) continue;
          this.party.jamUntil[b.team] = sim.time + 25;
          this.uavUntil[b.id] = -1;
          if (b.targetId === a.id && !b.seesTarget) b.lastSeenT = -999;
        }
        break;
      case 'airstrike':
        sim.callAirstrike(a);
        break;
      case 'cluster':
        sim.callAirstrike(a);
        this.pendingStrikes.push({ at: sim.time + 2.5, agent: a.id }, { at: sim.time + 5, agent: a.id });
        break;
      case 'jugg':
        a.armor = 0.45;
        break;
      case 'nuke':
        this.notices.push({ kind: 'streak', id, name: s.name, kills: s.kills, agent: a.id });
        for (const b of sim.agents) if (b.alive && b.team !== a.team) sim.damage(b, a, 9999, 'torso', 0, -1, 0, 'airstrike');
        sim.explode(a.x, 30, a.z, a.id, 'airstrike');
        if (this.mode !== 'survival' && this.mode !== 'zombies') this.finish(a === this.player, 1, a.team);
        return;
    }
    this.notices.push({ kind: 'streak', id, name: s.name, kills: s.kills, agent: a.id });
  }

  /** Timed killstreak effects. Runs every rules tick. */
  private tickStreaks(): void {
    const sim = this.sim;
    for (const [id, until] of this.adrenalineUntil) {
      const a = sim.agents[id];
      if (sim.time < until && a?.alive) continue;
      this.adrenalineUntil.delete(id);
      if (a && this.mode !== 'cranked') a.speedMul = 1;
    }
    for (let i = this.pendingStrikes.length - 1; i >= 0; i--) {
      const s = this.pendingStrikes[i];
      if (sim.time < s.at) continue;
      this.pendingStrikes.splice(i, 1);
      const a = sim.agents[s.agent];
      if (a) sim.callAirstrike(a);
    }
  }

  // ---------------------------------------------------------------- new modes

  private rouletteLoadout(): WeaponId[] {
    const rng = this.sim.rng;
    const primaries = ROULETTE_POOL.filter((w) => WEAPONS[w].slot === 'primary');
    return [primaries[rng.int(primaries.length)], SECONDARIES[rng.int(SECONDARIES.length)]];
  }

  /** Gunfight: one random loadout for everyone this round. */
  private gunfightLoadout(): WeaponId[] {
    const kit = this.rouletteLoadout();
    for (const a of this.sim.agents) {
      setLoadout(a, kit);
      a.grenades = this.sim.rng.next() < 0.5 ? 1 : 2;
    }
    return kit;
  }

  private rulesCranked(): void {
    const sim = this.sim;
    for (const [key, until] of Object.entries(this.party.cranked)) {
      const a = sim.agents[+key];
      if (!a || !a.alive) {
        delete this.party.cranked[+key];
        continue;
      }
      if (sim.time < until) continue;
      delete this.party.cranked[a.id];
      this.notices.push({ kind: 'cranked', agent: a.id, event: 'exploded' });
      sim.explode(a.x, a.y + 0.6, a.z, a.id, 'grenade');
      if (a.alive) sim.damage(a, null, 9999, 'torso', 0, 1, 0, 'grenade');
      a.speedMul = 1;
    }
    this.rulesTdm();
  }

  private rulesDefender(): void {
    const sim = this.sim;
    const d = this.party.defender;
    const c = sim.agents[d.carrier];
    if (c && c.alive) {
      d.x = c.x;
      d.z = c.z;
      // Everyone on the other side hunts the carrier.
      for (const a of sim.agents) {
        if (!a.alive || a.team === c.team || isHuman(a) || a.seesTarget) continue;
        a.targetId = c.id;
        a.lastSeenX = c.x;
        a.lastSeenZ = c.z;
        a.lastSeenT = sim.time;
      }
    } else {
      d.carrier = -1;
      let best: Agent | null = null;
      let bestD = 1.6;
      for (const a of sim.agents) {
        if (!a.alive) continue;
        const dd = Math.hypot(a.x - d.x, a.z - d.z);
        if (dd < bestD) {
          bestD = dd;
          best = a;
        }
      }
      if (best) {
        d.carrier = best.id;
        this.notices.push({ kind: 'defender', event: 'taken', agent: best.id, team: best.team });
      }
    }
    this.party.holder = d.carrier;
    sim.objectives = [{ label: 'FLAG', x: d.x, z: d.z, r: 1.4, owner: d.carrier >= 0 ? sim.agents[d.carrier].team : -1, progress: 0, carried: d.carrier >= 0 }];
    const target = this.goal('defender')!;
    if (this.scores[0] >= target || this.scores[1] >= target) {
      const w = this.scores[0] >= target ? 0 : 1;
      this.finish(w === this.player.team, 0, w);
      return;
    }
    this.autoRespawn();
  }

  /** Team defender: a loose flag pulls everyone in; the holder's team escorts them. */
  private defenderRally = (a: Agent): Rally | null => {
    const d = this.party.defender;
    const c = this.sim.agents[d.carrier];
    if (!c || !c.alive) return { x: d.x, z: d.z, r: 2, urgent: false };
    if (c === a) return null;
    return c.team === a.team ? { x: c.x, z: c.z, r: 9, urgent: false } : null;
  };

  // ---------------------------------------------------------------- practice

  private addDummy(x: number, z: number, kind: 'still' | 'strafe'): Agent {
    const a = this.sim.spawn(1, 'heuristic', x, z, Math.PI);
    a.dummy = kind;
    a.postX = x;
    a.postZ = z;
    a.grenades = 0;
    setLoadout(a, ['rifle']);
    return a;
  }

  /** A random open spot downrange for an aim-trainer target. */
  private aimSpot(): Point {
    const sim = this.sim;
    for (let i = 0; i < 40; i++) {
      const x = sim.rng.range(-20, 20);
      const z = sim.rng.range(RANGE_Z + 7, RANGE_Z + 26);
      if (!sim.arena.boxAt(x, 0.5, z) && !sim.agents.some((a) => a.dummy && a.alive && Math.hypot(a.x - x, a.z - z) < 3)) return { x, z };
    }
    return { x: 0, z: RANGE_Z + 20 };
  }

  private rulesPractice(): void {
    // Grenades come back so they can be practised too.
    for (const a of this.sim.agents) if (!a.dummy && a.alive && a.grenades < 2 && this.sim.tick % 300 === 0) a.grenades++;
    this.autoRespawn();
  }

  private rulesAimTrainer(): void {
    const sim = this.sim;
    const left = this.party.aimEnd - sim.time;
    // The countdown: targets are up but don't count yet.
    if (left > AIM_TIME) {
      for (const a of sim.agents) if (!a.dummy) a.kills = a.shots = a.hits = a.headshots = 0;
    }
    if (left <= 0) {
      const score = this.player.kills;
      this.finish(true, 0, this.player.team);
      this.announce(`Score: ${score}${score > this.party.aimBest ? ' · new best!' : ''}`, 9999);
      return;
    }
    this.autoRespawn();
  }

  // ---------------------------------------------------------------- party modes

  private makeJugg(a: Agent): void {
    const prev = this.sim.agents[this.party.juggId];
    if (prev && prev !== a) prev.armor = 1;
    this.party.juggId = a.id;
    a.armor = 0.4;
    a.hp = 100;
    setLoadout(a, ['lmg', 'pistol']);
    this.notices.push({ kind: 'jugg', agent: a.id });
  }

  private rulesJugg(): void {
    const sim = this.sim;
    const j = sim.agents[this.party.juggId];
    if (j && j.alive) {
      // Everyone knows where the Juggernaut is and goes after it.
      for (const a of sim.agents) {
        if (a === j || !a.alive || isHuman(a) || a.seesTarget) continue;
        a.targetId = j.id;
        a.lastSeenX = j.x;
        a.lastSeenZ = j.z;
        a.lastSeenT = sim.time;
      }
      const pts = (this.party.points[j.id] = (this.party.points[j.id] ?? 0) + SIM.dt * 6);
      if (pts >= this.goal('jugg')!) {
        this.finish(j === this.player, 0, j.team);
        return;
      }
    } else if (!j || (!j.alive && sim.time - j.deathT > 0.5)) {
      // The Juggernaut died to something other than a player: hand the armour to someone at random.
      const alive = sim.agents.filter((a) => a.alive);
      if (alive.length) this.makeJugg(alive[sim.rng.int(alive.length)]);
    }
    this.autoRespawn();
  }

  /** One in the Chamber: out of lives = out of the match. */
  private eliminated(a: Agent): boolean {
    return ((this.mode === 'oitc' || this.mode === 'lms') && a.deaths >= OITC_LIVES) || this.mode === 'potato';
  }

  private rulesOitc(): void {
    const sim = this.sim;
    const left = sim.agents.filter((a) => a.deaths < OITC_LIVES);
    if (left.length <= 1) {
      const w = left[0];
      this.finish(w === this.player, 0, w ? w.team : -1);
      return;
    }
    this.autoRespawn();
  }

  private rulesSharp(): void {
    const sim = this.sim;
    if (sim.time >= this.party.sharpNext) {
      this.party.sharpNext = sim.time + 30;
      const choices = SHARP_POOL.filter((w) => w !== this.party.sharpWeapon);
      const w = choices[sim.rng.int(choices.length)];
      this.party.sharpWeapon = w;
      for (const a of sim.agents) setLoadout(a, [w]);
      this.notices.push({ kind: 'sharp', weapon: w });
    }
    this.rulesFfa();
  }

  private rulesHideSeek(): void {
    const sim = this.sim;
    const p = this.party;
    if (p.hideRelease < 0) {
      if (sim.time < 1) return;
      // Pick the seekers: about one in four players.
      const pool = shuffle(sim.agents.slice(), () => sim.rng.next());
      const n = Math.max(1, Math.round(pool.length / 4));
      p.hideRelease = sim.time + HIDE_TIME;
      for (const a of pool.slice(0, n)) {
        this.makeSeeker(a);
        a.frozenUntil = p.hideRelease;
      }
      this.announce(`Seekers are blindfolded for ${HIDE_TIME} s. Hide!`, 3);
      return;
    }
    const hiders = sim.agents.filter((a) => a.team === 0);
    this.scores = [hiders.length, sim.agents.length - hiders.length];
    if (hiders.length === 0) {
      this.finish(this.player.team === 1, 0, 1);
      return;
    }
    if (sim.time >= p.hideRelease + SEEK_TIME) {
      this.finish(this.player.team === 0, 0, 0);
      return;
    }
    this.autoRespawn();
  }

  private makeSeeker(a: Agent): void {
    a.team = 1;
    setLoadout(a, ['smg', 'pistol']);
    a.grenades = 0;
  }

  /** Movement course and Race: checkpoints, falls back to the last one, and the finish. */
  private rulesCourse(): void {
    const sim = this.sim;
    const c = this.party.course;
    const inBox = (a: Agent, b: { minX: number; maxX: number; minZ: number; maxZ: number }) => a.x >= b.minX && a.x <= b.maxX && a.z >= b.minZ && a.z <= b.maxZ;
    for (const a of sim.agents) {
      if (!a.alive || c.finished[a.id] !== undefined) continue;
      const cp = c.cp[a.id] ?? 0;
      // The clock starts when you leave the start pad.
      if (c.started[a.id] === undefined && !inBox(a, COURSE.start)) c.started[a.id] = sim.time;
      for (let i = cp + 1; i < COURSE.checkpoints.length; i++) {
        const k = COURSE.checkpoints[i];
        if (Math.hypot(a.x - k.x, a.z - k.z) < 3.2 && a.y >= k.h - 0.4) {
          c.cp[a.id] = i;
          this.notices.push({ kind: 'course', agent: a.id, checkpoint: i, name: k.name, finished: false, time: sim.time - (c.started[a.id] ?? sim.time) });
        }
      }
      if (inBox(a, COURSE.finish) && a.onGround) {
        const time = sim.time - (c.started[a.id] ?? sim.time);
        c.finished[a.id] = time;
        this.notices.push({ kind: 'course', agent: a.id, checkpoint: COURSE.checkpoints.length, name: 'Finish', finished: true, time });
        if (this.mode === 'race' || a === this.player) {
          this.finish(a === this.player, 0, a.team);
          return;
        }
        continue;
      }
      // Touching the ground anywhere but the start: back to the last checkpoint.
      if (a.onGround && a.y < 0.2 && !inBox(a, COURSE.start)) {
        const k = COURSE.checkpoints[c.cp[a.id] ?? 0];
        a.x = k.x;
        a.z = k.z;
        a.y = k.h + 0.05;
        a.vx = a.vz = a.vy = 0;
        c.falls[a.id] = (c.falls[a.id] ?? 0) + 1;
      }
    }
  }

  /** Tag: someone is always IT; time as IT counts against you. */
  private rulesTag(): void {
    const sim = this.sim;
    const p = this.party;
    const alive = sim.agents.filter((a) => a.alive);
    if (alive.length < 2) return;
    if (p.holder < 0 || !sim.agents[p.holder]?.alive) {
      const h = alive[sim.rng.int(alive.length)];
      p.holder = h.id;
      p.passCd = sim.time + 2;
      this.notices.push({ kind: 'tagit', holder: h.id, from: -1 });
    }
    p.itTime[p.holder] = (p.itTime[p.holder] ?? 0) + RULE_DT;
    // IT runs a little faster, so it can always catch up.
    for (const a of alive) a.speedMul = a.id === p.holder ? 1.12 : 1;
    if (sim.time - this.startTime >= TAG_TIME) {
      const best = alive.slice().sort((a, b) => (p.itTime[a.id] ?? 0) - (p.itTime[b.id] ?? 0))[0];
      this.finish(best === this.player, 0, best.team);
    }
  }

  private rulesPotato(): void {
    const sim = this.sim;
    const p = this.party;
    const alive = sim.agents.filter((a) => a.alive);
    if (alive.length <= 1) {
      const w = alive[0];
      this.finish(w === this.player, 0, w ? w.team : -1);
      return;
    }
    const holder = sim.agents[p.holder];
    if (p.holder < 0 || !holder || !holder.alive) {
      p.holder = -1;
      if (sim.time >= p.nextBomb) {
        const h = alive[sim.rng.int(alive.length)];
        p.holder = h.id;
        p.explodeAt = sim.time + 15 + sim.rng.next() * 10;
        p.passCd = sim.time + 1;
        this.notices.push({ kind: 'potato', holder: h.id, from: -1 });
      }
      return;
    }
    if (sim.time >= p.explodeAt) {
      sim.damage(holder, null, 999, 'torso', 0, 1, 0, 'grenade');
      sim.explode(holder.x, holder.y + 0.5, holder.z, holder.id, 'grenade');
      p.holder = -1;
      p.nextBomb = sim.time + 2.5;
    }
  }

  /** One line describing the mode's state for `me` (the HUD shows it under the score). */
  statusFor(me: Agent, nameOf: (id: number) => string): string | null {
    const sim = this.sim;
    const p = this.party;
    const sec = (t: number) => `${Math.max(0, Math.ceil(t))}s`;
    switch (this.mode) {
      case 'jugg': {
        const j = sim.agents[p.juggId];
        const mine = Math.floor(p.points[me.id] ?? 0);
        const leader = Object.entries(p.points).sort((a, b) => b[1] - a[1])[0];
        const lead = leader ? `${nameOf(+leader[0])} ${Math.floor(leader[1])}` : '-';
        return `${j && j.id === me.id ? 'YOU ARE THE JUGGERNAUT' : `Juggernaut: ${j ? nameOf(j.id) : '-'}`} · you ${mine} · leader ${lead} · first to ${this.goal('jugg')}`;
      }
      case 'snd': {
        const d = p.snd;
        const site = d.sites[d.site]?.label ?? 'A';
        const attacking = me.team === d.attackers;
        if (d.state === 'planted') {
          const left = sec(SND_FUSE - (sim.time - d.plantedAt));
          if (d.defuse > 0) return `Defusing ${Math.round(d.defuse * 100)}% · ${left}`;
          return `Bomb planted at ${site} · ${left}${attacking ? ' · defend it' : ' · defuse it!'}`;
        }
        const clock = sec(SND_ROUND - (sim.time - d.roundStart));
        if (d.carrier === me.id) return d.plant > 0 ? `Planting ${Math.round(d.plant * 100)}%` : `You have the bomb · plant at ${site} · ${clock}`;
        if (attacking) return d.state === 'dropped' ? `The bomb was dropped · pick it up · ${clock}` : `Attack ${site} · ${clock}`;
        return `Defend A and B · ${clock}`;
      }
      case 'freeze':
        if (sim.time < me.frozenUntil) {
          const t = p.thaw[me.id] ?? 0;
          return t > 0 ? `Thawing ${Math.round(t * 100)}%` : 'You are frozen · wait for a teammate';
        }
        {
          const active = [0, 0];
          for (const b of sim.agents) if (b.alive && !sim.isFrozen(b)) active[b.team === me.team ? 0 : 1]++;
          return `${active[0]} v ${active[1]} unfrozen · stand next to frozen teammates to thaw them`;
        }
      case 'boss': {
        const lives = Math.max(0, BOSS_LIVES - me.deaths);
        return `Boss ${Math.ceil(this.bossHealth() * 100)}% · phase ${p.bossPhase + 1} of 3 · your lives: ${lives}`;
      }
      case 'br_duos':
      case 'br_trios': {
        const squads = new Set(sim.agents.filter((a) => a.alive).map((a) => a.team)).size;
        const mates = sim.agents.filter((a) => a.team === me.team && a !== me && a.alive).length;
        return `${squads} squads left · ${mates} squadmate${mates === 1 ? '' : 's'} alive`;
      }
      case 'training': {
        const acc = me.shots ? Math.round((me.hits / me.shots) * 100) : 0;
        return `${me.kills} targets down · ${me.headshots} headshots · ${acc}% accuracy · B: next gun`;
      }
      case 'freeroam':
        return 'Free roam · nobody is hunting you · B: next gun';
      case 'aimtrainer': {
        const left = p.aimEnd - sim.time;
        if (left > AIM_TIME) return `Starting in ${sec(left - AIM_TIME)}`;
        const acc = me.shots ? Math.round((me.hits / me.shots) * 100) : 0;
        return `Score ${me.kills} · ${sec(left)} left · ${acc}% accuracy · best ${p.aimBest}`;
      }
      case 'cranked': {
        const until = p.cranked[me.id];
        return until !== undefined ? `CRANKED · ${sec(until - sim.time)} to get a kill!` : 'Get a kill to get cranked';
      }
      case 'defender': {
        const c = sim.agents[p.defender.carrier];
        if (!c) return 'The flag is loose · grab it';
        if (c === me) return 'YOU HAVE THE FLAG · your kills count double';
        return c.team === me.team ? `${nameOf(c.id)} has the flag · protect them` : `${nameOf(c.id)} has the flag · take it from them`;
      }
      case 'vip': {
        const mine = sim.agents[p.vipIds[me.team]];
        const theirs = sim.agents[p.vipIds[1 - me.team]];
        if (mine === me) return 'YOU ARE THE VIP · stay alive';
        return `Your VIP: ${mine ? nameOf(mine.id) : '…'} · enemy VIP: ${theirs ? nameOf(theirs.id) : '…'}`;
      }
      case 'lms':
      case 'oitc': {
        const lives = Math.max(0, OITC_LIVES - me.deaths);
        const left = sim.agents.filter((a) => a.deaths < OITC_LIVES).length;
        return lives > 0 ? `Lives ${lives} · ${left} players left` : `Out of lives · ${left} players left`;
      }
      case 'sharp':
        return `${WEAPONS_NAME(p.sharpWeapon)} · next gun in ${sec(p.sharpNext - sim.time)}`;
      case 'hideseek':
        if (p.hideRelease < 0) return 'Picking seekers…';
        if (sim.time < p.hideRelease) return `${me.team === 1 ? 'You are seeking' : 'Hide!'} · seekers released in ${sec(p.hideRelease - sim.time)}`;
        return `${me.team === 1 ? 'Find the hiders' : 'Stay hidden'} · ${this.scores[0]} hiders left · ${sec(p.hideRelease + SEEK_TIME - sim.time)}`;
      case 'course':
      case 'race': {
        const c = p.course;
        const cp = c.cp[me.id] ?? 0;
        const t = c.finished[me.id] ?? (c.started[me.id] !== undefined ? sim.time - c.started[me.id] : 0);
        const run = `${t.toFixed(1)} s · checkpoint ${cp}/${COURSE.checkpoints.length - 1} · falls ${c.falls[me.id] ?? 0}`;
        if (this.mode === 'course') return `${run} · don’t touch the ground`;
        // Race: places by finish, then checkpoint.
        const order = sim.agents
          .filter((a) => !a.dummy)
          .sort((a, b) => (c.finished[a.id] ?? 1e9) - (c.finished[b.id] ?? 1e9) || (c.cp[b.id] ?? 0) - (c.cp[a.id] ?? 0));
        return `Place ${order.findIndex((a) => a.id === me.id) + 1} of ${order.length} · ${run}`;
      }
      case 'tag': {
        const h = sim.agents[p.holder];
        const mine = Math.round(p.itTime[me.id] ?? 0);
        const left = sec(TAG_TIME - (sim.time - this.startTime));
        if (!h) return `Picking who's IT… · ${left}`;
        return `${h.id === me.id ? "YOU'RE IT · hit someone!" : `${nameOf(h.id)} is IT`} · your IT time ${mine}s · ${left} left`;
      }
      case 'potato': {
        const h = sim.agents[p.holder];
        if (!h || p.holder < 0) return 'Next bomb incoming…';
        if (h.id === me.id) return `YOU HAVE THE BOMB · knife someone! ${sec(p.explodeAt - sim.time)}`;
        return `${nameOf(h.id)} has the bomb · ${sec(p.explodeAt - sim.time)}`;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- kills, streaks, gun game

  private onKill(victim: Agent, killer: Agent | null, cause: DeathCause): void {
    const sim = this.sim;
    // Kill order: the enemy VIP down is a point.
    if (this.mode === 'vip' && victim.id === this.party.vipIds[victim.team]) {
      this.party.vipIds[victim.team] = -1;
      if (killer && killer.team !== victim.team) {
        this.scores[killer.team as 0 | 1]++;
        this.notices.push({ kind: 'vipkill', by: killer.id, team: killer.team });
      }
    }
    // Search & destroy: the carrier drops the bomb where they fell.
    if (this.mode === 'snd' && this.party.snd.carrier === victim.id) {
      const d = this.party.snd;
      d.carrier = -1;
      d.state = 'dropped';
      d.bx = victim.x;
      d.bz = victim.z;
      d.plant = 0;
      this.notices.push({ kind: 'snd', event: 'dropped', by: victim.id, site: '' });
    }
    if (this.mode === 'kc') sim.spawnPickup('tag', victim.x, victim.z, victim.team, 30);
    // A carrier who dies drops the flag where they fell.
    for (const f of this.ctf) {
      if (f.carrier !== victim.id) continue;
      f.carrier = -1;
      f.x = victim.x;
      f.z = victim.z;
      f.droppedAt = sim.time;
      this.notices.push({ kind: 'ctf', event: 'dropped', team: f.team, by: killer ? killer.id : -1 });
    }
    if (this.mode === 'jugg' && victim.id === this.party.juggId && killer && killer.alive) this.makeJugg(killer);
    if (this.mode === 'oitc' && killer && killer.alive) {
      // Every kill earns a bullet (no reloading in this mode).
      killer.ammo++;
      if (killer.weapons[killer.slot] !== 'pistol') killer.stash[0]++;
    }
    if (this.mode === 'hideseek' && victim.team === 0) {
      this.notices.push({ kind: 'infected', by: killer ? killer.id : -1, victim: victim.id });
      this.makeSeeker(victim);
    }
    if (this.mode === 'infected' && victim.team === 0) {
      this.notices.push({ kind: 'infected', by: killer ? killer.id : -1, victim: victim.id });
      this.infect(victim);
    }
    if (this.mode === 'gungame') {
      if (cause === 'knife' && victim.tier > 0) {
        victim.tier--;
        victim.tierKills = 0;
        setLoadout(victim, [GUN_GAME_LADDER[victim.tier]]);
        if (isHuman(victim)) this.notices.push({ kind: 'demote', weapon: GUN_GAME_LADDER[victim.tier], agent: victim.id });
      }
      if (killer) {
        const last = GUN_GAME_LADDER.length - 1;
        if (killer.tier === last) {
          this.finish(killer === this.player, 0, killer.team);
          return;
        }
        killer.tierKills++;
        if (killer.tierKills >= GUN_GAME_KILLS_PER_TIER) {
          killer.tier++;
          killer.tierKills = 0;
          const keep = killer.ammo;
          setLoadout(killer, [GUN_GAME_LADDER[killer.tier]]);
          killer.switchT = keep >= 0 ? 0.45 : 0;
          if (isHuman(killer)) this.notices.push({ kind: 'promote', weapon: GUN_GAME_LADDER[killer.tier], agent: killer.id });
        }
      }
    }
    if (this.mode === 'cranked') {
      delete this.party.cranked[victim.id];
      victim.speedMul = 1;
      if (killer && killer.alive && killer.team !== victim.team) {
        if (this.party.cranked[killer.id] === undefined) this.notices.push({ kind: 'cranked', agent: killer.id, event: 'cranked' });
        this.party.cranked[killer.id] = sim.time + CRANK_TIME;
        killer.speedMul = 1.22;
      }
    }
    if (this.mode === 'defender') {
      const d = this.party.defender;
      const carrierTeam = d.carrier >= 0 ? sim.agents[d.carrier]?.team : -1;
      if (killer && killer.team !== victim.team) this.scores[killer.team as 0 | 1] += killer.team === carrierTeam ? 2 : 1;
      if (d.carrier === victim.id) {
        d.carrier = -1;
        d.x = victim.x;
        d.z = victim.z;
        this.notices.push({ kind: 'defender', event: 'dropped', agent: victim.id, team: victim.team });
      }
    }
    // Killstreaks for humans.
    if (killer && isHuman(killer) && this.phase === 'live' && !PRACTICE_MODES.includes(this.mode)) {
      for (const id of this.streaksFor(killer)) {
        const s = streakDef(id);
        if (killer.streak === s.kills - (hasPerk(killer, 'hardline') ? 1 : 0)) this.callStreak(killer, id);
      }
    }
  }

  // ---------------------------------------------------------------- team rounds

  private rulesRounds(): void {
    const sim = this.sim;
    if (this.phase === 'roundOver') {
      if (sim.time >= this.breakUntil) this.resetRound();
      return;
    }
    const alive = [0, 0];
    for (const a of sim.agents) if (a.alive) alive[a.team]++;
    if (alive[0] > 0 && alive[1] > 0) return;
    if (alive[0] === 0 && alive[1] === 0) {
      this.phase = 'roundOver';
      this.breakUntil = sim.time + ROUND_BREAK;
      this.announce('Draw', ROUND_BREAK);
      return;
    }
    const winner = alive[0] > 0 ? 0 : 1;
    this.scores[winner]++;
    if (this.scores[winner] >= (this.goal(this.mode) ?? ROUND_TARGET)) {
      this.finish(winner === 0, 0, winner);
      return;
    }
    this.phase = 'roundOver';
    // A lost 1v1 round gets a longer break so the killcam can play.
    const pause = !this.player.alive ? KILLCAM_BREAK : ROUND_BREAK;
    this.breakUntil = sim.time + pause;
    this.announceTeam(winner, 'Round won', 'Round lost', Math.min(pause, 2.5));
  }

  /** Round modes (search & destroy, freeze tag): score a round and maybe the match. */
  private endRound(winner: number, wonText = 'Round won', lostText = 'Round lost'): void {
    const sim = this.sim;
    this.scores[winner as 0 | 1]++;
    if (this.scores[winner] >= (this.goal(this.mode) ?? ROUND_TARGET)) {
      this.finish(winner === this.player.team, 0, winner);
      return;
    }
    this.phase = 'roundOver';
    const pause = !this.player.alive ? KILLCAM_BREAK : ROUND_BREAK + 0.5;
    this.breakUntil = sim.time + pause;
    this.announceTeam(winner, wonText, lostText, Math.min(pause, 2.5));
  }

  // ---------------------------------------------------------------- search & destroy

  private setupSnd(): void {
    const sim = this.sim;
    const H = sim.arena.half;
    // Bomb sites on the defenders' (east) side.
    for (const [label, z] of [
      ['A', -H * 0.45],
      ['B', H * 0.45]
    ] as [string, number][]) {
      const p = sim.arena.randomFreePoint(() => sim.rng.next(), H * 0.45, z, 6) ?? { x: H * 0.45, z };
      this.party.snd.sites.push({ label, x: p.x, z: p.z });
    }
    this.sndRoundStart();
    sim.rallyFor = (a) => {
      const d = this.party.snd;
      const site = d.sites[d.site];
      if (a.team === d.attackers) {
        if (d.carrier === a.id && d.state === 'carried') return { x: site.x, z: site.z, r: 2.5, urgent: true, hold: true };
        if (d.state === 'dropped') return { x: d.bx, z: d.bz, r: 1 };
        if (d.state === 'planted') return { x: d.bx, z: d.bz, r: 9 };
        return { x: site.x, z: site.z, r: 7 };
      }
      if (d.state === 'planted') return { x: d.bx, z: d.bz, r: 1.6, hold: true };
      const guard = d.sites[a.id % 2];
      return { x: guard.x, z: guard.z, r: 8 };
    };
  }

  /** New round: the side on the west attacks; a random attacker carries the bomb. */
  private sndRoundStart(): void {
    const sim = this.sim;
    const d = this.party.snd;
    d.attackers = (this.round + 1) % 2;
    d.site = sim.rng.int(2);
    d.state = 'carried';
    d.plant = 0;
    d.defuse = 0;
    d.roundStart = sim.time;
    const attackers = sim.agents.filter((a) => a.team === d.attackers && a.alive);
    d.carrier = attackers.length ? attackers[sim.rng.int(attackers.length)].id : -1;
    this.syncSndObjectives();
    this.announceTeam(d.attackers, `Round ${this.round}: plant the bomb`, `Round ${this.round}: defend the sites`, 2.5);
  }

  private syncSndObjectives(): void {
    const d = this.party.snd;
    const obj: FpsSim['objectives'] = d.sites.map((p) => ({ label: p.label, x: p.x, z: p.z, r: 3.5, owner: -1, progress: 0 }));
    if (d.state === 'dropped' || d.state === 'planted') obj.push({ label: 'BOMB', x: d.bx, z: d.bz, r: 1, owner: d.attackers, progress: 0, carried: true });
    this.sim.objectives = obj;
  }

  private rulesSnd(): void {
    const sim = this.sim;
    const d = this.party.snd;
    if (this.phase === 'roundOver') {
      if (sim.time >= this.breakUntil) {
        this.resetRound();
        this.sndRoundStart();
      }
      return;
    }
    const attackers = sim.agents.filter((a) => a.team === d.attackers && a.alive);
    const defenders = sim.agents.filter((a) => a.team !== d.attackers && a.alive);
    const step = SIM.dt * 6;
    if (d.state === 'dropped') {
      const picker = attackers.find((a) => Math.hypot(a.x - d.bx, a.z - d.bz) < 1.5);
      if (picker) {
        d.carrier = picker.id;
        d.state = 'carried';
        this.notices.push({ kind: 'snd', event: 'pickup', by: picker.id, site: '' });
      }
    } else if (d.state === 'carried') {
      const c = sim.agents[d.carrier];
      const site = d.sites.find((p) => c && Math.hypot(c.x - p.x, c.z - p.z) < 3.5);
      if (c && c.alive && site) {
        d.plant += step / SND_PLANT;
        if (d.plant >= 1) {
          d.state = 'planted';
          d.bx = c.x;
          d.bz = c.z;
          d.site = d.sites.indexOf(site);
          d.plantedAt = sim.time;
          d.carrier = -1;
          this.notices.push({ kind: 'snd', event: 'planted', by: c.id, site: site.label });
          this.announceTeam(d.attackers, `Bomb planted at ${site.label}`, `Bomb planted at ${site.label}: defuse it!`, 2.5);
        }
      } else d.plant = 0;
    } else if (d.state === 'planted') {
      const defuser = defenders.find((a) => Math.hypot(a.x - d.bx, a.z - d.bz) < 2);
      if (defuser) d.defuse += step / SND_DEFUSE;
      else d.defuse = 0;
      if (d.defuse >= 1) {
        d.state = 'done';
        this.notices.push({ kind: 'snd', event: 'defused', by: defuser!.id, site: d.sites[d.site].label });
        this.syncSndObjectives();
        this.endRound(1 - d.attackers, 'Bomb defused!', 'Bomb defused');
        return;
      }
      if (sim.time - d.plantedAt >= SND_FUSE) {
        d.state = 'done';
        sim.explode(d.bx, 0.3, d.bz, -1, 'airstrike');
        this.notices.push({ kind: 'snd', event: 'exploded', by: -1, site: d.sites[d.site].label });
        this.syncSndObjectives();
        this.endRound(d.attackers, 'Target destroyed', 'Target destroyed');
        return;
      }
    }
    this.syncSndObjectives();
    // Eliminations and the clock.
    if (defenders.length === 0) this.endRound(d.attackers);
    else if (attackers.length === 0 && d.state !== 'planted') this.endRound(1 - d.attackers);
    else if (d.state !== 'planted' && sim.time - d.roundStart > SND_ROUND) this.endRound(1 - d.attackers, 'Time up: sites held', 'Time up');
  }

  // ---------------------------------------------------------------- freeze tag

  /** A lethal hit freezes instead (counts as a kill for the stats). */
  private freezeAgent(v: Agent, killer: Agent | null): boolean {
    if (this.phase !== 'live') return false;
    v.hp = 100;
    v.frozenUntil = 1e9;
    v.vx = v.vz = 0;
    v.deaths++;
    v.streak = 0;
    this.party.thaw[v.id] = 0;
    if (killer && killer !== v) {
      killer.kills++;
      killer.streak++;
    }
    this.notices.push({ kind: 'frozen', agent: v.id, by: killer ? killer.id : -1 });
    return true;
  }

  private rulesFreeze(): void {
    const sim = this.sim;
    if (this.phase === 'roundOver') {
      if (sim.time >= this.breakUntil) {
        this.resetRound();
        this.party.thaw = {};
        this.announce(`Round ${this.round}`);
      }
      return;
    }
    // Teammates standing next to a frozen soldier thaw them.
    for (const a of sim.agents) {
      if (!sim.isFrozen(a)) continue;
      const helpers = sim.agents.filter((b) => b !== a && b.alive && b.team === a.team && !sim.isFrozen(b) && Math.hypot(b.x - a.x, b.z - a.z) < 2.2);
      const t = (this.party.thaw[a.id] ?? 0) + (helpers.length ? (SIM.dt * 6 * Math.min(2, helpers.length)) / THAW_TIME : -SIM.dt * 3);
      this.party.thaw[a.id] = Math.max(0, t);
      if (t >= 1) {
        a.frozenUntil = 0;
        a.protectedUntil = sim.time + 1;
        this.party.thaw[a.id] = 0;
        this.notices.push({ kind: 'thawed', agent: a.id, by: helpers.map((h) => h.id) });
      }
    }
    const active = [0, 0];
    for (const a of sim.agents) if (a.alive && !sim.isFrozen(a)) active[a.team]++;
    if (active[0] === 0) this.endRound(1, 'Enemy team frozen!', 'Your team was frozen');
    else if (active[1] === 0) this.endRound(0, 'Enemy team frozen!', 'Your team was frozen');
  }

  /** Freeze tag bots go thaw a nearby frozen teammate when not fighting. */
  private freezeRally = (a: Agent): Rally | null => {
    const sim = this.sim;
    let best: Agent | null = null;
    let bestD = 30;
    for (const b of sim.agents) {
      if (b === a || b.team !== a.team || !sim.isFrozen(b)) continue;
      const d = Math.hypot(b.x - a.x, b.z - a.z);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best ? { x: best.x, z: best.z, r: 1.6, hold: true } : null;
  };

  // ---------------------------------------------------------------- kill order

  private rulesVip(): void {
    const sim = this.sim;
    const p = this.party;
    for (const team of [0, 1]) {
      const v = sim.agents[p.vipIds[team]];
      if (v && v.alive) {
        // Everyone on the other side always knows where the enemy VIP is.
        for (const a of sim.agents) {
          if (a.team === team || !a.alive || isHuman(a) || a.seesTarget) continue;
          a.targetId = v.id;
          a.lastSeenX = v.x;
          a.lastSeenZ = v.z;
          a.lastSeenT = sim.time;
        }
        continue;
      }
      const pool = sim.agents.filter((a) => a.team === team && a.alive);
      if (!pool.length) continue;
      const pick = pool[sim.rng.int(pool.length)];
      p.vipIds[team] = pick.id;
      pick.armor = 0.75;
      this.notices.push({ kind: 'vip', agent: pick.id, team });
    }
    const target = this.goal('vip')!;
    if (this.scores[0] >= target || this.scores[1] >= target) {
      this.finish(this.scores[0] >= target, 0, this.scores[0] >= target ? 0 : 1);
      return;
    }
    this.autoRespawn();
  }

  // ---------------------------------------------------------------- zombies

  private startZombieWave(): void {
    const sim = this.sim;
    this.wave++;
    this.waveQueue = 5 + this.wave * 3;
    this.phase = 'live';
    // Fallen players come back for the new wave.
    for (const a of sim.agents) {
      if (a.team !== 0) continue;
      if (!a.alive) sim.respawn(a, sim.rng.range(-4, 4), sim.rng.range(-10, -4), 0);
      a.hp = 100;
      a.grenades = Math.max(a.grenades, 2);
    }
    this.announce(this.wave === 1 ? 'Here they come…' : `Wave ${this.wave}`);
  }

  private rulesZombies(): void {
    const sim = this.sim;
    const humans = sim.agents.filter((a) => a.team === 0);
    if (humans.every((a) => !a.alive)) {
      this.finish(false, 0, 1);
      return;
    }
    if (this.phase === 'roundOver') {
      if (sim.time >= this.breakUntil) this.startZombieWave();
      return;
    }
    // Only bots are zombies: a human must never hold up a wave or be respawned as one.
    const zombies = sim.agents.filter((a) => a.team === 1 && !isHuman(a));
    const alive = zombies.filter((a) => a.alive);
    // Zombies always know where the nearest survivor is.
    for (const z of alive) {
      let best: Agent | null = null;
      let bestD = Infinity;
      for (const h of humans) {
        if (!h.alive) continue;
        const d = Math.hypot(h.x - z.x, h.z - z.z);
        if (d < bestD) {
          bestD = d;
          best = h;
        }
      }
      if (best) {
        z.targetId = best.id;
        z.lastSeenX = best.x;
        z.lastSeenZ = best.z;
        z.lastSeenT = sim.time;
      }
    }
    const maxAlive = Math.min(14, 4 + this.wave);
    if (this.waveQueue > 0 && alive.length < maxAlive) {
      const living = humans.filter((h) => h.alive);
      const far = (p: Point) => Math.min(...living.map((h) => Math.hypot(h.x - p.x, h.z - p.z)));
      const spots = sim.arena.spawns.slice().sort((a, b) => far(b) - far(a));
      const p = spots[sim.rng.int(Math.min(4, spots.length))];
      const reuse = zombies.find((a) => !a.alive && sim.time - a.deathT > 4);
      let z: Agent;
      if (reuse) {
        sim.respawn(reuse, p.x, p.z, 0);
        z = reuse;
      } else z = sim.spawn(1, this.opts.botControl, p.x, p.z, 0);
      setLoadout(z, ['knife']);
      z.grenades = 0;
      z.style = 'rusher';
      z.meleeDamage = 30 + this.wave * 2;
      z.armor = Math.max(0.35, 1 - 0.05 * (this.wave - 1));
      // Early waves shamble (slower than you walk); later ones run you down.
      z.speedMul = Math.min(1.2, 0.55 + 0.06 * this.wave);
      this.waveQueue--;
      return;
    }
    if (this.waveQueue === 0 && alive.length === 0) {
      this.phase = 'roundOver';
      this.breakUntil = sim.time + 6;
      this.announce(`Wave ${this.wave} survived`, 4);
    }
  }

  private resetRound(): void {
    const sim = this.sim;
    this.round++;
    const used = [0, 0];
    for (const a of sim.agents) {
      // Alternate sides every round so neither team keeps the same spawn.
      const side = (a.team + this.round + 1) % 2;
      const p = sim.arena.teamSpawns[side][used[a.team]++];
      sim.respawn(a, p.x, p.z, yawTo(p.x, p.z, 0, 0));
      a.protectedUntil = 0;
      a.grenades = 2;
    }
    this.phase = 'live';
    if (this.mode === 'gunfight') {
      const [w] = this.gunfightLoadout();
      this.announce(`Round ${this.round} · ${WEAPONS[w].name}`);
    } else this.announce(`Round ${this.round}`);
  }

  // ---------------------------------------------------------------- respawning modes

  /** Respawns everyone except the player after a short delay. */
  private autoRespawn(): void {
    const sim = this.sim;
    for (const a of sim.agents) {
      if (a.alive || (a === this.player && a.control === 'player') || this.eliminated(a) || this.away.has(a.id)) continue;
      const at = this.respawnAt.get(a.id);
      if (at === undefined) this.respawnAt.set(a.id, sim.time + (isHuman(a) ? (PRACTICE_MODES.includes(this.mode) ? 1.5 : 6) : a.dummy ? (this.mode === 'aimtrainer' ? 0.05 : 1.2) : 3));
      else if (sim.time >= at) {
        this.respawnAt.delete(a.id);
        this.respawnSafely(a);
      }
    }
  }

  private rulesFfa(): void {
    const target = this.goal(this.mode);
    if (target !== undefined) {
      for (const a of this.sim.agents) {
        if (a.kills >= target) {
          this.finish(a === this.player, 0, a.team);
          return;
        }
      }
    }
    this.autoRespawn();
  }

  private rulesTdm(): void {
    const s: [number, number] = [0, 0];
    for (const a of this.sim.agents) s[a.team as 0 | 1] += a.kills;
    // Kills by players who left still count for their team.
    s[0] += this.bankedKills[0];
    s[1] += this.bankedKills[1];
    this.scores = s;
    const target = this.goal(this.mode) ?? this.goal('tdm')!;
    if (s[0] >= target || s[1] >= target) {
      this.finish(s[0] >= target, 0, s[0] >= target ? 0 : 1);
      return;
    }
    this.autoRespawn();
  }

  private rulesKc(): void {
    const target = this.goal('kc')!;
    if (this.scores[0] >= target || this.scores[1] >= target) {
      this.finish(this.scores[0] >= target, 0, this.scores[0] >= target ? 0 : 1);
      return;
    }
    this.autoRespawn();
  }

  // ---------------------------------------------------------------- domination

  private setupFlags(): void {
    const sim = this.sim;
    const H = sim.arena.half;
    const spots: [string, number][] = [
      ['A', -H * 0.6],
      ['B', 0],
      ['C', H * 0.6]
    ];
    for (const [label, x] of spots) {
      const p = sim.arena.randomFreePoint(() => sim.rng.next(), x, 0, 6) ?? { x, z: 0 };
      this.flags.push({ label, x: p.x, z: p.z, r: 4, owner: -1, progress: 0 });
    }
    sim.objectives = this.flags;
    // Each bot goes for the nearest flag its team doesn't own; with all three held, it defends one.
    sim.rallyFor = (a) => {
      let best: Flag | null = null;
      let bestD = Infinity;
      for (const f of this.flags) {
        if (f.owner === a.team) continue;
        const d = Math.hypot(f.x - a.x, f.z - a.z) + (a.id % 3) * 4;
        if (d < bestD) {
          bestD = d;
          best = f;
        }
      }
      return best ?? this.flags[a.id % this.flags.length];
    };
  }

  private rulesDom(): void {
    const sim = this.sim;
    for (const f of this.flags) {
      const on = [0, 0];
      const onIds: number[] = [];
      for (const a of sim.agents) {
        if (!a.alive || Math.hypot(a.x - f.x, a.z - f.z) > f.r) continue;
        on[a.team]++;
        onIds.push(a.id);
      }
      if (on[0] && on[1]) continue;
      const team = on[0] ? 0 : on[1] ? 1 : -1;
      if (team < 0) continue;
      const dir = team === 0 ? 1 : -1;
      if (f.owner === team) {
        f.progress = dir;
        continue;
      }
      const rate = 0.045 * (1 + 0.5 * (Math.max(on[0], on[1]) - 1));
      f.progress = Math.max(-1, Math.min(1, f.progress + dir * rate));
      // Crossing neutral strips the old owner.
      if (f.owner >= 0 && Math.sign(f.progress) !== (f.owner === 0 ? 1 : -1)) f.owner = -1;
      if (Math.abs(f.progress) >= 1) {
        f.owner = team;
        this.notices.push({ kind: 'capture', flag: f.label, team, on: onIds });
        this.announceTeam(team, `${f.label} captured`, `${f.label} lost`, 1.6);
      }
    }
    // One point per held flag per second.
    if (sim.time - this.lastScoreTick >= 1) {
      this.lastScoreTick = sim.time;
      for (const f of this.flags) if (f.owner >= 0) this.scores[f.owner as 0 | 1]++;
    }
    const target = this.goal('dom')!;
    if (this.scores[0] >= target || this.scores[1] >= target) {
      this.finish(this.scores[0] >= target, 0, this.scores[0] >= target ? 0 : 1);
      return;
    }
    this.autoRespawn();
  }

  // ---------------------------------------------------------------- capture the flag

  private setupCtf(): void {
    const sim = this.sim;
    const H = sim.arena.half;
    for (const team of [0, 1]) {
      const bx = (team === 0 ? -1 : 1) * (H - 9);
      const p = sim.arena.randomFreePoint(() => sim.rng.next(), bx, 0, 4) ?? { x: bx, z: 0 };
      this.ctf.push({ team, homeX: p.x, homeZ: p.z, x: p.x, z: p.z, carrier: -1, home: true, droppedAt: 0 });
    }
    this.syncCtfObjectives();
    // Roles: carriers run home, a third chase their own stolen flag, some defend, the rest attack or escort.
    sim.rallyFor = (a) => {
      const own = this.ctf[a.team];
      const enemy = this.ctf[1 - a.team];
      if (enemy.carrier === a.id) return { x: own.homeX, z: own.homeZ, r: 1.5, urgent: true };
      const toOwn = Math.hypot(own.x - a.x, own.z - a.z);
      if (!own.home && (a.id % 3 === 0 || toOwn < 25)) return { x: own.x, z: own.z, r: 1 };
      if (a.id % 5 === 1) return { x: own.homeX, z: own.homeZ, r: 6 };
      if (enemy.carrier >= 0) {
        const c = sim.agents[enemy.carrier];
        return { x: c.x, z: c.z, r: 5 };
      }
      return { x: enemy.x, z: enemy.z, r: 1 };
    };
  }

  private syncCtfObjectives(): void {
    this.sim.objectives = this.ctf.map((f) => ({ label: 'FLAG', x: f.x, z: f.z, r: 1.6, owner: f.team, progress: 0, carried: f.carrier >= 0 }));
  }

  private returnFlag(f: CtfFlag): void {
    f.carrier = -1;
    f.home = true;
    f.x = f.homeX;
    f.z = f.homeZ;
  }

  private rulesCtf(): void {
    const sim = this.sim;
    for (const f of this.ctf) {
      if (f.carrier >= 0) {
        const c = sim.agents[f.carrier];
        f.x = c.x;
        f.z = c.z;
        // Capture: carrier reaches their own base while their own flag is home.
        const own = this.ctf[c.team];
        if (own.home && Math.hypot(c.x - own.homeX, c.z - own.homeZ) < 2.5) {
          this.scores[c.team as 0 | 1]++;
          this.returnFlag(f);
          this.notices.push({ kind: 'ctf', event: 'captured', team: c.team, by: c.id });
          this.announceTeam(c.team, 'Flag captured!', 'Enemy captured our flag', 2);
        }
        continue;
      }
      for (const a of sim.agents) {
        if (!a.alive || Math.hypot(a.x - f.x, a.z - f.z) > 1.5) continue;
        if (a.team !== f.team) {
          f.carrier = a.id;
          f.home = false;
          this.notices.push({ kind: 'ctf', event: 'taken', team: f.team, by: a.id });
          this.announceTeam(f.team, 'Our flag has been taken!', 'Enemy flag taken', 1.8);
          break;
        }
        if (!f.home) {
          this.returnFlag(f);
          this.notices.push({ kind: 'ctf', event: 'returned', team: f.team, by: a.id });
          break;
        }
      }
      if (!f.home && f.carrier < 0 && sim.time - f.droppedAt > FLAG_RETURN) {
        this.returnFlag(f);
        this.notices.push({ kind: 'ctf', event: 'returned', team: f.team, by: -1 });
      }
    }
    this.syncCtfObjectives();
    const target = this.goal('ctf')!;
    if (this.scores[0] >= target || this.scores[1] >= target) {
      this.finish(this.scores[0] >= target, 0, this.scores[0] >= target ? 0 : 1);
      return;
    }
    this.autoRespawn();
  }

  // ---------------------------------------------------------------- hardpoint

  private placeHill(i: number): void {
    this.hillIndex = i % HILLS.length;
    const h = HILLS[this.hillIndex];
    this.sim.rally = { x: h.x, z: h.z, r: HILL_R };
    this.hillMovedAt = this.sim.time;
  }

  /** Seconds until the hill moves. */
  hillSeconds(): number {
    return Math.max(0, HILL_MOVE - (this.sim.time - this.hillMovedAt));
  }

  private rulesKoth(): void {
    const sim = this.sim;
    const hill = sim.rally!;
    const on = [0, 0];
    for (const a of sim.agents) if (a.alive && Math.hypot(a.x - hill.x, a.z - hill.z) < hill.r) on[a.team]++;
    this.hillHolder = on[0] && on[1] ? -2 : on[0] ? 0 : on[1] ? 1 : -1;
    if (this.hillHolder >= 0) this.scores[this.hillHolder as 0 | 1] += SIM.dt * 6;
    const target = this.goal('koth')!;
    if (this.scores[0] >= target || this.scores[1] >= target) {
      this.finish(this.scores[0] >= target, 0, this.scores[0] >= target ? 0 : 1);
      return;
    }
    if (sim.time - this.hillMovedAt > HILL_MOVE) {
      this.placeHill(this.hillIndex + 1);
      this.announce('The hardpoint has moved');
    }
    this.autoRespawn();
  }

  // ---------------------------------------------------------------- infected

  private infect(a: Agent): void {
    a.team = 1;
    setLoadout(a, ['knife']);
    a.grenades = 0;
  }

  /** Seconds the survivors still have to hold out. */
  infectedSeconds(): number {
    return Math.max(0, INFECTED_TIME - this.sim.time);
  }

  private rulesInfected(): void {
    const sim = this.sim;
    const survivors = sim.agents.filter((a) => a.team === 0);
    this.scores = [survivors.length, sim.agents.length - survivors.length];
    if (survivors.length === 0) {
      // Everyone is infected: the infection wins (and so does the player, who is one of them).
      this.finish(this.player.team === 1, 0, 1);
      return;
    }
    if (sim.time >= INFECTED_TIME) {
      this.finish(this.player.team === 0, 0, 0);
      return;
    }
    this.autoRespawn();
  }

  /** The player chooses when to respawn (after a short delay) in respawn modes. */
  canPlayerRespawn(): boolean {
    return RESPAWN_MODES.includes(this.mode) && this.phase === 'live' && !this.player.alive && !this.eliminated(this.player) && this.sim.time - this.player.deathT > 2;
  }

  respawnPlayer(): void {
    if (this.canPlayerRespawn()) this.respawnSafely(this.player);
  }

  /** Respawns at the spawn point farthest from every living enemy (own side in team modes). */
  private respawnSafely(a: Agent): void {
    const sim = this.sim;
    if (a.dummy) {
      if (this.mode === 'aimtrainer') {
        const p = this.aimSpot();
        a.postX = p.x;
        a.postZ = p.z;
      }
      sim.respawn(a, a.postX, a.postZ, Math.PI);
      a.protectedUntil = 0;
      return;
    }
    if (PRACTICE_MODES.includes(this.mode)) {
      const p = sim.arena.teamSpawns[0][sim.rng.int(sim.arena.teamSpawns[0].length)];
      sim.respawn(a, p.x, p.z, 0);
      return;
    }
    const pool = this.def.teams && this.mode !== 'infected' ? sim.arena.teamSpawns[a.team] : sim.arena.spawns;
    let best = pool[0];
    let bestD = -1;
    for (const p of pool) {
      let nearest = Infinity;
      for (const b of sim.agents) if (b.alive && b.team !== a.team) nearest = Math.min(nearest, Math.hypot(b.x - p.x, b.z - p.z));
      // A little randomness so team spawns don't all pick the same point.
      const score = nearest + sim.rng.next() * 6;
      if (score > bestD) {
        bestD = score;
        best = p;
      }
    }
    sim.respawn(a, best.x, best.z, yawTo(best.x, best.z, 0, 0));
    if (this.mode === 'oitc') {
      a.ammo = 1;
      a.grenades = 0;
    }
    if (this.mode === 'knife' || this.mode === 'hideseek') a.grenades = 0;
    if (this.mode === 'roulette') setLoadout(a, this.rouletteLoadout());
  }

  // ---------------------------------------------------------------- survival

  private startWave(): void {
    this.wave++;
    this.waveQueue = 2 + this.wave * 2;
    this.player.hp = 100;
    this.player.grenades = Math.max(this.player.grenades, 2);
    this.phase = 'live';
    this.announce(`Wave ${this.wave}`);
  }

  private rulesSurvival(): void {
    const sim = this.sim;
    if (!this.player.alive) {
      this.finish(false);
      return;
    }
    if (this.phase === 'roundOver') {
      if (sim.time >= this.breakUntil) this.startWave();
      return;
    }
    const enemies = sim.agents.filter((a) => a.team === 1);
    const alive = enemies.filter((a) => a.alive).length;
    const maxAlive = Math.min(8, 2 + this.wave);
    if (this.waveQueue > 0 && alive < maxAlive) {
      const p = sim.arena.spawns
        .slice()
        .sort((a, b) => Math.hypot(b.x - this.player.x, b.z - this.player.z) - Math.hypot(a.x - this.player.x, a.z - this.player.z))[sim.rng.int(3)];
      const reuse = enemies.find((a) => !a.alive && sim.time - a.deathT > 6);
      let a: Agent;
      if (reuse) {
        sim.respawn(reuse, p.x, p.z, yawTo(p.x, p.z, 0, 0));
        a = reuse;
      } else {
        a = sim.spawn(1, this.opts.botControl, p.x, p.z, yawTo(p.x, p.z, 0, 0));
      }
      // Later waves bring better guns and sharper aim.
      setLoadout(a, [PRIMARY_POOL[sim.rng.int(Math.min(PRIMARY_POOL.length, 3 + this.wave))], 'pistol']);
      a.skill = DIFFICULTY[this.opts.difficulty].skill * Math.max(0.6, 1 - this.wave * 0.04);
      a.targetId = this.player.id;
      a.lastSeenX = this.player.x;
      a.lastSeenZ = this.player.z;
      a.lastSeenT = sim.time;
      this.waveQueue--;
      return;
    }
    if (this.waveQueue === 0 && alive === 0) {
      this.phase = 'roundOver';
      this.breakUntil = sim.time + WAVE_BREAK;
      this.announce(`Wave ${this.wave} cleared`, WAVE_BREAK);
    }
  }

  enemiesRemaining(): number {
    if (this.mode === 'survival' || this.mode === 'zombies') return this.waveQueue + this.sim.agents.filter((a) => a.team === 1 && a.alive && !isHuman(a)).length;
    return this.sim.agents.filter((a) => a.alive && a.team !== this.player.team).length;
  }

  // ---------------------------------------------------------------- battle royale

  private dropMedkit(): void {
    const sim = this.sim;
    const z = sim.zone;
    const H = sim.arena.half;
    const p = sim.arena.randomFreePoint(() => sim.rng.next(), z ? z.x : 0, z ? z.z : 0, Math.min(z ? z.r * 0.9 : H, H * 1.3));
    if (p) sim.spawnPickup('medkit', p.x, p.z);
  }

  /** Zone state for the HUD: seconds until the next change, and whether it is shrinking. */
  zoneInfo(): { shrinking: boolean; seconds: number; phase: number } | null {
    if (this.mode !== 'br' || this.brPhase >= BR_PHASES.length) return null;
    const idx = Math.max(0, this.brPhase);
    const ph = BR_PHASES[idx];
    const t = this.sim.time - this.brPhaseStart;
    if (this.brPhase < 0 || t < ph.hold) return { shrinking: false, seconds: Math.max(0, ph.hold - t), phase: idx + 1 };
    return { shrinking: true, seconds: Math.max(0, ph.hold + ph.shrink - t), phase: idx + 1 };
  }

  /** Where the zone is heading, for the minimap. */
  zoneTarget(): { x: number; z: number; r: number } {
    return this.zoneTo;
  }

  private rulesBr(): void {
    const sim = this.sim;
    const zone = sim.zone!;
    if (this.brPhase < 0 || sim.time - this.brPhaseStart >= BR_PHASES[this.brPhase].hold + BR_PHASES[this.brPhase].shrink) {
      if (this.brPhase + 1 < BR_PHASES.length) {
        this.brPhase++;
        this.brPhaseStart = sim.time;
        const ph = BR_PHASES[this.brPhase];
        this.zoneFrom = { x: zone.x, z: zone.z, r: zone.r };
        // The next circle lies entirely inside the current one.
        const base = this.brPhase === 0 ? sim.arena.half * 0.95 : zone.r;
        const r = Math.max(this.brPhase === BR_PHASES.length - 1 ? 0 : 6, base * ph.scale);
        const slack = Math.max(0, (this.brPhase === 0 ? sim.arena.half * 0.5 : zone.r) - r) * 0.7;
        const ang = sim.rng.next() * Math.PI * 2;
        const off = sim.rng.next() * slack;
        this.zoneTo = { x: zone.x * (this.brPhase === 0 ? 0 : 1) + Math.cos(ang) * off, z: zone.z * (this.brPhase === 0 ? 0 : 1) + Math.sin(ang) * off, r };
        zone.dps = ph.dps;
      }
    }
    const ph = BR_PHASES[this.brPhase];
    const t = sim.time - this.brPhaseStart;
    if (t > ph.hold) {
      const k = Math.min(1, (t - ph.hold) / ph.shrink);
      zone.x = this.zoneFrom.x + (this.zoneTo.x - this.zoneFrom.x) * k;
      zone.z = this.zoneFrom.z + (this.zoneTo.z - this.zoneFrom.z) * k;
      zone.r = this.zoneFrom.r + (this.zoneTo.r - this.zoneFrom.r) * k;
    }
    if (sim.time >= this.nextMedkitT) {
      this.nextMedkitT = sim.time + 4;
      if (sim.pickups.filter((m) => m.active && m.kind === 'medkit').length < 40) this.dropMedkit();
    }
    // Squads: anyone who dies comes back near a squadmate after 30 s, as long as one of them is still alive.
    if (SQUAD_SIZE[this.mode]) {
      for (const a of sim.agents) {
        if (a.alive) continue;
        const mate = sim.agents.find((b) => b.alive && b.team === a.team);
        if (!mate) {
          this.respawnAt.delete(a.id);
          continue;
        }
        const at = this.respawnAt.get(a.id);
        if (at === undefined) this.respawnAt.set(a.id, sim.time + SQUAD_RESPAWN);
        else if (sim.time >= at) {
          this.respawnAt.delete(a.id);
          const p = sim.arena.randomFreePoint(() => sim.rng.next(), mate.x, mate.z, 6) ?? { x: mate.x, z: mate.z };
          sim.respawn(a, p.x, p.z, mate.yaw);
          a.protectedUntil = sim.time + 3;
        }
      }
    }
    const alive = sim.agents.filter((a) => a.alive);
    // Squads: you are out when your whole squad is; placement counts squads.
    const squadsLeft = new Set(alive.map((a) => a.team));
    if (!alive.some((a) => a.team === this.player.team)) {
      this.finish(false, squadsLeft.size + 1);
      return;
    }
    if (squadsLeft.size === 1) this.finish(true, 1, this.player.team);
  }

  private finish(win: boolean, placement = 0, winTeam = -1): void {
    if (this.phase === 'over') return;
    this.phase = 'over';
    this.winTeam = winTeam;
    this.result = win ? 'win' : 'lose';
    this.placement = placement;
    const text =
      isBrMode(this.mode)
        ? win
          ? 'Winner winner!'
          : `Eliminated — #${placement}`
        : this.mode === 'survival' || this.mode === 'zombies'
          ? `Survived ${this.wave - 1} wave${this.wave === 2 ? '' : 's'}`
          : win
            ? 'Victory'
            : 'Defeat';
    this.announce(text, 9999);
  }

  /** Living soldiers per side, for the HUD. */
  teamCounts(): [number, number] {
    const c: [number, number] = [0, 0];
    for (const a of this.sim.agents) {
      if (!a.alive) continue;
      if (a.team === this.player.team) c[0]++;
      else c[1]++;
    }
    return c;
  }
}

const shuffle = <T>(arr: T[], rand: () => number): T[] => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
