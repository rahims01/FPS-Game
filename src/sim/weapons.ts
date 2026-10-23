import type { HitRegion } from './config';

export type WeaponId = 'rifle' | 'smg' | 'shotgun' | 'sniper' | 'lmg' | 'pistol' | 'knife';

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
}

const gun = (d: Omit<WeaponDef, 'pellets' | 'scope' | 'adsSpread' | 'spreadAir' | 'range'> & Partial<WeaponDef>): WeaponDef => ({
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
    preferredRange: 18
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
    adsFov: 10,
    preferredRange: 12
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

export const PRIMARIES: WeaponId[] = ['rifle', 'smg', 'shotgun', 'sniper', 'lmg'];

/** Gun Game ladder: two kills per gun, the knife kill wins. */
export const GUN_GAME_LADDER: WeaponId[] = ['pistol', 'smg', 'shotgun', 'rifle', 'lmg', 'sniper', 'knife'];
export const GUN_GAME_KILLS_PER_TIER = 2;

export const falloff = (w: WeaponDef, d: number): number => {
  if (d <= w.falloffStart) return 1;
  if (d >= w.falloffEnd) return w.minMul;
  return 1 + ((w.minMul - 1) * (d - w.falloffStart)) / (w.falloffEnd - w.falloffStart);
};
