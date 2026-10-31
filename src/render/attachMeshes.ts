import * as THREE from 'three';
import type { WeaponModel } from '../assets/weaponModels';
import { attachmentDef, fits, type AttachSet } from '../sim/attachments';
import type { WeaponId } from '../sim/weapons';

const dark = new THREE.MeshStandardMaterial({ color: 0x1b1d20, metalness: 0.6, roughness: 0.45 });
const glass = new THREE.MeshStandardMaterial({ color: 0x9fd7ff, transparent: true, opacity: 0.18, metalness: 0.2, roughness: 0.05, depthWrite: false });
const red = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
const beam = new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });

/**
 * Height of the gun's line of sight at a point along it (prop frame: +Y
 * forward, +Z up), so an optic sits right on it. The M16's comes from its own
 * peep hole and front post; the procedural guns have level sights.
 */
const sightZ = (id: WeaponId, m: WeaponModel, y: number): number =>
  id === 'rifle' ? 0.1558 + ((y + 0.035) * (0.0962 - 0.1558)) / 0.4839 : m.sightZ + 0.008;

/** Adds the chosen attachments' models to a gun (in place). */
export const addAttachments = (gun: THREE.Object3D, id: WeaponId, m: WeaponModel, set: AttachSet | undefined): void => {
  if (!set) return;
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.x = rx;
    mesh.castShadow = false;
    gun.add(mesh);
    return mesh;
  };
  for (const aid of Object.values(set)) {
    const a = attachmentDef(aid);
    if (!a || !fits(a, id)) continue;
    const L = m.length;
    switch (a.id) {
      case 'reddot':
      case 'holo': {
        // A ring housing on the line of sight, so looking down the sights looks through it.
        const y = L * 0.38;
        const z = sightZ(id, m, y);
        const r = a.id === 'holo' ? 0.024 : 0.018;
        add(new THREE.TorusGeometry(r, 0.0035, 6, 20), dark, 0, y, z, Math.PI / 2);
        add(new THREE.CircleGeometry(r, 16), glass, 0, y, z, Math.PI / 2);
        add(new THREE.BoxGeometry(0.014, a.id === 'holo' ? 0.05 : 0.03, Math.max(0.006, z - r - 0.06)), dark, 0, y, (z - r + 0.06) / 2);
        break;
      }
      case 'suppressor':
        add(new THREE.CylinderGeometry(0.019, 0.019, 0.17, 12), dark, 0, L + 0.08, m.bore);
        break;
      case 'comp':
        add(new THREE.CylinderGeometry(0.016, 0.014, 0.05, 8), dark, 0, L + 0.02, m.bore);
        break;
      case 'vgrip':
        add(new THREE.BoxGeometry(0.022, 0.026, 0.07), dark, 0, L * 0.55, m.bore - 0.07);
        break;
      case 'laser': {
        add(new THREE.BoxGeometry(0.02, 0.05, 0.018), dark, 0.026, L * 0.6, m.bore);
        add(new THREE.SphereGeometry(0.004, 6, 6), red, 0.026, L * 0.6 + 0.026, m.bore);
        // The beam: thin and faint, out to 25 m.
        add(new THREE.CylinderGeometry(0.0025, 0.0025, 25, 4, 1, true), beam, 0.026, L * 0.6 + 12.5, m.bore);
        break;
      }
    }
  }
};

export const attachKey = (set: AttachSet | undefined): string => (set ? Object.values(set).filter(Boolean).sort().join('+') : '');
