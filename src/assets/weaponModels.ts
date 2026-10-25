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
/** Small parts that keep their look under a weapon skin (sights, blades, lenses). */
steel.userData.keep = true;
glass.userData.keep = true;
/** Red reticles in optics. */
const reticle = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
reticle.userData.keep = true;

/**
 * An open sight you look through when aiming: a frame (red dot) or two rings
 * (ring sight) around the sight line at `z`, with a small reticle in the middle.
 * Nothing solid sits on the line of sight itself.
 */
const openSight = (g: THREE.Group, kind: 'dot' | 'rings', y0: number, y1: number, z: number, half: number): void => {
  const post = (x: number, y: number, h: number, w: number) => {
    const m = box(g, w, y1 - y0, h, y, z, metal);
    m.position.x = x;
    return m;
  };
  const mid = (y0 + y1) / 2;
  if (kind === 'dot') {
    box(g, half * 2 + 0.008, y1 - y0, 0.006, mid, z - half - 0.003, metal); // base
    post(-half - 0.002, mid, half * 2 + 0.006, 0.004);
    post(half + 0.002, mid, half * 2 + 0.006, 0.004);
    box(g, half * 2 + 0.008, y1 - y0, 0.004, mid, z + half + 0.002, metal); // hood
  } else {
    for (const y of [y0, y1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(half + 0.002, 0.0028, 6, 20), polymer);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, y, z);
      g.add(ring);
    }
    box(g, 0.006, y1 - y0, 0.004, mid, z - half - 0.003, polymer); // spine
    // Fine crosshair in the front ring.
    box(g, half * 2, 0.001, 0.0008, y1, z, reticle);
    box(g, 0.0008, 0.001, half * 2, y1, z, reticle);
  }
  const dot = new THREE.Mesh(new THREE.SphereGeometry(kind === 'dot' ? 0.0011 : 0.0009, 8, 6), reticle);
  dot.position.set(0, kind === 'dot' ? y1 : y1 - 0.001, z);
  g.add(dot);
};

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

const ak = (): WeaponModel => {
  const g = new THREE.Group();
  box(g, 0.05, 0.3, 0.07, 0.06, 0.06, metal); // receiver
  tube(g, 0.012, 0.2, 0.62, 0.075, metal); // barrel
  tube(g, 0.008, 0.2, 0.48, 0.1, metal); // gas tube
  box(g, 0.055, 0.17, 0.06, 0.3, 0.07, wood); // handguard
  box(g, 0.035, 0.05, 0.15, 0.13, -0.05, metal, -0.35); // curved magazine
  box(g, 0.035, 0.05, 0.1, -0.06, -0.03, wood, 0.3); // grip
  box(g, 0.045, 0.3, 0.07, -0.24, 0.035, wood, -0.1); // stock
  box(g, 0.012, 0.03, 0.03, 0.56, 0.1, steel); // front sight
  box(g, 0.025, 0.03, 0.02, 0.05, 0.1, steel); // rear sight
  return { object: g, length: 0.62, bore: 0.075, sightZ: 0.11, sightY: 0.05 };
};

const burst = (): WeaponModel => {
  const g = new THREE.Group();
  box(g, 0.05, 0.32, 0.075, 0.06, 0.06, polymer); // receiver
  tube(g, 0.011, 0.22, 0.58, 0.075, metal); // barrel
  box(g, 0.06, 0.24, 0.065, 0.33, 0.075, polymer); // railed handguard
  box(g, 0.012, 0.3, 0.012, 0.15, 0.115, metal); // top rail
  box(g, 0.035, 0.05, 0.14, 0.12, -0.05, metal, -0.15); // magazine
  box(g, 0.035, 0.05, 0.1, -0.06, -0.03, polymer, 0.3); // grip
  box(g, 0.05, 0.26, 0.08, -0.24, 0.04, polymer, -0.04); // stock
  box(g, 0.02, 0.04, 0.012, 0.02, 0.124, metal); // red dot mount
  // The eye sits 8 mm above sightZ, so centre the window there.
  openSight(g, 'dot', 0.0, 0.045, 0.145, 0.016);
  return { object: g, length: 0.58, bore: 0.075, sightZ: 0.137, sightY: 0.0 };
};

const dmr = (): WeaponModel => {
  const g = new THREE.Group();
  box(g, 0.05, 0.34, 0.075, 0.07, 0.055, metal); // receiver
  tube(g, 0.012, 0.24, 0.78, 0.07, metal); // long barrel
  box(g, 0.055, 0.28, 0.06, 0.38, 0.065, tan); // handguard
  box(g, 0.035, 0.05, 0.1, 0.13, -0.03, metal); // short magazine
  box(g, 0.035, 0.05, 0.1, -0.05, -0.03, tan, 0.3); // grip
  box(g, 0.05, 0.34, 0.09, -0.26, 0.035, tan, -0.05); // stock
  box(g, 0.02, 0.03, 0.03, 0.02, 0.1, metal); // mounts
  box(g, 0.02, 0.03, 0.03, 0.15, 0.1, metal);
  // Ring sight: look through two rings with a crosshair in the front one.
  openSight(g, 'rings', -0.01, 0.17, 0.138, 0.02);
  return { object: g, length: 0.78, bore: 0.07, sightZ: 0.13, sightY: -0.02 };
};

const revolver = (): WeaponModel => {
  const g = new THREE.Group();
  tube(g, 0.011, 0.05, 0.22, 0.055, metal); // barrel
  box(g, 0.02, 0.17, 0.012, 0.13, 0.072, metal); // top strap
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.06, 8), metal);
  cyl.position.set(0, 0.03, 0.045);
  cyl.castShadow = true;
  g.add(cyl); // cylinder
  box(g, 0.03, 0.06, 0.04, -0.01, 0.04, metal); // frame
  box(g, 0.03, 0.05, 0.1, -0.03, -0.03, wood, 0.35); // grip
  box(g, 0.008, 0.012, 0.014, 0.21, 0.082, steel); // front sight
  box(g, 0.02, 0.012, 0.012, -0.02, 0.08, steel); // rear notch
  return { object: g, length: 0.22, bore: 0.055, sightZ: 0.086, sightY: -0.02 };
};

const scar = (): WeaponModel => {
  const g = new THREE.Group();
  box(g, 0.055, 0.34, 0.08, 0.07, 0.06, tan); // receiver
  tube(g, 0.013, 0.24, 0.66, 0.075, metal); // barrel
  box(g, 0.06, 0.26, 0.07, 0.34, 0.07, tan); // handguard
  box(g, 0.012, 0.42, 0.012, 0.12, 0.12, metal); // top rail
  box(g, 0.035, 0.05, 0.12, 0.13, -0.04, metal, -0.1); // magazine
  box(g, 0.035, 0.05, 0.1, -0.06, -0.03, polymer, 0.3); // grip
  box(g, 0.05, 0.28, 0.09, -0.24, 0.04, tan, -0.04); // stock
  box(g, 0.012, 0.03, 0.03, 0.5, 0.135, steel); // front sight
  box(g, 0.025, 0.03, 0.02, -0.02, 0.135, steel); // rear sight
  return { object: g, length: 0.66, bore: 0.075, sightZ: 0.142, sightY: -0.02 };
};

const uzi = (): WeaponModel => {
  const g = new THREE.Group();
  box(g, 0.05, 0.26, 0.07, 0.05, 0.05, metal); // body
  tube(g, 0.011, 0.18, 0.26, 0.055, metal); // barrel
  box(g, 0.035, 0.05, 0.16, 0.0, -0.06, polymer, 0.05); // grip + magazine
  box(g, 0.015, 0.18, 0.015, -0.14, 0.06, metal); // folding stock
  box(g, 0.01, 0.02, 0.02, 0.15, 0.095, steel); // front sight
  box(g, 0.025, 0.02, 0.015, -0.05, 0.093, steel); // rear sight
  return { object: g, length: 0.26, bore: 0.055, sightZ: 0.1, sightY: -0.05 };
};

const autoshotgun = (): WeaponModel => {
  const g = new THREE.Group();
  box(g, 0.055, 0.3, 0.08, 0.06, 0.06, polymer); // receiver
  tube(g, 0.018, 0.2, 0.6, 0.075, metal); // barrel
  box(g, 0.06, 0.2, 0.06, 0.32, 0.065, polymer); // handguard
  box(g, 0.05, 0.1, 0.13, 0.13, -0.04, polymer); // box magazine
  box(g, 0.035, 0.05, 0.1, -0.06, -0.03, polymer, 0.3); // grip
  box(g, 0.05, 0.28, 0.08, -0.24, 0.04, polymer, -0.05); // stock
  box(g, 0.01, 0.015, 0.015, 0.58, 0.1, steel); // bead
  return { object: g, length: 0.6, bore: 0.075, sightZ: 0.108, sightY: 0.04 };
};

const barrett = (): WeaponModel => {
  const g = new THREE.Group();
  box(g, 0.065, 0.4, 0.09, 0.08, 0.06, tan); // receiver
  tube(g, 0.016, 0.28, 0.95, 0.07, metal); // heavy barrel
  box(g, 0.05, 0.06, 0.04, 0.95, 0.07, metal); // muzzle brake
  tube(g, 0.026, -0.02, 0.3, 0.145, polymer); // scope
  tube(g, 0.032, 0.24, 0.31, 0.145, polymer);
  const lens = tube(g, 0.028, 0.308, 0.312, 0.145, glass);
  lens.castShadow = false;
  box(g, 0.02, 0.03, 0.05, 0.04, 0.105, metal);
  box(g, 0.02, 0.03, 0.05, 0.22, 0.105, metal);
  box(g, 0.05, 0.1, 0.12, 0.16, -0.04, metal); // magazine
  box(g, 0.035, 0.05, 0.11, -0.06, -0.03, polymer, 0.3); // grip
  box(g, 0.06, 0.34, 0.1, -0.28, 0.04, tan, -0.04); // stock
  box(g, 0.015, 0.16, 0.012, 0.6, 0.01, metal, 0.7); // bipod
  return { object: g, length: 0.98, bore: 0.07, sightZ: 0.145, sightY: -0.02 };
};

const deagle = (): WeaponModel => {
  const g = new THREE.Group();
  box(g, 0.034, 0.23, 0.045, 0.085, 0.055, steel); // slide
  box(g, 0.03, 0.16, 0.025, 0.07, 0.025, metal); // frame
  box(g, 0.034, 0.05, 0.11, -0.005, -0.03, polymer, 0.25); // grip
  box(g, 0.008, 0.012, 0.014, 0.19, 0.083, metal); // front sight
  box(g, 0.022, 0.012, 0.012, -0.02, 0.083, metal); // rear sight
  return { object: g, length: 0.2, bore: 0.055, sightZ: 0.089, sightY: -0.02 };
};

const mpistol = (): WeaponModel => {
  const g = new THREE.Group();
  box(g, 0.032, 0.2, 0.04, 0.07, 0.05, polymer); // slide
  box(g, 0.03, 0.16, 0.022, 0.06, 0.025, polymer); // frame
  box(g, 0.03, 0.045, 0.14, -0.005, -0.05, polymer, 0.2); // grip + long magazine
  box(g, 0.012, 0.05, 0.05, 0.16, -0.0, polymer); // foregrip
  box(g, 0.008, 0.012, 0.012, 0.16, 0.076, steel);
  box(g, 0.022, 0.012, 0.012, -0.01, 0.076, steel);
  return { object: g, length: 0.18, bore: 0.05, sightZ: 0.082, sightY: -0.01 };
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
    knife: knife(),
    ak: ak(),
    burst: burst(),
    dmr: dmr(),
    revolver: revolver(),
    scar: scar(),
    uzi: uzi(),
    autoshotgun: autoshotgun(),
    barrett: barrett(),
    deagle: deagle(),
    mpistol: mpistol()
  };
  return cache!;
};

/** A frag grenade mesh (shared geometry). */
export const grenadeMesh = (): THREE.Mesh => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: 0x3d4a2e, roughness: 0.6, metalness: 0.3 }));
  m.scale.set(1, 1.25, 1);
  m.castShadow = true;
  return m;
};
