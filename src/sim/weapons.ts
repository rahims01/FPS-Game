import type { HitRegion } from './config';

export type WeaponId =
  | 'rifle' | 'smg' | 'shotgun' | 'sniper' | 'lmg' | 'pistol' | 'knife' | 'burst' | 'dmr' | 'ak' | 'revolver' | 'scar' | 'uzi' | 'autoshotgun' | 'barrett' | 'deagle' | 'mpistol'
  // The admin's arsenal (see ADMIN_WEAPONS).
  | 'sovereign' | 'sovburst' | 'moderator' | 'kick' | 'permaban' | 'gavel';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  /** Short label for the kill feed. */
  tag: string;
  slot: 'primary' | 'secondary' | 'melee';
  /** Per bullet (per pellet for shotguns). */
  damage: Record<HitRegion, number>;
  /** Seconds between shots. */
  interval: number;
  /** Holding the trigger keeps firing. Semi-automatics need a fresh click. */
  auto: boolean;
  magazine: number;
  reload: number;
  pellets: number;
  spreadStill: number;
  spreadMoving: number;
  spreadAir: number;
  /** Spread multiplier while aiming down sights. */
  adsSpread: number;
  /** Damage falls off linearly from `falloffStart` to `falloffEnd` metres, down to `minMul`. */
  falloffStart: number;
  falloffEnd: number;
  minMul: number;
  range: number;
  recoil: number;
  /** Movement speed multiplier while holding it. */
  move: number;
  /** Field of view while aiming (degrees). Scoped weapons show a scope overlay. */
  adsFov: number;
  scope: boolean;
  /** Distance bots like to fight at with it. */
  preferredRange: number;
  /**
   * Recoil pattern: [up, sideways] kick per shot, in units of `recoil`. Sustained
   * fire walks through it (the last entries repeat), so it can be learned and
   * pulled against. It resets once the trigger rests.
   */
  pattern: [number, number][];
  /** Rounds per trigger pull for burst weapons, fired `burstGap` seconds apart. */
  burst?: number;
  burstGap?: number;
  /** Attachments (see attachments.ts): the sight drawn while aiming, a quiet muzzle, a laser beam. */
  optic?: 'reddot' | 'holo';
  suppressed?: boolean;
  laser?: boolean;
  /** Admin guns: goes through walls and every player in the line; shoves whoever it hits; marks hits on the shooter's team's minimaps. */
  pierce?: boolean;
  knockback?: number;
  flag?: boolean;
  admin?: boolean;
}

const gun = (d: Omit<WeaponDef, 'pellets' | 'scope' | 'adsSpread' | 'spreadAir' | 'range' | 'pattern'> & Partial<WeaponDef>): WeaponDef => ({
  pattern: [[1, 0]],
  pellets: 1,
  scope: false,
  adsSpread: 0.35,
  spreadAir: 0.06,
  range: 150,
  ...d
});

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  // ---- The admin's arsenal.
  sovereign: gun({
    id: 'sovereign',
    name: 'Sovereign',
    tag: 'SOVEREIGN',
    slot: 'primary',
    admin: true,
    // M16 accuracy, AK punch: three body hits.
    damage: { head: 100, torso: 36, legs: 26 },
    interval: 0.095,
    auto: true,
    magazine: 40,
    reload: 1.6,
    spreadStill: 0.0035,
    spreadMoving: 0.019,
    falloffStart: 35,
    falloffEnd: 80,
    minMul: 0.8,
    recoil: 0.009,
    move: 1,
    adsFov: 18,
    preferredRange: 20,
    pattern: [[1, 0], [1.05, 0.05], [1.1, 0.12], [1.1, 0.25], [1, 0.35], [0.9, 0.3], [0.8, 0.05], [0.7, -0.2], [0.6, -0.4], [0.6, -0.3], [0.5, 0], [0.5, 0.3]]
  }),
  sovburst: gun({
    id: 'sovburst',
    name: 'Sovereign Burst',
    tag: 'SOV BURST',
    slot: 'primary',
    admin: true,
    damage: { head: 110, torso: 38, legs: 27 },
    interval: 0.26,
    burst: 3,
    burstGap: 0.06,
    auto: false,
    magazine: 36,
    reload: 1.7,
    spreadStill: 0.0025,
    spreadMoving: 0.017,
    falloffStart: 40,
    falloffEnd: 90,
    minMul: 0.85,
    recoil: 0.009,
    move: 1,
    adsFov: 20,
    preferredRange: 24,
    pattern: [[1, 0.1], [1.1, -0.1], [1.15, 0.12]]
  }),
  moderator: gun({
    id: 'moderator',
    name: 'Moderator',
    tag: 'MODERATOR',
    slot: 'primary',
    admin: true,
    flag: true,
    damage: { head: 150, torso: 55, legs: 40 },
    interval: 0.28,
    auto: false,
    magazine: 15,
    reload: 2.0,
    spreadStill: 0.016,
    spreadMoving: 0.04,
    adsSpread: 0.06,
    falloffStart: 999,
    falloffEnd: 1000,
    minMul: 1,
    range: 260,
    recoil: 0.028,
    move: 0.97,
    adsFov: 34,
    preferredRange: 30,
    pattern: [[1, 0.1], [1, -0.1]]
  }),
  kick: gun({
    id: 'kick',
    name: 'Kick',
    tag: 'KICK',
    slot: 'primary',
    admin: true,
    knockback: 1.1,
    damage: { head: 24, torso: 16, legs: 11 },
    pellets: 9,
    interval: 0.7,
    auto: false,
    magazine: 8,
    reload: 2.2,
    spreadStill: 0.065,
    spreadMoving: 0.075,
    adsSpread: 0.75,
    falloffStart: 6,
    falloffEnd: 20,
    minMul: 0.15,
    range: 60,
    recoil: 0.05,
    move: 1,
    adsFov: 10,
    preferredRange: 5,
    pattern: [[1, 0.15], [1, -0.15]]
  }),
  permaban: gun({
    id: 'permaban',
    name: 'Permaban',
    tag: 'PERMABAN',
    slot: 'primary',
    admin: true,
    pierce: true,
    damage: { head: 200, torso: 150, legs: 120 },
    interval: 1.5,
    auto: false,
    magazine: 5,
    reload: 2.8,
    spreadStill: 0.001,
    spreadMoving: 0.012,
    adsSpread: 0.2,
    falloffStart: 999,
    falloffEnd: 1000,
    minMul: 1,
    range: 300,
    recoil: 0.06,
    move: 0.93,
    adsFov: 62,
    scope: true,
    preferredRange: 35,
    pattern: [[1, 0]]
  }),
  gavel: gun({
    id: 'gavel',
    name: 'Gavel',
    tag: 'GAVEL',
    slot: 'secondary',
    admin: true,
    // Two to the body, one to the head, at any range.
    damage: { head: 150, torso: 55, legs: 40 },
    interval: 0.35,
    auto: false,
    magazine: 8,
    reload: 1.6,
    spreadStill: 0.005,
    spreadMoving: 0.016,
    adsSpread: 0.4,
    falloffStart: 999,
    falloffEnd: 1000,
    minMul: 1,
    recoil: 0.06,
    move: 1.04,
    adsFov: 12,
    preferredRange: 16,
    pattern: [[1, 0.25], [1.1, -0.2]]
  }),
  rifle: gun({
    id: 'rifle',
    name: 'M16 Assault Rifle',
    tag: 'M16',
    slot: 'primary',
    damage: { head: 95, torso: 30, legs: 20 },
    interval: 0.1,
    auto: true,
    magazine: 30,
    reload: 2.1,
    spreadStill: 0.004,
    spreadMoving: 0.022,
    falloffStart: 30,
    falloffEnd: 70,
    minMul: 0.75,
    recoil: 0.011,
    move: 1,
    adsFov: 18,
    preferredRange: 18,
    pattern: [[1, 0], [1.1, 0.05], [1.2, 0.15], [1.2, 0.3], [1.1, 0.45], [1, 0.4], [0.9, 0.1], [0.8, -0.3], [0.7, -0.6], [0.7, -0.7], [0.6, -0.4], [0.6, 0.1], [0.6, 0.5], [0.5, 0.6], [0.5, 0.2], [0.5, -0.3]]
  }),
  smg: gun({
    id: 'smg',
    name: 'Vector SMG',
    tag: 'SMG',
    slot: 'primary',
    damage: { head: 55, torso: 22, legs: 16 },
    interval: 0.065,
    auto: true,
    magazine: 32,
    reload: 1.8,
    spreadStill: 0.011,
    spreadMoving: 0.018,
    falloffStart: 12,
    falloffEnd: 35,
    minMul: 0.55,
    recoil: 0.008,
    move: 1.08,
    pattern: [[0.8, 0], [0.9, 0.4], [0.9, -0.4], [0.9, 0.5], [0.8, -0.5], [0.7, 0.6], [0.7, -0.6], [0.6, 0.5], [0.6, -0.5]],
    adsFov: 12,
    preferredRange: 9
  }),
  shotgun: gun({
    id: 'shotgun',
    name: 'Pump Shotgun',
    tag: 'SHOTGUN',
    slot: 'primary',
    damage: { head: 24, torso: 16, legs: 11 },
    pellets: 9,
    interval: 0.85,
    auto: false,
    magazine: 6,
    reload: 2.6,
    spreadStill: 0.065,
    spreadMoving: 0.075,
    adsSpread: 0.75,
    falloffStart: 6,
    falloffEnd: 20,
    minMul: 0.15,
    range: 60,
    recoil: 0.05,
    move: 1,
    pattern: [[1, 0.15], [1, -0.15]],
    adsFov: 10,
    preferredRange: 5
  }),
  sniper: gun({
    id: 'sniper',
    name: 'Bolt-Action Sniper',
    tag: 'SNIPER',
    slot: 'primary',
    damage: { head: 200, torso: 110, legs: 70 },
    interval: 1.25,
    auto: false,
    magazine: 5,
    reload: 2.8,
    spreadStill: 0.045,
    spreadMoving: 0.08,
    adsSpread: 0.02,
    falloffStart: 999,
    falloffEnd: 1000,
    minMul: 1,
    range: 300,
    recoil: 0.06,
    move: 0.92,
    pattern: [[1, 0.1]],
    adsFov: 62,
    scope: true,
    preferredRange: 35
  }),
  lmg: gun({
    id: 'lmg',
    name: 'M60 LMG',
    tag: 'LMG',
    slot: 'primary',
    damage: { head: 70, torso: 27, legs: 18 },
    interval: 0.085,
    auto: true,
    magazine: 75,
    reload: 4,
    spreadStill: 0.008,
    spreadMoving: 0.03,
    spreadAir: 0.07,
    falloffStart: 30,
    falloffEnd: 70,
    minMul: 0.75,
    recoil: 0.009,
    move: 0.86,
    pattern: [[0.5, 0], [0.6, 0], [0.8, 0.1], [1, 0.2], [1.3, 0.3], [1.5, 0.5], [1.5, 0.2], [1.4, -0.4], [1.3, -0.8], [1.2, -0.6], [1.2, 0], [1.2, 0.7], [1.2, 0.8], [1.2, 0.2], [1.2, -0.6]],
    adsFov: 15,
    preferredRange: 20
  }),
  pistol: gun({
    id: 'pistol',
    name: 'Pistol',
    tag: 'PISTOL',
    slot: 'secondary',
    damage: { head: 70, torso: 28, legs: 20 },
    interval: 0.16,
    auto: false,
    magazine: 12,
    reload: 1.4,
    spreadStill: 0.006,
    spreadMoving: 0.015,
    adsSpread: 0.5,
    falloffStart: 15,
    falloffEnd: 40,
    minMul: 0.6,
    recoil: 0.02,
    move: 1.1,
    pattern: [[1, 0.2], [1, 0.25], [1.05, 0.15]],
    adsFov: 10,
    preferredRange: 12
  }),
  burst: gun({
    id: 'burst',
    name: 'M4 Burst Rifle',
    tag: 'BURST',
    slot: 'primary',
    damage: { head: 100, torso: 34, legs: 24 },
    interval: 0.3,
    burst: 3,
    burstGap: 0.065,
    auto: false,
    magazine: 30,
    reload: 2.2,
    spreadStill: 0.003,
    spreadMoving: 0.02,
    falloffStart: 35,
    falloffEnd: 80,
    minMul: 0.8,
    recoil: 0.01,
    move: 1,
    adsFov: 20,
    preferredRange: 22,
    pattern: [[1, 0.1], [1.15, -0.1], [1.25, 0.15]]
  }),
  dmr: gun({
    id: 'dmr',
    name: 'Marksman DMR',
    tag: 'DMR',
    slot: 'primary',
    damage: { head: 140, torso: 55, legs: 40 },
    interval: 0.3,
    auto: false,
    magazine: 15,
    reload: 2.5,
    spreadStill: 0.02,
    spreadMoving: 0.05,
    adsSpread: 0.08,
    falloffStart: 999,
    falloffEnd: 1000,
    minMul: 1,
    range: 250,
    recoil: 0.03,
    move: 0.96,
    adsFov: 34,
    preferredRange: 28,
    pattern: [[1, 0.1], [1, -0.1]]
  }),
  ak: gun({
    id: 'ak',
    name: 'AK-47',
    tag: 'AK47',
    slot: 'primary',
    damage: { head: 105, torso: 36, legs: 24 },
    interval: 0.11,
    auto: true,
    magazine: 30,
    reload: 2.4,
    spreadStill: 0.005,
    spreadMoving: 0.026,
    falloffStart: 25,
    falloffEnd: 60,
    minMul: 0.7,
    recoil: 0.014,
    move: 0.97,
    adsFov: 16,
    preferredRange: 16,
    pattern: [[1, 0], [1.3, 0.1], [1.4, 0.3], [1.4, 0.5], [1.2, 0.7], [1, 0.3], [0.9, -0.3], [0.9, -0.8], [0.8, -1], [0.8, -0.6], [0.7, 0.2], [0.7, 0.8], [0.7, 0.9], [0.6, 0.3], [0.6, -0.4]]
  }),
  revolver: gun({
    id: 'revolver',
    name: 'Magnum Revolver',
    tag: 'MAGNUM',
    slot: 'secondary',
    damage: { head: 110, torso: 55, legs: 35 },
    interval: 0.45,
    auto: false,
    magazine: 6,
    reload: 2.6,
    spreadStill: 0.005,
    spreadMoving: 0.016,
    adsSpread: 0.4,
    falloffStart: 20,
    falloffEnd: 50,
    minMul: 0.7,
    recoil: 0.05,
    move: 1.05,
    pattern: [[1, 0.2], [1, -0.2]],
    adsFov: 10,
    preferredRange: 14
  }),
  scar: gun({
    id: 'scar',
    name: 'SCAR-H Battle Rifle',
    tag: 'SCAR',
    slot: 'primary',
    damage: { head: 120, torso: 45, legs: 32 },
    interval: 0.16,
    auto: true,
    magazine: 20,
    reload: 2.5,
    spreadStill: 0.004,
    spreadMoving: 0.028,
    falloffStart: 40,
    falloffEnd: 90,
    minMul: 0.8,
    recoil: 0.019,
    move: 0.94,
    adsFov: 20,
    preferredRange: 24,
    pattern: [[1, 0], [1.3, 0.2], [1.5, -0.1], [1.5, -0.4], [1.3, 0.3], [1.2, 0.6], [1.1, 0.1], [1, -0.5]]
  }),
  uzi: gun({
    id: 'uzi',
    name: 'Uzi',
    tag: 'UZI',
    slot: 'primary',
    damage: { head: 48, torso: 20, legs: 14 },
    interval: 0.055,
    auto: true,
    magazine: 32,
    reload: 1.6,
    spreadStill: 0.014,
    spreadMoving: 0.02,
    falloffStart: 10,
    falloffEnd: 28,
    minMul: 0.5,
    recoil: 0.007,
    move: 1.1,
    adsFov: 10,
    preferredRange: 8,
    pattern: [[0.7, 0.3], [0.8, -0.5], [0.8, 0.6], [0.7, -0.6], [0.7, 0.5], [0.6, -0.4]]
  }),
  autoshotgun: gun({
    id: 'autoshotgun',
    name: 'Saiga Auto Shotgun',
    tag: 'SAIGA',
    slot: 'primary',
    damage: { head: 18, torso: 12, legs: 8 },
    pellets: 8,
    interval: 0.28,
    auto: true,
    magazine: 8,
    reload: 2.8,
    spreadStill: 0.075,
    spreadMoving: 0.085,
    adsSpread: 0.8,
    falloffStart: 5,
    falloffEnd: 16,
    minMul: 0.15,
    range: 50,
    recoil: 0.04,
    move: 0.97,
    adsFov: 8,
    preferredRange: 5,
    pattern: [[1, 0.2], [1, -0.2], [1.1, 0.3]]
  }),
  barrett: gun({
    id: 'barrett',
    name: '.50 Cal Sniper',
    tag: '.50 CAL',
    slot: 'primary',
    damage: { head: 250, torso: 105, legs: 80 },
    interval: 0.55,
    auto: false,
    magazine: 8,
    reload: 3.6,
    spreadStill: 0.06,
    spreadMoving: 0.1,
    adsSpread: 0.03,
    falloffStart: 999,
    falloffEnd: 1000,
    minMul: 1,
    range: 320,
    recoil: 0.09,
    move: 0.86,
    pattern: [[1, 0.15], [1, -0.1]],
    adsFov: 66,
    scope: true,
    preferredRange: 40
  }),
  deagle: gun({
    id: 'deagle',
    name: 'Desert Eagle',
    tag: 'DEAGLE',
    slot: 'secondary',
    damage: { head: 100, torso: 50, legs: 34 },
    interval: 0.32,
    auto: false,
    magazine: 7,
    reload: 2.0,
    spreadStill: 0.008,
    spreadMoving: 0.02,
    adsSpread: 0.45,
    falloffStart: 18,
    falloffEnd: 45,
    minMul: 0.65,
    recoil: 0.055,
    move: 1.04,
    pattern: [[1, 0.25], [1.1, -0.2]],
    adsFov: 12,
    preferredRange: 14
  }),
  mpistol: gun({
    id: 'mpistol',
    name: 'Machine Pistol',
    tag: 'MP',
    slot: 'secondary',
    damage: { head: 40, torso: 18, legs: 13 },
    interval: 0.06,
    auto: true,
    magazine: 20,
    reload: 1.5,
    spreadStill: 0.018,
    spreadMoving: 0.024,
    adsSpread: 0.6,
    falloffStart: 8,
    falloffEnd: 22,
    minMul: 0.5,
    recoil: 0.009,
    move: 1.1,
    pattern: [[0.8, 0.4], [0.9, -0.5], [0.8, 0.5], [0.8, -0.5]],
    adsFov: 8,
    preferredRange: 7
  }),
  knife: gun({
    id: 'knife',
    name: 'Combat Knife',
    tag: 'KNIFE',
    slot: 'melee',
    damage: { head: 150, torso: 150, legs: 150 },
    interval: 0.6,
    auto: true,
    magazine: 0,
    reload: 0,
    spreadStill: 0,
    spreadMoving: 0,
    falloffStart: 0,
    falloffEnd: 1,
    minMul: 1,
    range: 2.3,
    recoil: 0,
    move: 1.15,
    adsFov: 0,
    preferredRange: 0
  })
};

/** The admin's guns: only the admin account can carry them, and never in ranked or tournaments. */
export const ADMIN_PRIMARIES: WeaponId[] = ['sovereign', 'sovburst', 'moderator', 'kick', 'permaban'];
export const ADMIN_SECONDARIES: WeaponId[] = ['gavel'];
export const isAdminWeapon = (w: WeaponId): boolean => !!WEAPONS[w]?.admin;

export const PRIMARIES: WeaponId[] = ['rifle', 'ak', 'scar', 'burst', 'smg', 'uzi', 'shotgun', 'autoshotgun', 'dmr', 'sniper', 'barrett', 'lmg'];
export const SECONDARIES: WeaponId[] = ['pistol', 'revolver', 'deagle', 'mpistol'];

/** Gun Game ladder: two kills per gun, the knife kill wins. */
export const GUN_GAME_LADDER: WeaponId[] = ['pistol', 'smg', 'shotgun', 'rifle', 'lmg', 'sniper', 'knife'];
export const GUN_GAME_KILLS_PER_TIER = 2;

export const falloff = (w: WeaponDef, d: number): number => {
  if (d <= w.falloffStart) return 1;
  if (d >= w.falloffEnd) return w.minMul;
  return 1 + ((w.minMul - 1) * (d - w.falloffStart)) / (w.falloffEnd - w.falloffStart);
};
