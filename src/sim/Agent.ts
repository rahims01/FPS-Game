import { SOLDIER, type HitRegion } from './config';
import { WEAPONS, type WeaponId } from './weapons';
import type { Point } from './Arena';

/** Discrete action space shared by the heuristic bots, the PPO trainer and the in-browser policy. */
export const ACTIONS = ['hold', 'advance', 'strafe_left', 'strafe_right', 'retreat', 'sprint', 'take_cover', 'reload'] as const;
export type ActionName = (typeof ACTIONS)[number];
export const A: Record<ActionName, number> = Object.fromEntries(ACTIONS.map((n, i) => [n, i])) as Record<ActionName, number>;

/** Who chooses a bot's actions. 'external' means the caller sets agent.action (training). */
export type Control = 'player' | 'remote' | 'heuristic' | 'learned' | 'external';

export type DeathCause = WeaponId | 'grenade' | 'airstrike' | 'zone';

/**
 * Bot personalities. They share the learned tactics but differ in how they
 * move, aim, use cover and grenades, and which guns they carry.
 */
export type BotStyle = 'soldier' | 'rusher' | 'sniper' | 'flanker' | 'tactician';
export const BOT_STYLES: BotStyle[] = ['soldier', 'rusher', 'sniper', 'flanker', 'tactician'];

/** Guns each personality carries and its aim multiplier (lower = sharper). */
export const STYLE_KIT: Record<BotStyle, { guns: WeaponId[]; aim: number }> = {
  soldier: { guns: ['rifle', 'ak', 'smg', 'lmg', 'burst'], aim: 1 },
  rusher: { guns: ['shotgun', 'smg', 'smg'], aim: 1.15 },
  sniper: { guns: ['sniper', 'sniper', 'dmr', 'lmg'], aim: 0.75 },
  flanker: { guns: ['smg', 'rifle', 'shotgun'], aim: 1 },
  tactician: { guns: ['rifle', 'lmg', 'burst', 'dmr'], aim: 0.9 }
};

/** Humans: the local player and remote (online) players. */
export const isHuman = (a: { control: Control }): boolean => a.control === 'player' || a.control === 'remote';

/** The weapon in hand. */
export const weaponOf = (a: { weapons: WeaponId[]; slot: number }) => WEAPONS[a.weapons[a.slot] ?? 'rifle'];

/** Gives an agent a new loadout with full magazines (slot 0 in hand). */
export const setLoadout = (a: Agent, weapons: WeaponId[]): void => {
  a.weapons = weapons.slice();
  a.slot = 0;
  a.stash = weapons.map((w) => WEAPONS[w].magazine);
  a.ammo = a.stash[0];
  a.reloadT = 0;
  a.switchT = 0;
};

/** Eye height above the feet (lower when crouching or sliding). */
export const eyeHeight = (a: { crouching: boolean; slideT: number }): number => (a.crouching || a.slideT > 0 ? SOLDIER.eye * 0.68 : SOLDIER.eye);

export interface Agent {
  id: number;
  /** Incremented on every respawn so views know to rebuild. */
  life: number;
  team: number;
  control: Control;
  alive: boolean;
  hp: number;

  // Body. (x, z) on the ground plane, y = feet height.
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  onGround: boolean;
  yaw: number;
  pitch: number;
  sprinting: boolean;

  // Loadout. `weapons[slot]` is in hand; `ammo` is that weapon's magazine.
  weapons: WeaponId[];
  slot: number;
  /** Magazine contents of the weapons not in hand. */
  stash: number[];
  /** Time left on a weapon switch (can't fire). */
  switchT: number;
  /** Semi-automatic weapons need the trigger released between shots. */
  triggerHeld: boolean;
  meleeCd: number;
  grenades: number;
  grenadeCd: number;
  crouching: boolean;
  /** Time left in a slide (sprint + crouch). */
  slideT: number;
  /** No damage until this time (cleared on firing). */
  protectedUntil: number;
  /** Incoming damage multiplier (juggernaut armour). */
  armor: number;
  /** Kills since last death. */
  streak: number;
  /** Hide & Seek: seekers can't move or shoot until this time. */
  frozenUntil: number;
  /** Gun Game ladder position. */
  tier: number;
  tierKills: number;
  ammo: number;
  reloadT: number;
  fireCd: number;
  recoil: number;
  recoilYaw: number;
  /** Position in the weapon's recoil pattern; resets when the trigger rests. */
  recoilIdx: number;
  lastShotT: number;
  aiming: boolean;

  // Damage bookkeeping.
  lastHitT: number;
  lastHitDirX: number;
  lastHitDirZ: number;
  killedBy: number;
  deathRegion: HitRegion;
  deathDirX: number;
  deathDirY: number;
  deathDirZ: number;
  deathT: number;
  /** What killed it: a weapon, a grenade, an airstrike or the zone. */
  deathCause: DeathCause;

  // Bot perception and memory.
  /** Ticks offset so bots don't all think on the same tick. */
  phase: number;
  action: number;
  prevAction: number;
  actionSince: number;
  targetId: number;
  seesTarget: boolean;
  /** Time spent continuously tracking the visible target (drives reaction time and aim settling). */
  trackT: number;
  lastSeenX: number;
  lastSeenZ: number;
  lastSeenT: number;
  inCover: boolean;
  aimErrYaw: number;
  aimErrPitch: number;
  aimErrT: number;
  burstLeft: number;
  burstPauseT: number;
  /** Lower is better. Scales aim error and reaction time. */
  skill: number;
  cover: Point | null;
  coverT: number;
  /** Next time a roaming bot (battle royale) picks a new wander point. */
  roamT: number;
  path: Point[];
  pathGoalX: number;
  pathGoalZ: number;
  pathT: number;
  /** Free-form memory for the heuristic brain. */
  brain: { strafeDir: number; strafeUntil: number; aggression: number };
  /** How this bot likes to fight. */
  style: BotStyle;
  /** Wait-and-watch timer for snipers holding an angle. */
  holdUntil: number;
  /** Movement speed multiplier (zombies get faster each wave). */
  speedMul: number;
  /** Knife damage (zombies claw for less than a one-hit knife kill). */
  meleeDamage: number;
  /** How long a bot has been trying to move without getting anywhere. */
  stuckT: number;
  /** Human habits (matchmade bots only): teabag after a kill, glance around, still loading in. */
  tbagUntil: number;
  glanceUntil: number;
  glanceYaw: number;
  nextGlance: number;
  afkUntil: number;
  /** A labelled bot ("Bot 1") that moves like a machine (fills a slot someone left). */
  robotic: boolean;
  /** Practice target: stands still or strafes around its post and never shoots. */
  dummy: '' | 'still' | 'strafe';
  postX: number;
  postZ: number;

  // Stats and RL.
  kills: number;
  deaths: number;
  damageDealt: number;
  damageTaken: number;
  shots: number;
  hits: number;
  headshots: number;
  bestStreak: number;
  /** Rounds still to come in the current burst (burst weapons). */
  burstQueue: number;
  /** Reward accumulated since the trainer last read it. */
  reward: number;
}

export const createAgent = (id: number, team: number, control: Control, x: number, z: number, yaw: number): Agent => ({
  id,
  life: 0,
  team,
  control,
  alive: true,
  hp: SOLDIER.hp,
  x,
  y: 0,
  z,
  vx: 0,
  vy: 0,
  vz: 0,
  onGround: true,
  yaw,
  pitch: 0,
  sprinting: false,
  weapons: ['rifle', 'pistol'],
  slot: 0,
  stash: [WEAPONS.rifle.magazine, WEAPONS.pistol.magazine],
  switchT: 0,
  triggerHeld: false,
  meleeCd: 0,
  grenades: 2,
  grenadeCd: 0,
  crouching: false,
  slideT: 0,
  protectedUntil: 0,
  armor: 1,
  streak: 0,
  frozenUntil: 0,
  tier: 0,
  tierKills: 0,
  ammo: WEAPONS.rifle.magazine,
  reloadT: 0,
  fireCd: 0,
  recoil: 0,
  recoilYaw: 0,
  recoilIdx: 0,
  lastShotT: -99,
  aiming: false,
  lastHitT: -99,
  lastHitDirX: 0,
  lastHitDirZ: 0,
  killedBy: -1,
  deathRegion: 'torso',
  deathDirX: 0,
  deathDirY: 0,
  deathDirZ: 0,
  deathT: 0,
  deathCause: 'rifle',
  phase: id % 6,
  action: 0,
  prevAction: 0,
  actionSince: 0,
  targetId: -1,
  seesTarget: false,
  trackT: 0,
  lastSeenX: 0,
  lastSeenZ: 0,
  lastSeenT: -99,
  inCover: false,
  aimErrYaw: 0,
  aimErrPitch: 0,
  aimErrT: 0,
  burstLeft: 0,
  burstPauseT: 0,
  skill: 1,
  cover: null,
  coverT: -99,
  roamT: 0,
  path: [],
  pathGoalX: 0,
  pathGoalZ: 0,
  pathT: -99,
  brain: { strafeDir: 1, strafeUntil: 0, aggression: 0.5 },
  style: 'soldier',
  holdUntil: 0,
  speedMul: 1,
  meleeDamage: 150,
  stuckT: 0,
  tbagUntil: 0,
  glanceUntil: 0,
  glanceYaw: 0,
  nextGlance: 0,
  afkUntil: 0,
  robotic: false,
  dummy: '',
  postX: 0,
  postZ: 0,
  kills: 0,
  deaths: 0,
  damageDealt: 0,
  damageTaken: 0,
  shots: 0,
  hits: 0,
  headshots: 0,
  bestStreak: 0,
  burstQueue: 0,
  reward: 0
});
