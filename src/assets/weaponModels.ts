import * as THREE from 'three';
import type { WeaponId } from '../sim/weapons';
import type { PropTemplate } from './AssetRegistry';

/**
 * Every weapon in prop space: grip at the origin, barrel along +Y, sights
 * up along +Z (the same convention as the M16 prop from TribeSim). Only the
 * M16 has a real model; the rest are built from primitives here.
 */
export interface WeaponModel {
  object: THREE.Group;
  /** Muzzle distance along +Y. */
  length: number;
  /** Bore height (+Z) at the muzzle. */
  bore: number;
  /** Sight line height and the rear sight's position along the barrel, for aiming down sights. */
  sightZ: number;
  sightY: number;
}

const metal = new THREE.MeshStandardMaterial({ color: 0x2b2d30, metalness: 0.75, roughness: 0.38 });
const polymer = new THREE.MeshStandardMaterial({ color: 0x1d1f21, metalness: 0.1, roughness: 0.7 });
const wood = new THREE.MeshStandardMaterial({ color: 0x6e4a2b, metalness: 0, roughness: 0.75 });
const tan = new THREE.MeshStandardMaterial({ color: 0x8a7a5a, metalness: 0.1, roughness: 0.75 });
const steel = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.9, roughness: 0.25 });
const glass = new THREE.MeshStandardMaterial({ color: 0x223344, metalness: 0.2, roughness: 0.05, emissive: 0x0a1a2a });

/** Box sized (x width, y length, z height) centred at (0, y, z). */
const box = (g: THREE.Group, w: number, l: number, h: number, y: number, z: number, mat: THREE.Material, rx = 0): THREE.Mesh => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, l, h), mat);
  m.position.set(0, y, z);
  m.rotation.x = rx;
  m.castShadow = true;
  g.add(m);
  return m;
};

/** Cylinder along +Y from y0 to y1 at height z. */
const tube = (g: THREE.Group, r: number, y0: number, y1: number, z: number, mat: THREE.Material): THREE.Mesh => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, y1 - y0, 12), mat);
  m.position.set(0, (y0 + y1) / 2, z);
  m.castShadow = true;
  g.add(m);
  return m;
};

const smg = (): WeaponModel => {
  const g = new THREE.Group();
  box(g, 0.05, 0.3, 0.08, 0.06, 0.05, polymer); // receiver
  tube(g, 0.013, 0.2, 0.33, 0.065, metal); // barrel
  box(g, 0.035, 0.045, 0.17, 0.11, -0.06, metal); // magazine
  box(g, 0.035, 0.05, 0.11, -0.01, -0.03, polymer, 0.25); // grip
  box(g, 0.02, 0.2, 0.03, -0.17, 0.06, metal); // stock rail
  box(g, 0.04, 0.03, 0.07, -0.27, 0.04, polymer); // butt
  box(g, 0.012, 0.03, 0.02, 0.17, 0.1, metal); // front sight
  box(g, 0.03, 0.03, 0.02, -0.04, 0.1, metal); // rear sight
  return { object: g, length: 0.33, bore: 0.065, sightZ: 0.11, sightY: -0.04 };
};

const shotgun = (): WeaponModel => {
  const g = new THREE.Group();
  tube(g, 0.017, 0.05, 0.66, 0.075, metal); // barrel
  tube(g, 0.015, 0.1, 0.56, 0.04, metal); // tube magazine
  box(g, 0.05, 0.16, 0.05, 0.36, 0.04, wood); // pump
  box(g, 0.05, 0.2, 0.08, 0.02, 0.06, metal); // receiver
  box(g, 0.035, 0.05, 0.1, -0.05, -0.02, wood, 0.35); // grip
  box(g, 0.045, 0.32, 0.07, -0.24, 0.025, wood, -0.12); // stock
  box(g, 0.008, 0.01, 0.012, 0.64, 0.097, steel); // bead
  return { object: g, length: 0.66, bore: 0.075, sightZ: 0.1, sightY: 0.04 };
};

const sniper = (): WeaponModel => {
  const g = new THREE.Group();
  tube(g, 0.012, 0.15, 0.8, 0.06, metal); // barrel
  box(g, 0.05, 0.3, 0.07, 0.05, 0.055, metal); // receiver
  tube(g, 0.024, -0.02, 0.26, 0.135, polymer); // scope tube
  tube(g, 0.03, 0.2, 0.27, 0.135, polymer); // objective bell
  const lens = tube(g, 0.026, 0.268, 0.272, 0.135, glass);
  lens.castShadow = false;
  box(g, 0.02, 0.03, 0.05, 0.03, 0.1, metal); // mount
  box(g, 0.02, 0.03, 0.05, 0.19, 0.1, metal);
  box(g, 0.035, 0.05, 0.11, -0.04, -0.02, tan, 0.3); // grip
  box(g, 0.05, 0.38, 0.09, -0.27, 0.035, tan, -0.06); // stock
  box(g, 0.02, 0.05, 0.02, 0.1, 0.06, steel); // bolt handle
  return { object: g, length: 0.8, bore: 0.06, sightZ: 0.135, sightY: -0.02 };
};

const lmg = (): WeaponModel => {
  const g = new THREE.Group();
  box(g, 0.07, 0.38, 0.1, 0.08, 0.06, metal); // receiver
  tube(g, 0.016, 0.25, 0.68, 0.075, metal); // barrel
  tube(g, 0.03, 0.27, 0.45, 0.075, polymer); // handguard
  box(g, 0.1, 0.1, 0.1, 0.06, -0.04, tan); // ammo box
  box(g, 0.035, 0.05, 0.11, -0.04, -0.03, polymer, 0.25); // grip
  box(g, 0.05, 0.3, 0.09, -0.26, 0.04, polymer, -0.05); // stock
  box(g, 0.015, 0.12, 0.012, 0.42, 0.04, metal, 0.6); // bipod leg
  box(g, 0.012, 0.03, 0.025, 0.6, 0.11, metal); // front sight
  box(g, 0.03, 0.03, 0.03, -0.02, 0.125, metal); // rear sight
  return { object: g, length: 0.68, bore: 0.075, sightZ: 0.135, sightY: -0.02 };
};

const pistol = (): WeaponModel => {
  const g = new THREE.Group();
  box(g, 0.03, 0.19, 0.035, 0.07, 0.05, metal); // slide
  box(g, 0.028, 0.15, 0.02, 0.06, 0.025, polymer); // frame
  box(g, 0.03, 0.045, 0.1, -0.005, -0.03, polymer, 0.2); // grip
  box(g, 0.008, 0.012, 0.012, 0.155, 0.072, steel); // front sight
  box(g, 0.022, 0.012, 0.012, -0.01, 0.072, steel); // rear sight
  return { object: g, length: 0.17, bore: 0.05, sightZ: 0.078, sightY: -0.01 };
};

const knife = (): WeaponModel => {
  const g = new THREE.Group();
  tube(g, 0.016, -0.1, 0.02, 0, polymer); // handle
  box(g, 0.05, 0.015, 0.03, 0.025, 0, metal); // guard
  const blade = box(g, 0.004, 0.18, 0.03, 0.12, 0.004, steel);
  blade.scale.set(1, 1, 1);
  box(g, 0.003, 0.03, 0.018, 0.22, 0.0, steel); // tip
  return { object: g, length: 0.24, bore: 0, sightZ: 0, sightY: 0 };
};

let cache: Record<WeaponId, WeaponModel> | null = null;

export const weaponModels = (rifle: PropTemplate): Record<WeaponId, WeaponModel> => {
  if (cache) return cache;
  cache = {
    rifle: { object: rifle.object, length: rifle.length, bore: 0.012, sightZ: 0.135, sightY: 0 },
    smg: smg(),
    shotgun: shotgun(),
    sniper: sniper(),
    lmg: lmg(),
    pistol: pistol(),
    knife: knife()
  };
  return cache;
};

/** A frag grenade mesh (shared geometry). */
export const grenadeMesh = (): THREE.Mesh => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: 0x3d4a2e, roughness: 0.6, metalness: 0.3 }));
  m.scale.set(1, 1.25, 1);
  m.castShadow = true;
  return m;
};
