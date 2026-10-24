import type { HitRegion } from './config';

export type WeaponId = 'rifle' | 'smg' | 'shotgun' | 'sniper' | 'lmg' | 'pistol' | 'knife' | 'burst' | 'dmr' | 'ak' | 'revolver';

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

export const PRIMARIES: WeaponId[] = ['rifle', 'ak', 'burst', 'smg', 'shotgun', 'dmr', 'sniper', 'lmg'];
export const SECONDARIES: WeaponId[] = ['pistol', 'revolver'];

/** Gun Game ladder: two kills per gun, the knife kill wins. */
export const GUN_GAME_LADDER: WeaponId[] = ['pistol', 'smg', 'shotgun', 'rifle', 'lmg', 'sniper', 'knife'];
export const GUN_GAME_KILLS_PER_TIER = 2;

export const falloff = (w: WeaponDef, d: number): number => {
  if (d <= w.falloffStart) return 1;
  if (d >= w.falloffEnd) return w.minMul;
  return 1 + ((w.minMul - 1) * (d - w.falloffStart)) / (w.falloffEnd - w.falloffStart);
};
