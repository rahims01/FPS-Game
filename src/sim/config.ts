// Every gameplay number lives here. The browser game and the headless trainer
// read the same values, so a policy trained against these rules plays by them.

export const SIM = {
  /** Fixed physics/gameplay tick. */
  dt: 1 / 60,
  /** Bots choose a new action every N ticks (10 Hz). One RL step = one decision. */
  decisionTicks: 6,
  gravity: 20
} as const;

export const SOLDIER = {
  radius: 0.38,
  height: 1.8,
  eye: 1.62,
  hp: 100,
  walkSpeed: 3.6,
  sprintSpeed: 6.4,
  backSpeed: 2.6,
  accel: 40,
  airAccel: 8,
  jumpSpeed: 7,
  /** Ledges up to this height are stepped onto without jumping. */
  stepHeight: 0.45,
  regenDelay: 5,
  regenRate: 18,
  /** Bots react this long after first spotting a target before they fire. */
  reactionTime: 0.35,
  /** How far bots hear gunfire. */
  hearingRange: 38,
  /** Half-angle of a bot's vision cone. */
  fovCos: Math.cos((75 * Math.PI) / 180),
  /** Bots forget a target they have not seen for this long, then hunt it. */
  memory: 8
} as const;

export type HitRegion = 'head' | 'torso' | 'legs';

export const RIFLE = {
  magazine: 30,
  reloadTime: 2.1,
  fireInterval: 0.1,
  range: 150,
  damage: { head: 95, torso: 30, legs: 20 } satisfies Record<HitRegion, number>,
  /** Cone half-angles in radians. */
  spreadStill: 0.004,
  spreadMoving: 0.022,
  spreadAir: 0.06,
  /** Vertical kick per shot, recovered over time. */
  recoilKick: 0.011,
  recoilRecover: 7
} as const;

/** Hitboxes, relative to the agent's feet. */
export const HITBOX = {
  headY: 1.62,
  headR: 0.15,
  torsoR: 0.27,
  torsoMinY: 0.95,
  torsoMaxY: 1.5,
  legsR: 0.2
} as const;

/** Bot aim: angular error decays from `initial` toward `floor` while tracking a target. */
export const BOT_AIM = {
  initial: 0.09,
  floor: 0.012,
  settleTime: 0.7,
  turnRate: 7,
  /** Bots only fire when their aim is within this angle of the target. */
  fireCone: 0.12
} as const;
