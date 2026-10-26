import * as THREE from 'three';
import type { Unlock } from '../game/cosmetics';
import { box, metal, polymer, steel, tube, wood, type WeaponModel } from './weaponModels';

/**
 * Melee weapons: what you hold in the knife slot. They're looks, not stats:
 * every one is the Combat Knife underneath (same reach, speed and one-hit
 * kill), so picking one never changes a fight. Kills with any of them count
 * as knife kills (badges, mastery, camos).
 */
export type MeleeId = 'knife' | 'karambit' | 'machete' | 'bat' | 'axe' | 'shovel' | 'katana' | 'hammer' | 'kunai';

export interface MeleeDef {
  id: MeleeId;
  name: string;
  /** Short name for the kill feed. */
  tag: string;
  blurb: string;
  unlock: Unlock;
}

export const MELEES: MeleeDef[] = [
  { id: 'knife', name: 'Combat Knife', tag: 'KNIFE', blurb: 'Standard issue', unlock: null },
  { id: 'karambit', name: 'Karambit', tag: 'KARAMBIT', blurb: 'Curved claw blade', unlock: { level: 6 } },
  { id: 'machete', name: 'Machete', tag: 'MACHETE', blurb: 'Long jungle blade', unlock: { level: 12 } },
  { id: 'bat', name: 'Baseball Bat', tag: 'BAT', blurb: 'Out of the park', unlock: { level: 18 } },
  { id: 'axe', name: 'Fire Axe', tag: 'AXE', blurb: 'Red-handled breaching axe', unlock: { level: 24 } },
  { id: 'shovel', name: 'Entrenching Tool', tag: 'SHOVEL', blurb: 'Folding army shovel', unlock: { level: 30 } },
  { id: 'katana', name: 'Katana', tag: 'KATANA', blurb: 'Long single-edged sword', unlock: { level: 38 } },
  { id: 'hammer', name: 'Sledgehammer', tag: 'SLEDGE', blurb: 'Heavy steel head', unlock: { level: 46 } },
  { id: 'kunai', name: 'Kunai', tag: 'KUNAI', blurb: 'Ring-handled throwing blade', unlock: { badge: 'knifemaster' } }
];

export const meleeDef = (id: string | undefined): MeleeDef => MELEES.find((m) => m.id === id) ?? MELEES[0];

const red = new THREE.MeshStandardMaterial({ color: 0xb3261e, metalness: 0.1, roughness: 0.6 });
const wrap = new THREE.MeshStandardMaterial({ color: 0x24201c, metalness: 0, roughness: 0.9 });

/** Prop space as for guns: the grip at the origin, the business end along +Y, +Z up. */
const build = (id: MeleeId): WeaponModel => {
  const g = new THREE.Group();
  let length = 0.24;
  switch (id) {
    case 'karambit': {
      tube(g, 0.015, -0.09, 0.01, 0, polymer);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 6, 14), metal);
      ring.position.set(0, -0.11, 0);
      ring.rotation.y = Math.PI / 2;
      g.add(ring);
      box(g, 0.004, 0.08, 0.026, 0.05, 0.008, steel, 0.25);
      box(g, 0.004, 0.07, 0.02, 0.11, 0.032, steel, 0.85);
      length = 0.16;
      break;
    }
    case 'machete':
      tube(g, 0.016, -0.11, 0.02, 0, polymer);
      box(g, 0.004, 0.36, 0.05, 0.21, 0.01, steel);
      box(g, 0.004, 0.04, 0.035, 0.405, 0.018, steel);
      length = 0.42;
      break;
    case 'bat':
      tube(g, 0.019, -0.13, 0.02, 0, wrap);
      tube(g, 0.024, 0.02, 0.14, 0, wood);
      tube(g, 0.032, 0.14, 0.42, 0, wood);
      tube(g, 0.024, -0.15, -0.13, 0, wood);
      length = 0.42;
      break;
    case 'axe':
      tube(g, 0.016, -0.14, 0.34, 0, red);
      box(g, 0.012, 0.06, 0.12, 0.33, 0.05, steel);
      box(g, 0.014, 0.05, 0.05, 0.33, -0.03, metal);
      length = 0.36;
      break;
    case 'shovel':
      tube(g, 0.014, -0.1, 0.26, 0, polymer);
      box(g, 0.05, 0.03, 0.02, -0.11, 0, polymer);
      box(g, 0.004, 0.15, 0.11, 0.35, 0, metal);
      box(g, 0.004, 0.03, 0.08, 0.44, 0, metal);
      length = 0.46;
      break;
    case 'katana':
      tube(g, 0.014, -0.17, 0.03, 0, wrap);
      box(g, 0.05, 0.008, 0.05, 0.04, 0, metal);
      box(g, 0.004, 0.52, 0.027, 0.31, 0.006, steel, 0.03);
      box(g, 0.003, 0.05, 0.02, 0.59, 0.016, steel, 0.25);
      length = 0.62;
      break;
    case 'hammer':
      tube(g, 0.016, -0.15, 0.34, 0, wood);
      box(g, 0.07, 0.07, 0.17, 0.37, 0, metal);
      length = 0.41;
      break;
    case 'kunai': {
      tube(g, 0.011, -0.09, 0.0, 0, wrap);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 14), metal);
      ring.position.set(0, -0.11, 0);
      ring.rotation.y = Math.PI / 2;
      g.add(ring);
      box(g, 0.005, 0.12, 0.04, 0.06, 0, metal);
      box(g, 0.004, 0.05, 0.02, 0.14, 0, metal);
      length = 0.17;
      break;
    }
    default:
      tube(g, 0.016, -0.1, 0.02, 0, polymer);
      box(g, 0.05, 0.015, 0.03, 0.025, 0, metal);
      box(g, 0.004, 0.18, 0.03, 0.12, 0.004, steel);
      box(g, 0.003, 0.03, 0.018, 0.22, 0.0, steel);
  }
  return { object: g, length, bore: 0, sightZ: 0, sightY: 0 };
};

const cache = new Map<MeleeId, WeaponModel>();

/** The 3D model for a melee weapon (built once). */
export const meleeModel = (id: MeleeId): WeaponModel => {
  let m = cache.get(id);
  if (!m) {
    m = build(id);
    cache.set(id, m);
  }
  return m;
};
